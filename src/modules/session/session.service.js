const supabase = require("../../config/supabase");
const { generateUUID } = require("../../utils/uuid");

exports.findAll = async (filters = {}) => {
  let builder = supabase
    .from("queue_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status) {
    builder = builder.eq("status", filters.status);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data;
};

exports.findOne = async (id) => {
  const { data, error } = await supabase
    .from("queue_sessions")
    .select("*, orders(*, order_items(*, products(*)))")
    .eq("id_session", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const SESSION_STATUS_TRANSITIONS = {
  waiting: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

exports.createSession = async (manualQueueNumber = null) => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  let queueNumberToUse;

  if (manualQueueNumber) {
    // Check if the manual number already exists today (optional, but good practice)
    const { data: existing } = await supabase
      .from("queue_sessions")
      .select("id_session")
      .eq("queue_number", manualQueueNumber)
      .gte("created_at", `${today}T00:00:00`)
      .single();

    if (existing) {
      throw new Error(`Antrean nomor #${manualQueueNumber} sudah ada untuk hari ini`);
    }
    queueNumberToUse = parseInt(manualQueueNumber);
  } else {
    // 1. Get last queue number for today to increment
    const { data: lastSession } = await supabase
      .from("queue_sessions")
      .select("queue_number")
      .gte("created_at", `${today}T00:00:00`)
      .order("queue_number", { ascending: false })
      .limit(1)
      .single();

    queueNumberToUse = lastSession ? lastSession.queue_number + 1 : 1;
  }

  const sessionToken = await generateUUID();

  // 2. Insert new session
  const { data, error } = await supabase
    .from("queue_sessions")
    .insert([
      {
        session_token: sessionToken,
        queue_number: queueNumberToUse,
        status: "waiting",
        is_used: false,
        expired_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), // 4 jam default
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

exports.verifySession = async (token) => {
  const { data, error } = await supabase
    .from("queue_sessions")
    .select("*")
    .eq("session_token", token)
    .single();

  if (error || !data)
    throw new Error("Sesi antrean tidak valid atau QR kadaluarsa");

  if (data.expired_at && new Date(data.expired_at) < new Date()) {
    throw new Error(`Sesi antrean #${data.queue_number} sudah kadaluarsa`);
  }

  if (data.is_used) {
    throw new Error(`Sesi antrean #${data.queue_number} sudah digunakan`);
  }

  if (data.status === "completed" || data.status === "cancelled") {
    throw new Error(
      `Sesi antrean #${data.queue_number} sudah berakhir (${data.status})`,
    );
  }

  // Set active on first scan when still waiting
  if (data.status === "waiting") {
    const { data: updated, error: updateErr } = await supabase
      .from("queue_sessions")
      .update({ status: "active", is_used: true })
      .eq("id_session", data.id_session)
      .eq("status", "waiting")
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);
    return updated;
  }

  return data;
};

exports.updateStatus = async (id, status) => {
  // validate transition
  const { data: current, error: fetchErr } = await supabase
    .from("queue_sessions")
    .select("status")
    .eq("id_session", id)
    .single();

  if (fetchErr || !current) throw new Error("Session not found");

  const allowed = SESSION_STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(
      `Cannot transition status from '${current.status}' to '${status}'. Allowed: [${
        allowed.join(", ") || "none"
      }]`,
    );
  }

  const payload = { status };

  const { data, error } = await supabase
    .from("queue_sessions")
    .update(payload)
    .eq("id_session", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

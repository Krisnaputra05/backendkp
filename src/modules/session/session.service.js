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

exports.createSession = async () => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // 1. Get last queue number for today to increment
  const { data: lastSession } = await supabase
    .from("queue_sessions")
    .select("queue_number")
    .gte("created_at", `${today}T00:00:00`)
    .order("queue_number", { ascending: false })
    .limit(1)
    .single();

  const nextQueueNumber = lastSession ? lastSession.queue_number + 1 : 1;
  const sessionToken = await generateUUID();

  // 2. Insert new session
  const { data, error } = await supabase
    .from("queue_sessions")
    .insert([
      {
        session_token: sessionToken,
        queue_number: nextQueueNumber,
        status: "waiting",
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

  if (data.status === "completed" || data.status === "cancelled") {
    throw new Error(
      `Sesi antrean #${data.queue_number} sudah berakhir (${data.status})`,
    );
  }

  return data;
};

exports.updateStatus = async (id, status) => {
  const payload = { status };
  if (status === "completed" || status === "cancelled") {
    payload.closed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("queue_sessions")
    .update(payload)
    .eq("id_session", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

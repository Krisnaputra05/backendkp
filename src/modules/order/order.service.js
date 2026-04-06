const supabase = require("../../config/supabase");
const { getIO } = require("../../socket");
const productService = require("../product/product.service");
const sessionService = require("../session/session.service");

const getSettings = async () => {
  const { data } = await supabase.from("settings").select("*");
  const settings = {};
  if (data) {
    data.forEach((s) => (settings[s.key] = s.value));
  }

  // Set fallback defaults
  if (!settings.tax_percentage) settings.tax_percentage = "11";
  if (!settings.service_charge_percentage)
    settings.service_charge_percentage = "5";
  if (!settings.restaurant_name) settings.restaurant_name = "My Resto";

  return settings;
};

exports.findAll = async (filters = {}) => {
  // Hanya ambil data ringkas untuk tampilan list agar performa lebih kencang
  let builder = supabase
    .from("orders")
    .select(`
      id_order,
      order_code,
      id_order,
      status,
      final_amount,
      created_at,
      queue_sessions (queue_number)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.status) {
    // Sinkronisasi status dari UI ke Database (Mapping)
    let dbStatus = filters.status;
    if (filters.status === 'confirmed') dbStatus = 'processing'; // misal: confirmed dianggap sedang diproses
    if (filters.status === 'dapur') dbStatus = 'processing';
    if (filters.status === 'selesai') dbStatus = 'completed';
    
    builder = builder.eq("status", dbStatus);
  }

  if (filters.session_id) {
    builder = builder.eq("session_id", filters.session_id);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data;
};

exports.createOrder = async (
  sessionToken,
  items,
  paymentMethod = "cash",
  promoId = null,
) => {
  // ── 0. Input Validation ───────────────────────────────────────────────────
  if (!sessionToken) throw new Error("session_token is required");
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  // ── 1. Verify Session & Status
  const session = await sessionService.verifySession(sessionToken);
  if (session.status === "completed" || session.status === "cancelled") {
    throw new Error(`Cannot place order. Session is already ${session.status}`);
  }
  if (session.status === "waiting") {
    await sessionService.updateStatus(session.id_session, "active");
  }

  // 2. Fetch Products & Calculate
  let subtotalPrice = 0;
  const orderItemsData = [];

  for (const item of items) {
    // Validate qty
    const qty = parseInt(item.qty);
    if (!qty || qty <= 0) {
      throw new Error(
        `Invalid qty for product ${item.product_id}. Must be > 0`,
      );
    }

    const product = await productService.findOne(item.product_id);
    if (!product || !product.is_available) {
      throw new Error(
        `Product ${item.product_id} is unavailable or does not exist`,
      );
    }
    // Ignore price from request — always use DB price
    const subtotal = qty * Number(product.price);
    subtotalPrice += subtotal;

    orderItemsData.push({
      product_id: item.product_id,
      qty: qty,
      price_at_purchase: product.price, // locked from DB
      subtotal: subtotal,
      notes: item.notes || item.note || null,
    });
  }

  // Calculate Discount if promoId is provided
  let discountAmount = 0;
  if (promoId) {
    const { data: promo } = await supabase
      .from("promos")
      .select("*")
      .eq("id_promo", promoId)
      .eq("is_active", true)
      .single();

    if (promo) {
      if (promo.discount_type === "percentage") {
        discountAmount = subtotalPrice * (promo.discount_value / 100);
      } else if (promo.discount_type === "fixed") {
        discountAmount = promo.discount_value;
      }
    }
  }

  // Calculate taxes
  const settings = await getSettings();
  const validSubtotal = subtotalPrice - discountAmount;
  const taxRate = parseFloat(settings.tax_percentage) / 100;
  const serviceRate = parseFloat(settings.service_charge_percentage) / 100;

  const taxAmount = validSubtotal * taxRate;
  const serviceCharge = validSubtotal * serviceRate;
  const finalAmount = validSubtotal + taxAmount + serviceCharge;

  // 3. Create Order
  // Generate unique order code with prefix ORD- and 5 digits
  let orderCode;
  let isUnique = false;
  while (!isUnique) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
    orderCode = `ORD-${randomDigits}`;
    const { data: existing } = await supabase
      .from("orders")
      .select("id_order")
      .eq("order_code", orderCode)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) isUnique = true;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
        order_code: orderCode,
        session_id: session.id_session,
        status: "pending",
        subtotal: subtotalPrice,
        promo_id: promoId || null,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        service_charge: serviceCharge,
        final_amount: finalAmount,
        user_id: null,
      },
    ])
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);

  // 4. Create Order Items
  const itemsWithOrderId = orderItemsData.map((i) => ({
    ...i,
    order_id: order.id_order,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsWithOrderId);

  if (itemsError) throw new Error(itemsError.message);

  // 5. Create Initial Payment Record (Unpaid)
  const { error: paymentError } = await supabase.from("payments").insert([
    {
      session_id: session.id_session,
      order_id: order.id_order,
      amount_due: finalAmount,
      amount_paid: 0,
      payment_status: "unpaid",
      method: paymentMethod,
      // kalau tidak error berarti berhasil kalo error (disini awalnya ada user_id tapi dihapus)
    },
  ]);

  if (paymentError) throw new Error(paymentError.message);

  // 6. Emit Events
  const io = getIO();
  const fullOrder = await exports.findOne(order.id_order);

  if (io) {
  // Room-based emit (Security)
  io.to(`session:${session.id_session}`).emit("order:new", fullOrder);
  // To staff only
  io.to("role:cashier").emit("notification:new", {
    message: `New order for queue #${session.queue_number}`,
    orderId: order.id_order,
  });
  }

  return fullOrder;
};

exports.findOne = async (idOrCode) => {
  let query = supabase
    .from("orders")
    .select(
      `
      *,
      queue_sessions (queue_number),
      order_items (
        *,
        products (name, image_url)
      ),
      payments (*)
    `,
    );

  // Prioritaskan order_code jika input numerik dengan panjang 5 (format baru) atau jika teks (format lengkap)
  if (isNaN(idOrCode)) {
    query = query.eq("order_code", idOrCode);
  } else {
    // Jika numeric string sepanjang 5 digit, tambahkan prefix 'ORD-' dan cek order_code
    if (idOrCode.toString().length === 5) {
      const formattedCode = `ORD-${idOrCode}`;
      const { data: codeMatch } = await supabase
        .from("orders")
        .select("id_order")
        .eq("order_code", formattedCode)
        .maybeSingle();

      if (codeMatch) {
         query = query.eq("order_code", formattedCode);
      } else {
         query = query.eq("id_order", idOrCode);
      }
    } else {
      query = query.eq("id_order", idOrCode);
    }
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

// Valid status transitions — prevent illegal jumps
const STATUS_TRANSITIONS = {
  pending: ["processing", "cancelled"],
  processing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [], // terminal
  cancelled: [], // terminal
};

exports.cancelOrder = async (
  id,
  cancellationReason = "Dibatalkan oleh staf",
) => {
  const { data: order, error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancellation_reason: cancellationReason,
    })
    .eq("id_order", id)
    .select("*, queue_sessions(id_session)")
    .single();

  if (error) throw new Error(error.message);

  const io = getIO();
  if (io) {
    io.to(`session:${order.queue_sessions.id_session}`).emit(
      "order:update",
      order,
    );
  }
  return order;
};

exports.updateOrderItem = async (orderId, productId, newQty) => {
  // 0. Cek Status Order (Hanya boleh jika belum selesai)
  const order = await exports.findOne(orderId);
  if (['completed', 'cancelled'].includes(order.status)) {
    throw new Error(`Cannot edit item. Order is already ${order.status}`);
  }

  if (newQty <= 0) throw new Error("Qty must be > 0. Use DELETE to remove item.");

  // 1. Get Product Price
  const product = await productService.findOne(productId);
  if (!product) throw new Error("Product not found");

  const newSubtotal = Number(product.price) * newQty;

  // 2. Update Order Item
  const { error: itemErr } = await supabase
    .from("order_items")
    .update({
      qty: newQty,
      subtotal: newSubtotal,
    })
    .eq("order_id", orderId)
    .eq("product_id", productId);

  if (itemErr) throw new Error(itemErr.message);

  // 3. Recalculate Order Totals
  return await exports.recalculateOrderTotals(orderId);
};

exports.addItemToOrder = async (orderId, productId, qty, notes = null) => {
  // 0. Cek Status Order
  const order = await exports.findOne(orderId);
  if (['completed', 'cancelled'].includes(order.status)) {
    throw new Error(`Cannot add item. Order is already ${order.status}`);
  }

  const product = await productService.findOne(productId);
  if (!product || !product.is_available) throw new Error("Product unavailable");

  const subtotal = qty * Number(product.price);

  // 1. Upsert: Jika item sudah ada, tambah qty-nya. Jika belum, insert baru.
  const { data: existingItem } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingItem) {
    const newQty = existingItem.qty + parseInt(qty);
    await supabase.from("order_items")
      .update({ qty: newQty, subtotal: newQty * Number(product.price) })
      .eq("id_order_item", existingItem.id_order_item);
  } else {
    await supabase.from("order_items").insert([{
      order_id: orderId,
      product_id: productId,
      qty: qty,
      price_at_purchase: product.price,
      subtotal: subtotal,
      notes: notes
    }]);
  }

  return await exports.recalculateOrderTotals(orderId);
};

exports.removeItemFromOrder = async (orderId, productId) => {
  // 0. Cek Status Order
  const order = await exports.findOne(orderId);
  if (['completed', 'cancelled'].includes(order.status)) {
     throw new Error(`Cannot remove item. Order is already ${order.status}`);
  }

  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);

  return await exports.recalculateOrderTotals(orderId);
};

exports.applyPromoToOrder = async (orderId, promoId) => {
  const { data: promo } = await supabase
    .from("promos")
    .select("*")
    .eq("id_promo", promoId)
    .eq("is_active", true)
    .single();

  if (!promo) throw new Error("Promo not found or inactive");

  await supabase
    .from("orders")
    .update({ promo_id: promoId })
    .eq("id_order", orderId);

  return await exports.recalculateOrderTotals(orderId);
};

exports.recalculateOrderTotals = async (id) => {
  // 1. Get all items
  const { data: items } = await supabase
    .from("order_items")
    .select("subtotal")
    .eq("order_id", id);
  const subtotalPrice = items.reduce((sum, i) => sum + Number(i.subtotal), 0);

  // 2. Get Promo if any
  const { data: orderData } = await supabase
    .from("orders")
    .select("promo_id")
    .eq("id_order", id)
    .single();
  let discountAmount = 0;

  if (orderData.promo_id) {
    const { data: promo } = await supabase
      .from("promos")
      .select("*")
      .eq("id_promo", orderData.promo_id)
      .single();
    if (promo) {
      if (promo.discount_type === "percentage") {
        discountAmount = subtotalPrice * (promo.discount_value / 100);
      } else {
        discountAmount = promo.discount_value;
      }
    }
  }

  // 3. Final Calc
  const settings = await getSettings();
  const validSubtotal = subtotalPrice - discountAmount;
  const taxRate = parseFloat(settings.tax_percentage) / 100;
  const serviceRate = parseFloat(settings.service_charge_percentage) / 100;

  const taxAmount = validSubtotal * taxRate;
  const serviceCharge = validSubtotal * serviceRate;
  const finalAmount = validSubtotal + taxAmount + serviceCharge;

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      subtotal: subtotalPrice,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      service_charge: serviceCharge,
      final_amount: finalAmount,
    })
    .eq("id_order", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updated;
};

exports.updateStatus = async (id, status, cancellationReason = null) => {
  // Fetch current status first
  const { data: current, error: fetchErr } = await supabase
    .from("orders")
    .select("status")
    .eq("id_order", id)
    .single();

  if (fetchErr || !current) throw new Error("Order not found");

  const allowed = STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(
      `Cannot transition status from '${current.status}' to '${status}'. ` +
        `Allowed: [${allowed.join(", ") || "none"}]`,
    );
  }

  const payload = { status };
  if (status === "cancelled" && cancellationReason) {
    payload.cancellation_reason = cancellationReason;
  }

  const { data: order, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id_order", id)
    .select("*, queue_sessions(id_session)")
    .single();

  if (error) throw new Error(error.message);

  // Realtime Room-based
  const io = getIO();
  if (io) {
    io.to(`session:${order.queue_sessions.id_session}`).emit(
      "order:update",
      order,
    );
  }

  return order;
};

exports.processPayment = async (
  sessionId,
  amountPaid,
  method,
  userId = null,
) => {
  // ── 0. Fetch Session and its Orders ─────────────────────────────────────────
  const { data: session, error: sessionErr } = await supabase
    .from("queue_sessions")
    .select(
      `
            *,
            orders (id_order, status, final_amount)
        `,
    )
    .eq("id_session", sessionId)
    .single();

  if (sessionErr || !session) throw new Error("Session not found");
  if (session.status === "completed")
    throw new Error("Session already completed");

  // VALIDASI: Cegah transaksi jika pelanggan BELUM pesan apapun
  if (!session.orders || session.orders.length === 0) {
    throw new Error("Pelanggan belum memesan apapun. Mohon buat pesanan terlebih dahulu.");
  }

  // BUSINESS RULE: Hanya pesanan yang aktif (termasuk pending) yang bisa dibayar
  const activeOrders = session.orders.filter((o) =>
    ["pending", "processing", "ready"].includes(o.status),
  );

  if (activeOrders.length === 0) {
    throw new Error(
      "Tidak ada pesanan aktif (Pending/Processing/Ready) yang bisa dibayar. Periksa kembali status pesanan.",
    );
  }

  const amountDue = activeOrders.reduce(
    (sum, order) => sum + Number(order.final_amount),
    0,
  );
  const paid = Number(amountPaid);

  // ── 1. Financial Validation ───────────────────────────────────────────────
  if (method === "cash") {
    if (paid < amountDue) {
      throw new Error(
        `Insufficient payment. Need Rp ${amountDue}, received Rp ${paid}`,
      );
    }
  } else {
    if (paid !== amountDue) {
      throw new Error(
        `Non-cash payment must equal exact amount due (Rp ${amountDue})`,
      );
    }
  }

  const changeAmount = method === "cash" ? Math.max(0, paid - amountDue) : 0;

  // ── 2. Insert Payment Record (Linked to Session) ──────────────────────────
  const { data: payment, error: payError } = await supabase
    .from("payments")
    .insert([
      {
        session_id: sessionId,
        method: method,
        amount_due: amountDue,
        amount_paid: paid,
        change_amount: changeAmount,
        payment_status: "paid",
        user_id: userId,
        paid_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (payError) throw new Error(payError.message);

  // ── 3. Update all active orders to completed ─────────────────────────────
  const orderIds = activeOrders.map((o) => o.id_order);
  const { error: orderUpdateErr } = await supabase
    .from("orders")
    .update({ status: "completed" })
    .in("id_order", orderIds);

  if (orderUpdateErr) throw new Error(orderUpdateErr.message);

  // ── 4. Update Session to completed (dari status apapun yang belum selesai) ──
  const { data: updatedSession, error: sessionUpdateErr } = await supabase
    .from("queue_sessions")
    .update({
      status: "completed",
      is_used: true
    })
    .eq("id_session", sessionId)
    .in("status", ["waiting", "active"]) // Selesaikan baik yang sudah discan maupun belum
    .select()
    .single();

  if (sessionUpdateErr || !updatedSession) {
    throw new Error("Failed to complete session (session may not be active)");
  }

  // ── 5. Emit Realtime Events (Room-based) ─────────────────────────────────
  const io = getIO();
  if (io) {
    io.to(`session:${sessionId}`).emit("session:completed", {
      sessionId,
      changeAmount,
      message: "Session concluded successfully",
    });
  }

  return { session: updatedSession, payment };
};

exports.getFullSessionReceipt = async (sessionId) => {
  const { data: session } = await supabase
    .from("queue_sessions")
    .select(
      `
            *,
            orders (
                *,
                order_items (
                    *,
                    products (name)
                )
            ),
            payments (*)
        `,
    )
    .eq("id_session", sessionId)
    .single();

  if (!session) throw new Error("Session not found");

  const settings = await getSettings();
  const allItems = [];
  let subtotal = 0;
  let tax = 0;
  let service = 0;
  let discount = 0;
  let grandTotal = 0;

  session.orders.forEach((ord) => {
    if (ord.status === "cancelled") return;

    ord.order_items.forEach((item) => {
      allItems.push({
        name: item.products.name,
        qty: item.qty,
        price: item.price_at_purchase,
        total: item.subtotal,
      });
    });

    subtotal += Number(ord.subtotal);
    tax += Number(ord.tax_amount);
    service += Number(ord.service_charge);
    discount += Number(ord.discount_amount);
    grandTotal += Number(ord.final_amount);
  });

  const payment =
    session.payments && session.payments.length > 0
      ? session.payments[0]
      : null;

  return {
    header: {
      name: settings.restaurant_name,
      address: settings.restaurant_address,
      phone: settings.restaurant_phone,
    },
    session_info: {
      queue_number: session.queue_number,
      session_id: session.id_session,
      date: new Date(session.created_at).toLocaleString("id-ID"),
    },
    items: allItems,
    totals: {
      subtotal,
      tax,
      service,
      discount,
      grand_total: grandTotal,
      payment_method: payment ? payment.method : "UNPAID",
      paid: payment ? payment.amount_paid : 0,
      change: payment ? payment.change_amount : 0,
    },
  };
};

exports.getPrintData = async (orderId) => {
  // 1. Ambil data order lengkap dengan items, products, dan payments
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (
        qty,
        price_at_purchase,
        subtotal,
        products (name)
      ),
      payments (*)
    `)
    .eq("id_order", orderId)
    .single();

  if (error || !order) throw new Error("Order not found");

  // 2. Validasi Pembayaran (Hanya allow jika sudah paid)
  // Catatan: Jika pembayaran dilakukan per sesi, kita cari payment yang terkait dengan session_id ini
  const payment = order.payments.find(p => p.payment_status === "paid") || 
                  (await supabase.from("payments").select("*").eq("session_id", order.session_id).eq("payment_status", "paid").maybeSingle()).data;

  if (!payment) {
    throw new Error("Cannot print receipt: Payment not found or not paid yet.");
  }

  // 3. Transformasi data siap print (Clean JSON)
  return {
    order_code: order.order_code,
    created_at: order.created_at,
    items: order.order_items.map(item => ({
      name: item.products.name,
      qty: item.qty,
      price: Number(item.price_at_purchase),
      subtotal: Number(item.subtotal)
    })),
    subtotal: Number(order.subtotal),
    tax: Number(order.tax_amount),
    service: Number(order.service_charge),
    final_amount: Number(order.final_amount),
    payment: {
      method: payment.method,
      amount_paid: Number(payment.amount_paid),
      change_amount: Number(payment.change_amount),
      status: payment.payment_status,
      paid_at: payment.paid_at,
      cashier_id: payment.user_id
    },
    qr_value: order.order_code // Digunakan untuk scan audit di struk
  };
};

const supabase = require('../../config/supabase');
const { getIO } = require('../../socket');
const productService = require('../product/product.service');
const sessionService = require('../session/session.service');

const getSettings = async () => {
    const { data } = await supabase.from('settings').select('*');
    const settings = {};
    if (data) {
        data.forEach(s => settings[s.key] = s.value);
    }
    
    // Set fallback defaults
    if (!settings.tax_percentage) settings.tax_percentage = '11';
    if (!settings.service_charge_percentage) settings.service_charge_percentage = '5';
    if (!settings.restaurant_name) settings.restaurant_name = 'My Resto';
    
    return settings;
};

exports.findAll = async (filters = {}) => {
  let builder = supabase
    .from('orders')
    .select(`
      *,
      queue_sessions (queue_number),
      order_items (
        *,
        products (name, image_url)
      ),
      payments (*)
    `)
    .is('deleted_at', null)  // exclude soft-deleted orders
    .order('created_at', { ascending: false });

  if (filters.status) {
    builder = builder.eq('status', filters.status);
  }
  if (filters.session_id) {
    builder = builder.eq('session_id', filters.session_id);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data;
};

exports.createOrder = async (sessionToken, items, paymentMethod = 'cash', promoId = null) => {
  // ── 0. Input Validation ───────────────────────────────────────────────────
  if (!sessionToken) throw new Error('session_token is required');
  if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Order must contain at least one item');
  }

  // ── 1. Verify Session & Status
  const session = await sessionService.verifySession(sessionToken);
  if (session.status === 'completed' || session.status === 'cancelled') {
      throw new Error(`Cannot place order. Session is already ${session.status}`);
  }

  // 2. Fetch Products & Calculate
  let subtotalPrice = 0;
  const orderItemsData = [];

  for (const item of items) {
    // Validate qty
    const qty = parseInt(item.qty);
    if (!qty || qty <= 0) {
        throw new Error(`Invalid qty for product ${item.product_id}. Must be > 0`);
    }

    const product = await productService.findOne(item.product_id);
    if (!product || !product.is_available) {
      throw new Error(`Product ${item.product_id} is unavailable or does not exist`);
    }
    // Ignore price from request — always use DB price
    const subtotal = qty * Number(product.price);
    subtotalPrice += subtotal;

    orderItemsData.push({
      product_id: item.product_id,
      qty: qty,
      price_at_purchase: product.price,   // locked from DB
      subtotal: subtotal,
      notes: item.notes || item.note || null
    });
  }

  // Calculate Discount if promoId is provided
  let discountAmount = 0;
  if (promoId) {
      const { data: promo } = await supabase
        .from('promos')
        .select('*')
        .eq('id_promo', promoId)
        .eq('is_active', true)
        .single();
      
      if (promo) {
          if (promo.discount_type === 'percentage') {
              discountAmount = subtotalPrice * (promo.discount_value / 100);
          } else if (promo.discount_type === 'fixed') {
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
  const orderCode = `ORD-${Date.now()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      order_code: orderCode,
      session_id: session.id_session,
      status: 'pending',
      subtotal: subtotalPrice,
      promo_id: promoId || null,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      service_charge: serviceCharge,
      final_amount: finalAmount,
      user_id: null 
    }])
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);

  // 4. Create Order Items
  const itemsWithOrderId = orderItemsData.map((i) => ({ 
      ...i, 
      order_id: order.id_order 
  }));
  
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsWithOrderId);

  if (itemsError) throw new Error(itemsError.message);
  
  // 5. Create Initial Payment Record (Unpaid)
  const { error: paymentError } = await supabase
      .from('payments')
      .insert([{
          order_id: order.id_order,
          amount_due: finalAmount,
          amount_paid: 0,
          payment_status: 'unpaid',
          method: paymentMethod,
          user_id: null
      }]);
  
  if (paymentError) throw new Error(paymentError.message);

  // 6. Emit Events
  const io = getIO();
  const fullOrder = await exports.findOne(order.id_order); 
  
  // Room-based emit (Security)
  io.to(`session:${session.id_session}`).emit('order:new', fullOrder);
  // To staff only
  io.to('role:cashier').emit('notification:new', { message: `New order for queue #${session.queue_number}`, orderId: order.id_order });

  return fullOrder;
};

exports.findOne = async (id) => {
    const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      queue_sessions (queue_number),
      order_items (
        *,
        products (name, image_url)
      ),
      payments (*)
    `)
    .eq('id_order', id)
    .single();
    
    if (error) throw new Error(error.message);
    return data;
}

// Valid status transitions — prevent illegal jumps
const STATUS_TRANSITIONS = {
    'pending':    ['processing', 'cancelled'],
    'processing': ['ready', 'cancelled'],
    'ready':      ['completed', 'cancelled'],
    'completed':  [],  // terminal
    'cancelled':  [],  // terminal
};

exports.cancelOrder = async (id, cancellationReason = "Dibatalkan oleh staf") => {
    const { data: order, error } = await supabase
        .from('orders')
        .update({ 
            status: 'cancelled',
            cancellation_reason: cancellationReason 
        })
        .eq('id_order', id)
        .select('*, queue_sessions(id_session)')
        .single();

    if (error) throw new Error(error.message);

    const io = getIO();
    io.to(`session:${order.queue_sessions.id_session}`).emit('order:update', order);
    return order;
};

exports.updateOrderItem = async (orderId, productId, newQty) => {
    if (newQty <= 0) throw new Error("Qty must be greater than 0. Use cancel or delete for removal.");

    // 1. Get Product Price
    const product = await productService.findOne(productId);
    if (!product) throw new Error("Product not found");

    const newSubtotal = Number(product.price) * newQty;

    // 2. Update Order Item
    const { error: itemErr } = await supabase
        .from('order_items')
        .update({ 
            qty: newQty,
            subtotal: newSubtotal
        })
        .eq('order_id', orderId)
        .eq('product_id', productId);

    if (itemErr) throw new Error(itemErr.message);

    // 3. Recalculate Order Totals
    return await exports.recalculateOrderTotals(orderId);
};

exports.applyPromoToOrder = async (orderId, promoId) => {
    const { data: promo } = await supabase
        .from('promos')
        .select('*')
        .eq('id_promo', promoId)
        .eq('is_active', true)
        .single();
    
    if (!promo) throw new Error("Promo not found or inactive");

    await supabase.from('orders').update({ promo_id: promoId }).eq('id_order', orderId);
    
    return await exports.recalculateOrderTotals(orderId);
};

exports.recalculateOrderTotals = async (id) => {
    // 1. Get all items
    const { data: items } = await supabase.from('order_items').select('subtotal').eq('order_id', id);
    const subtotalPrice = items.reduce((sum, i) => sum + Number(i.subtotal), 0);

    // 2. Get Promo if any
    const { data: orderData } = await supabase.from('orders').select('promo_id').eq('id_order', id).single();
    let discountAmount = 0;

    if (orderData.promo_id) {
        const { data: promo } = await supabase.from('promos').select('*').eq('id_promo', orderData.promo_id).single();
        if (promo) {
            if (promo.discount_type === 'percentage') {
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
        .from('orders')
        .update({
            subtotal: subtotalPrice,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            service_charge: serviceCharge,
            final_amount: finalAmount
        })
        .eq('id_order', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return updated;
};

exports.updateStatus = async (id, status, cancellationReason = null) => {
  // Fetch current status first
  const { data: current, error: fetchErr } = await supabase
    .from('orders')
    .select('status')
    .eq('id_order', id)
    .single();

  if (fetchErr || !current) throw new Error('Order not found');

  const allowed = STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(status)) {
      throw new Error(
          `Cannot transition status from '${current.status}' to '${status}'. ` +
          `Allowed: [${allowed.join(', ') || 'none'}]`
      );
  }

  const payload = { status };
  if (status === 'cancelled' && cancellationReason) {
      payload.cancellation_reason = cancellationReason;
  }

  const { data: order, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id_order', id)
    .select('*, queue_sessions(id_session)')
    .single();

  if (error) throw new Error(error.message);

  // Realtime Room-based
  const io = getIO();
  io.to(`session:${order.queue_sessions.id_session}`).emit('order:update', order);
  
  return order;
};

exports.processPayment = async (sessionId, amountPaid, method, userId = null) => {
    // ── 0. Fetch Session and its Orders ─────────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
        .from('queue_sessions')
        .select(`
            *,
            orders (id_order, status, final_amount)
        `)
        .eq('id_session', sessionId)
        .single();

    if (sessionErr || !session) throw new Error('Session not found');
    if (session.status === 'completed') throw new Error('Session already completed');

    // POSTPAID BUSINESS RULE: Only completed/ready orders can be paid
    // Order 'pending' means it might not even be cooked yet.
    const activeOrders = session.orders.filter(o => 
        ['processing', 'ready'].includes(o.status)
    );
    
    if (activeOrders.length === 0) {
        throw new Error('No orders ready for payment (Must be Processing or Ready)');
    }

    const amountDue = activeOrders.reduce((sum, order) => sum + Number(order.final_amount), 0);
    const paid = Number(amountPaid);

    // ── 1. Financial Validation ───────────────────────────────────────────────
    if (method === 'cash') {
        if (paid < amountDue) {
            throw new Error(`Insufficient payment. Need Rp ${amountDue}, received Rp ${paid}`);
        }
    } else {
        if (paid !== amountDue) {
            throw new Error(`Non-cash payment must equal exact amount due (Rp ${amountDue})`);
        }
    }

    const changeAmount = method === 'cash' ? Math.max(0, paid - amountDue) : 0;

    // ── 2. Insert Payment Record (Linked to Session) ──────────────────────────
    const { data: payment, error: payError } = await supabase
        .from('payments')
        .insert([{
            session_id:     sessionId,
            method:         method,
            amount_due:     amountDue,
            amount_paid:    paid,
            change_amount:  changeAmount,
            payment_status: 'paid',
            user_id:        userId,
            paid_at:        new Date().toISOString()
        }])
        .select()
        .single();

    if (payError) throw new Error(payError.message);

    // ── 3. Update all active orders to completed ─────────────────────────────
    const orderIds = activeOrders.map(o => o.id_order);
    const { error: orderUpdateErr } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .in('id_order', orderIds);

    if (orderUpdateErr) throw new Error(orderUpdateErr.message);

    // ── 4. Update Session to completed ───────────────────────────────────────
    const { data: updatedSession, error: sessionUpdateErr } = await supabase
        .from('queue_sessions')
        .update({ 
            status: 'completed',
            closed_at: new Date().toISOString()
        })
        .eq('id_session', sessionId)
        .select()
        .single();

    if (sessionUpdateErr) throw new Error(sessionUpdateErr.message);

    // ── 5. Emit Realtime Events (Room-based) ─────────────────────────────────
    const io = getIO();
    io.to(`session:${sessionId}`).emit('session:completed', { 
        sessionId,
        changeAmount,
        message: "Session concluded successfully"
    });

    return { session: updatedSession, payment };
};

exports.getFullSessionReceipt = async (sessionId) => {
    const { data: session } = await supabase
        .from('queue_sessions')
        .select(`
            *,
            orders (
                *,
                order_items (
                    *,
                    products (name)
                )
            ),
            payments (*)
        `)
        .eq('id_session', sessionId)
        .single();

    if (!session) throw new Error('Session not found');

    const settings = await getSettings();
    const allItems = [];
    let subtotal = 0;
    let tax = 0;
    let service = 0;
    let discount = 0;
    let grandTotal = 0;

    session.orders.forEach(ord => {
        if (ord.status === 'cancelled') return;
        
        ord.order_items.forEach(item => {
            allItems.push({
                name: item.products.name,
                qty: item.qty,
                price: item.price_at_purchase,
                total: item.subtotal
            });
        });

        subtotal += Number(ord.subtotal);
        tax += Number(ord.tax_amount);
        service += Number(ord.service_charge);
        discount += Number(ord.discount_amount);
        grandTotal += Number(ord.final_amount);
    });

    const payment = session.payments && session.payments.length > 0 ? session.payments[0] : null;

    return {
        header: {
          name: settings.restaurant_name,
          address: settings.restaurant_address,
          phone: settings.restaurant_phone
        },
        session_info: {
          queue_number: session.queue_number,
          session_id: session.id_session,
          date: new Date(session.created_at).toLocaleString('id-ID')
        },
        items: allItems,
        totals: {
          subtotal,
          tax,
          service,
          discount,
          grand_total: grandTotal,
          payment_method: payment ? payment.method : 'UNPAID',
          paid: payment ? payment.amount_paid : 0,
          change: payment ? payment.change_amount : 0
        }
    };
};

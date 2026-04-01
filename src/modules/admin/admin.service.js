const supabase = require('../../config/supabase');
const bcrypt = require('bcryptjs');

// User Management
exports.createUser = async (username, password, role = 'kasir') => {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create unique user code
  const user_code = `KSR-${Date.now()}`;

  const { data, error } = await supabase
    .from('users')
    .insert([{ user_code, username, password: hashedPassword, role }])
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data;
};

exports.getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id_user, user_code, username, role, is_active, created_at')
    .eq('role', 'kasir') // Khusus kasir saja sesuai request
    .order('id_user', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

exports.deleteUser = async (id) => {
    // We keep this method just in case, or we use soft delete
    const { error } = await supabase.from('users').delete().eq('id_user', id);
    if (error) throw new Error(error.message);
    return true;
};

exports.toggleUserStatus = async (id, isActive) => {
    const { data, error } = await supabase
        .from('users')
        .update({ is_active: isActive })
        .eq('id_user', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

exports.resetPassword = async (id, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { data, error } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id_user', id)
        .select('id_user, username, role')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

// Stats & Reports
exports.getStats = async (filters = {}) => {
    const { period } = filters; // 'daily', 'monthly', 'yearly', 'all'
    
    let payBuilder = supabase
        .from('payments')
        .select(`
            amount_paid,
            change_amount,
            method,
            created_at,
            orders (
                subtotal,
                discount_amount,
                promo_id,
                final_amount
            )
        `)
        .eq('payment_status', 'paid');
        
    let itemBuilder = supabase
        .from('order_items')
        .select(`
            qty,
            subtotal,
            products (name),
            orders!inner (status, created_at)
        `);

    // Optional: Filter by Date based on 'period'
    if (period && period !== 'all') {
        const now = new Date();
        let startDate;
        
        if (period === 'daily') {
            startDate = new Date(now.setHours(0,0,0,0)).toISOString();
        } else if (period === 'monthly') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        } else if (period === 'yearly') {
            startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        }
        
        if (startDate) {
            payBuilder = payBuilder.gte('created_at', startDate);
            itemBuilder = itemBuilder.gte('orders.created_at', startDate);
        }
    }
    
    const { data: payments, error: payError } = await payBuilder;
    if (payError) throw new Error(payError.message);
    
    let totalOmzet = 0;
    let totalCash = 0;
    let totalNonCash = 0;
    let totalDiscounts = 0;
    
    payments.forEach(p => {
        // Safe access: Supabase might return join results as object or array
        const orderData = Array.isArray(p.orders) ? p.orders[0] : p.orders;

        // Omzet asli restorasi = final_amount di tabel orders (jika ada) ATAU uang dibayar dikurangi kembalian
        const trueOmzet = (orderData && orderData.final_amount) 
                          ? Number(orderData.final_amount) 
                          : Number(p.amount_paid || 0) - Number(p.change_amount || 0);

        totalOmzet += trueOmzet;

        // Kategorikan berdasarkan cash atau non-cash
        if (p.method === 'cash') totalCash += trueOmzet;
        else totalNonCash += trueOmzet;
        
        if (orderData && orderData.discount_amount) {
            totalDiscounts += Number(orderData.discount_amount);
        }
    });

    const { data: items, error: itemError } = await itemBuilder;
    if (itemError) throw new Error(itemError.message);

    const productSales = {};
    items.forEach(item => {
        const orderData = Array.isArray(item.orders) ? item.orders[0] : item.orders;
        if (orderData && orderData.status === 'cancelled') return;
        
        const productData = Array.isArray(item.products) ? item.products[0] : item.products;
        const pName = productData ? productData.name : 'Unknown';
        
        if (!productSales[pName]) productSales[pName] = { qty: 0, revenue: 0 };
        productSales[pName].qty += Number(item.qty || 0);
        productSales[pName].revenue += Number(item.subtotal || 0);
    });

    const topSelling = Object.entries(productSales)
        .sort((a, b) => b[1].qty - a[1].qty) // Descending by qty
        .slice(0, 10)
        .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }));

    return {
        period: period || 'all',
        total_omzet: totalOmzet,
        total_cash: totalCash,
        total_non_cash: totalNonCash,
        total_discounts_given: totalDiscounts,
        total_transactions: payments.length,
        top_selling: topSelling,
    };
};

exports.getHistory = async (filters = {}) => {
    const { date_start, date_end } = filters;

    let builder = supabase
        .from('queue_sessions')
        .select(`
            id_session,
            queue_number,
            status,
            created_at,
            payments (
                amount_paid,
                change_amount,
                method
            ),
            orders (
                final_amount
            )
        `)
        .eq('status', 'completed');

    if (date_start) builder = builder.gte('created_at', date_start);
    if (date_end) builder = builder.lte('created_at', date_end);

    const { data, error } = await builder.order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Format for easier UI consumption
    return data.map(sess => {
        // Safe access for payments
        const paymentsArray = Array.isArray(sess.payments) ? sess.payments : (sess.payments ? [sess.payments] : []);
        const payment = paymentsArray.length > 0 ? paymentsArray[0] : null;

        // Safe access for orders
        const ordersArray = Array.isArray(sess.orders) ? sess.orders : (sess.orders ? [sess.orders] : []);
        const totalBill = ordersArray.reduce((sum, o) => sum + Number(o.final_amount || 0), 0);

        return {
            id_session: sess.id_session,
            queue_number: sess.queue_number,
            total_bill: totalBill,
            amount_paid: payment ? (payment.amount_paid || 0) : 0,
            change: payment ? (payment.change_amount || 0) : 0,
            method: payment ? payment.method : 'N/A',
            closed_at: sess.created_at // Menggunakan created_at karena closed_at tidak ada di DB
        };
    });
};


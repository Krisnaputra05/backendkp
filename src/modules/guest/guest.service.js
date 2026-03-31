const supabase = require('../../config/supabase');
const sessionService = require('../session/session.service');

exports.initializeSession = async (qrToken) => {
    // 1. Verify Queue Session Token (Dinamis)
    const session = await sessionService.verifySession(qrToken);
    
    // 2. Return Session Info
    return {
        session,
        session_started_at: new Date()
    };
};

exports.getOrderHistory = async (sessionId) => {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                products (name, image_url)
            )
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data;
};

exports.getPromos = async () => {
    const { data, error } = await supabase
        .from('promos')
        .select('*')
        .eq('is_active', true)
        .order('id_promo', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data || [];
};

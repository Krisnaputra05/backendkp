const supabase = require('../../config/supabase');

exports.findAll = async () => {
    const { data, error } = await supabase
        .from('promos')
        .select('*')
        .order('id_promo', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
};

exports.create = async (promoData) => {
    const { data, error } = await supabase
        .from('promos')
        .insert([promoData])
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

exports.update = async (id, promoData) => {
    const { data, error } = await supabase
        .from('promos')
        .update(promoData)
        .eq('id_promo', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

exports.delete = async (id) => {
    const { error } = await supabase
        .from('promos')
        .delete()
        .eq('id_promo', id);
    if (error) throw new Error(error.message);
    return true;
};

const supabase = require('../../config/supabase');

exports.findAll = async () => {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('key', { ascending: true });
    
    if (error) throw new Error(error.message);
    
    // Transform array to key-value object for easier use
    const settingsMap = {};
    if (data) {
        data.forEach(s => settingsMap[s.key] = s.value);
    }
    return settingsMap;
};

exports.updateByKey = async (key, value) => {
    // Upsert equivalent if key exists it updates, otherwise it creates (requires unique key in table)
    const { data: existing } = await supabase.from('settings').select('*').eq('key', key).single();
    
    let result;
    if (existing) {
        const { data, error } = await supabase
            .from('settings')
            .update({ value, updated_at: new Date() })
            .eq('key', key)
            .select()
            .single();
        if (error) throw new Error(error.message);
        result = data;
    } else {
        const { data, error } = await supabase
            .from('settings')
            .insert([{ key, value }])
            .select()
            .single();
        if (error) throw new Error(error.message);
        result = data;
    }
    return result;
};

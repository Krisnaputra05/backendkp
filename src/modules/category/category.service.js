const supabase = require('../../config/supabase');

exports.findAll = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id_category', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data;
};

exports.create = async (data) => {
  // id_category uses DEFAULT nextval, no manual ID needed
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert([{ category_name: data.category_name }])
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return newCategory;
};

exports.update = async (id, data) => {
  const { data: updated, error } = await supabase
    .from('categories')
    .update({ category_name: data.category_name, updated_at: new Date().toISOString() })
    .eq('id_category', id)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return updated;
};

exports.delete = async (id) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id_category', id);
  
  if (error) throw new Error(error.message);
  return true;
};

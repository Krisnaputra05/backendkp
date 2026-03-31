const supabase = require('../../config/supabase');

exports.findAll = async (query = {}) => {
  let builder = supabase.from('products').select('*, categories(category_name)');

  // Filter by category
  if (query.category_id) {
    builder = builder.eq('category_id', query.category_id);
  }

  // Search by name
  if (query.search) {
    builder = builder.ilike('name', `%${query.search}%`);
  }

  // Is Available
  if (query.is_available !== undefined) {
    builder = builder.eq('is_available', query.is_available);
  }

  // Sorting
  if (query.sort) {
    // e.g. sort=price.asc or sort=price.desc
    const [column, order] = query.sort.split('.');
    builder = builder.order(column, { ascending: order === 'asc' });
  } else {
    builder = builder.order('name', { ascending: true });
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data;
};

exports.findOne = async (id) => {
    const { data, error } = await supabase
        .from('products')
        .select('*, categories(category_name)')
        .eq('id_product', id)
        .single();
    
    if (error) throw new Error(error.message);
    return data;
};

exports.create = async (data) => {
  // product_code: generate otomatis jika tidak dikirim frontend
  // Format: PRD-{timestamp}-{4 karakter random} → dijamin unik
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const product_code = data.product_code || `PRD-${Date.now()}-${randomSuffix}`;

  const { data: newProduct, error } = await supabase
    .from('products')
    .insert([{
        product_code: product_code,
        name: data.name,
        price: Number(data.price),
        image_url: data.image_url || null,
        is_available: data.is_available !== undefined ? Boolean(data.is_available) : true,
        category_id: data.category_id ? Number(data.category_id) : null
    }])
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return newProduct;
};

exports.update = async (id, data) => {
  // Whitelist: hanya field valid yang boleh diupdate
  const payload = {};
  if (data.name         !== undefined) payload.name         = data.name;
  if (data.price        !== undefined) payload.price        = Number(data.price);
  if (data.image_url    !== undefined) payload.image_url    = data.image_url;
  if (data.category_id  !== undefined) payload.category_id  = data.category_id ? Number(data.category_id) : null;
  // Cast is_available ke boolean murni — cegah string "false" masuk DB
  if (data.is_available !== undefined) {
      payload.is_available = data.is_available === true || data.is_available === 'true';
  }

  if (Object.keys(payload).length === 0) {
      throw new Error('No valid fields provided to update');
  }

  // parseInt(id) — pastikan comparison dengan kolom int4 tidak gagal
  const { data: rows, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id_product', parseInt(id))
    .select();
  
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) throw new Error(`Product with id ${id} not found`);

  return rows[0];
};

exports.delete = async (id) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id_product', id);
  
  if (error) throw new Error(error.message);
  return true;
};

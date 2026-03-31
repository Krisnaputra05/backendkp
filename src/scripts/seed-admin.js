const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

(async () => {
  const username = 'admin';
  const password = 'admin123';
  const role = 'admin';

  console.log(`Checking if user '${username}' exists...`);

  const { data: existingUser, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (existingUser) {
    console.log(`User '${username}' already exists. Updating password...`);
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword, role })
      .eq('username', username);

    if (updateError) {
      console.error('Error updating user:', updateError.message);
    } else {
      console.log('User updated successfully.');
    }
  } else {
    console.log(`User '${username}' not found. Creating...`);
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error: insertError } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword, role }]);

    if (insertError) {
      console.error('Error creating user:', insertError.message);
    } else {
      console.log('User created successfully.');
    }
  }
})();

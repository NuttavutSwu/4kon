const supabase = require('./supabase');

// READ
async function read(table) {
  const { data, error } = await supabase
    .from(table)
    .select('*');

  if (error) {
    console.error('READ ERROR:', error);
    return [];
  }

  return data;
}

// INSERT
async function insert(table, data) {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select();

  if (error) {
    console.error('INSERT ERROR:', error);
    return { success: false, error };
  }

  return { success: true, data: result };
}


// UPDATE
async function update(table, id, newData) {
  const { error } = await supabase
    .from(table)
    .update(newData)
    .eq('id', id);

  if (error) {
    console.error('UPDATE ERROR:', error);
  }
}

// DELETE
async function remove(table, id) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('DELETE ERROR:', error);
  }
}

// SEED (optional)
async function seed() {
  const bcrypt = require('bcryptjs');

  const users = await read('users');

  if (users.length === 0) {
    const { v4: uuidv4 } = require('uuid');

await insert('users', [
  {
    id: uuidv4(), // ✅ uuid เท่านั้น
    username: 'admin',
    email: 'admin@starwish.com',
    password: bcrypt.hashSync('admin123', 10),
    role_id: 1, // ✅ ใช้ role_id
    created_at: new Date().toISOString() // ✅ snake_case
  }
]);

    console.log('✅ Seed users complete');
  }
}

seed();

module.exports = { read, insert, update, remove };

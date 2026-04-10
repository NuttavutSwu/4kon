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
  const { error } = await supabase
    .from(table)
    .insert(data);

  if (error) {
    console.error('INSERT ERROR:', error);
  }
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
    await insert('users', [
      {
        id: '1',
        username: 'admin',
        email: 'admin@starwish.com',
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    ]);

    console.log('✅ Seed users complete');
  }
}

seed();

module.exports = { read, insert, update, remove };

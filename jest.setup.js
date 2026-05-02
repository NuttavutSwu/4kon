// Set NODE_ENV before any modules are loaded
process.env.NODE_ENV = 'test';

// Mock supabase early
const path = require('path');

// Assuming jest.setup.js is in the root, we need to go to utils/
const supabasePath = path.resolve(__dirname, 'utils', 'supabase.js');

require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: {
    from: (table) => ({
      select: async () => ({ data: [], error: null }),
      insert: async (data) => ({ data, error: null }),
      update: async () => ({ data: [], error: null }),
      delete: async () => ({ data: [], error: null })
    })
  }
};


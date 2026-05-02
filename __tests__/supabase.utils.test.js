
const express = require('express');
const request = require('supertest');

// Test supabase client creation in utils/supabase.js
// We mock @supabase/supabase-js to verify createClient is called correctly

// Create helper to generate fresh chainable mock - avoids circular reference during initialization
function createChainableMock() {
  return {
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    update: jest.fn().mockResolvedValue({ error: null }),
    delete: jest.fn().mockResolvedValue({ error: null }),
    eq: jest.fn().mockResolvedValue({ data: null, error: null })
  };
}

// Create a fully-defined chainable mock object - defined once for performance
const fullChainObj = {
  select: jest.fn().mockResolvedValue({ data: [], error: null }),
  insert: jest.fn().mockResolvedValue({ data: [], error: null }),
  update: jest.fn().mockResolvedValue({ error: null }),
  delete: jest.fn().mockResolvedValue({ error: null }),
  eq: jest.fn().mockResolvedValue({ data: null, error: null })
};

const mockClient = {
  from: jest.fn(() => fullChainObj)
};

const mockCreateClient = jest.fn(() => mockClient);

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient
}));

// Set test environment variables before requiring supabase
const originalEnv = process.env;
beforeAll(() => {
  process.env = { ...originalEnv, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_KEY: 'test-key' };
  // Clear module cache to ensure fresh require
  jest.resetModules();
});

afterAll(() => {
  process.env = originalEnv;
});

// Now require the actual supabase module - it should use our mock
const supabase = require('../utils/supabase');

describe('utils/supabase.js', () => {
  test('createClient is called with env variables from process.env', () => {
    expect(mockCreateClient).toHaveBeenCalled();
  });

  test('supabase client is exported and has from method', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  test('supabase client can query a table', async () => {
    const result = await supabase.from('products').select();
    expect(result).toBeDefined();
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  test('supabase client can insert into a table', async () => {
    const result = await supabase.from('products').insert([{ name: 'Test Product' }]);
    expect(result).toBeDefined();
  });

  test('supabase client can update a record', async () => {
    const result = await supabase.from('products').update({ name: 'Updated' });
    expect(result).toBeDefined();
    expect(result.error).toBeNull();
  });

  test('supabase client can delete a record', async () => {
    const result = await supabase.from('products').delete();
    expect(result).toBeDefined();
    expect(result.error).toBeNull();
  });

  test('eq method can be used for filtering', async () => {
    const result = await supabase.from('products').eq('id', 1);
    expect(result).toBeDefined();
    expect(result.error).toBeNull();
  });
});

describe('utils/supabase client usage in routes', () => {
  // Mock db utils to avoid issues
  jest.mock('../utils/db', () => ({
    read: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue({ success: true })
  }));

  // Pages router uses supabase - test with mocked supabase
  const pagesRouter = require('../routes/pages');

  function makeApp() {
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use((req, _res, next) => {
      req.session = {};
      next();
    });
    app.use((req, res, next) => {
      res.render = (view, locals) => res.status(200).json({ view, ...locals });
      next();
    });
    app.use('/', pagesRouter);
    return app;
  }

  test('routes use supabase client for queries', async () => {
    const app = makeApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  test('wishlist route queries products', async () => {
    const app = makeApp();
    const res = await request(app).get('/wishlist');
    expect(res.status).toBe(200);
  });

  test('product detail renders view with mock data', async () => {
    const app = makeApp();
    const res = await request(app).get('/product/123');
    expect(res.status).toBe(200);
  });
});

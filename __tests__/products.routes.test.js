const express = require('express');
const request = require('supertest');

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'product-uuid')
}));

const state = {
  productsSingle: { data: null, error: null },
  categoriesSelect: { data: [], error: null },
  productInsert: { error: null },
  productUpdate: { error: null },
  productDelete: { error: null },
  categoryInsert: { error: null }
};

const selectChain = {
  eq: jest.fn(() => selectChain),
  single: jest.fn(async () => state.productsSingle)
};

const updateChain = {
  eq: jest.fn(() => ({ error: state.productUpdate.error }))
};

const deleteChain = {
  eq: jest.fn(() => ({ error: state.productDelete.error }))
};

const mockProductsTable = {
  select: jest.fn(() => selectChain),
  insert: jest.fn(async () => state.productInsert),
  update: jest.fn(() => updateChain),
  delete: jest.fn(() => deleteChain)
};

const mockCategoriesTable = {
  select: jest.fn(async () => state.categoriesSelect),
  insert: jest.fn(async () => state.categoryInsert)
};

jest.mock('../utils/supabase', () => ({
  from: jest.fn((table) => {
    if (table === 'products') return mockProductsTable;
    if (table === 'categories') return mockCategoriesTable;
    return {
      select: jest.fn(async () => ({ data: [], error: null })),
      insert: jest.fn(async () => ({ error: null })),
      update: jest.fn(async () => ({ error: null })),
      delete: jest.fn(async () => ({ error: null })),
      eq: jest.fn(() => mockProductsTable),
      single: jest.fn(async () => ({ data: null, error: null }))
    };
  })
}));

const productsRouter = require('../routes/products');
const supabase = require('../utils/supabase');

function makeApp(user = null) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, ...locals });
    next();
  });
  app.use('/products', productsRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  state.productsSingle = { data: null, error: null };
  state.categoriesSelect = { data: [], error: null };
  state.productInsert = { error: null };
  state.productUpdate = { error: null };
  state.productDelete = { error: null };
  state.categoryInsert = { error: null };
});

describe('routes/products', () => {
  test('GET /products/add redirects when not logged in', async () => {
    const res = await request(makeApp()).get('/products/add');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');
  });

  test('GET /products/add renders form with categories when logged in', async () => {
    state.categoriesSelect = { data: [{ id: 'c1', name: 'tech' }], error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' })).get('/products/add');

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('product_form');
    expect(res.body.mode).toBe('add');
    expect(res.body.categories).toHaveLength(1);
  });

  test('POST /products/add redirects when required fields are missing', async () => {
    const res = await request(makeApp({ id: 'u1', role: 'user' }))
      .post('/products/add')
      .send({ name: '', price: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist?error=missing');
  });

  test('POST /products/add inserts product and category then redirects', async () => {
    state.categoriesSelect = { data: [], error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' }))
      .post('/products/add')
      .send({
        name: 'New Gadget',
        price: '199',
        platform: 'shopee',
        category: 'tech',
        link: 'https://example.com/product',
        description: 'A useful gadget',
        imgUrl: 'https://example.com/image.png',
        isPromo: 'on'
      });

    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(mockProductsTable.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'product-uuid',
        name: 'New Gadget',
        price: 199,
        platform: 'shopee',
        category: 'tech',
        isPromo: true,
        createdBy: 'u1'
      })
    ]);
    expect(mockCategoriesTable.insert).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/product/product-uuid');
  });

  test('GET /products/edit/:id returns 404 when product is missing', async () => {
    state.productsSingle = { data: null, error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' })).get('/products/edit/missing');

    expect(res.status).toBe(404);
    expect(res.body.view).toBe('error');
  });

  test('GET /products/edit/:id renders the form for the owner', async () => {
    state.productsSingle = { data: { id: 'p1', createdBy: 'u1', name: 'Phone', price: 100 }, error: null };
    state.categoriesSelect = { data: [{ id: 'c1', name: 'tech' }], error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' })).get('/products/edit/p1');

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('product_form');
    expect(res.body.mode).toBe('edit');
    expect(res.body.product.id).toBe('p1');
  });

  test('POST /products/edit/:id returns 403 when user lacks permission', async () => {
    state.productsSingle = { data: { id: 'p1', createdBy: 'owner', name: 'Phone', price: 100 }, error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' }))
      .post('/products/edit/p1')
      .send({ name: 'Updated', price: '120' });

    expect(res.status).toBe(403);
    expect(res.body.view).toBe('error');
  });

  test('POST /products/edit/:id updates product and creates missing category', async () => {
    state.productsSingle = { data: { id: 'p1', createdBy: 'u1', name: 'Phone', price: 100 }, error: null };
    state.categoriesSelect = { data: [], error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' }))
      .post('/products/edit/p1')
      .send({
        name: 'Updated Phone',
        price: '150',
        platform: 'lazada',
        category: 'new-category',
        link: 'https://example.com/updated',
        description: 'updated',
        imgUrl: 'https://example.com/img.png',
        isPromo: 'on'
      });

    expect(mockProductsTable.update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Updated Phone',
      price: 150,
      platform: 'lazada',
      category: 'new-category',
      isPromo: true
    }));
    expect(mockCategoriesTable.insert).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/product/p1');
  });

  test('POST /products/delete/:id returns 404 when product is missing', async () => {
    state.productsSingle = { data: null, error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' })).post('/products/delete/missing');

    expect(res.status).toBe(404);
    expect(res.body.view).toBe('error');
  });

  test('POST /products/delete/:id returns 403 when user lacks permission', async () => {
    state.productsSingle = { data: { id: 'p1', createdBy: 'owner', name: 'Phone', price: 100 }, error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' })).post('/products/delete/p1');

    expect(res.status).toBe(403);
    expect(res.body.view).toBe('error');
  });

  test('POST /products/delete/:id removes product for the owner', async () => {
    state.productsSingle = { data: { id: 'p1', createdBy: 'u1', name: 'Phone', price: 100 }, error: null };

    const res = await request(makeApp({ id: 'u1', role: 'user' })).post('/products/delete/p1');

    expect(mockProductsTable.delete).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });
});

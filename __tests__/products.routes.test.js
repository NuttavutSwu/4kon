const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => {
  const insert = jest.fn(async () => ({ error: null }));
  const update = jest.fn(async () => ({ error: null }));
  const del = jest.fn(async () => ({ error: null }));
  const select = jest.fn(() => chain);
  const eq = jest.fn(() => chain);
  const single = jest.fn(async () => ({ data: null, error: null }));

  const chain = {
    select,
    eq,
    single,
    insert,
    update,
    delete: del
  };

  return {
    __chain: chain,
    __insert: insert,
    from: jest.fn(() => chain)
  };
});

const supabase = require('../utils/supabase');
const productsRouter = require('../routes/products');

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Fake session for tests. If header not present, session is empty.
  app.use((req, _res, next) => {
    const raw = req.get('x-test-user');
    req.session = raw ? { user: JSON.parse(raw) } : {};
    next();
  });

  // Prevent EJS rendering from crashing tests if a route calls res.render.
  app.use((req, res, next) => {
    res.render = (_view, _locals) => res.status(200).send('render');
    next();
  });

  app.use('/products', productsRouter);
  return app;
}

describe('routes/products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /products/add redirects to login when not logged in', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/products/add')
      .type('form')
      .send({ name: 'x', price: '10' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?redirect=' + encodeURIComponent('/products/add'));
  });

  test('POST /products/add redirects with error when missing fields', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: '', price: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist?error=missing');
    expect(supabase.__insert).not.toHaveBeenCalled();
  });

  test('POST /products/add inserts product and redirects to /product/:id', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({
        name: 'Phone',
        price: '123',
        platform: 'shopee',
        category: 'tech, gadget, tech',
        link: ' https://example.com ',
        description: ' hello ',
        imgUrl: ' https://img ',
        isPromo: 'on'
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/product\//);
    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(supabase.__insert).toHaveBeenCalled();

    const insertedPayloads = supabase.__insert.mock.calls.map(call => call[0]);
    const allInsertedRows = insertedPayloads.flat().flat();
    expect(allInsertedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Phone',
          price: 123,
          platform: 'shopee',
          category: 'tech,gadget',
          link: 'https://example.com',
          description: 'hello',
          imgUrl: 'https://img',
          isPromo: true,
          createdBy: 'u1'
        })
      ])
    );
  });
});


const request = require('supertest');
const originalNodeEnv = process.env.NODE_ENV;

jest.mock('../utils/db', () => ({
  read: jest.fn().mockResolvedValue([]),
  insert: jest.fn().mockResolvedValue({ success: true }),
  update: jest.fn().mockResolvedValue(),
  remove: jest.fn().mockResolvedValue(),
  seed: jest.fn(),
}));

const app = require('../app');

describe('app.js integration', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test.each([
    ['/login'],
    ['/register'],
    ['/about'],
  ])('GET %s responds with 200', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
  });

  test('env NODE_ENV=test does not call db.seed', () => {
    process.env.NODE_ENV = 'test';
    require('../app');
    const db = require('../utils/db');
    expect(db.seed).not.toHaveBeenCalled();
  });

  test('env NODE_ENV=production calls db.seed', () => {
    const db = require('../utils/db');
    db.seed.mockClear();
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    jest.doMock('../utils/db', () => ({
      read: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockResolvedValue({ success: true }),
      update: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      seed: db.seed
    }));
    require('../app');
    expect(db.seed).toHaveBeenCalled();
  });
});



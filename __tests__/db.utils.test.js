function createSupabaseMock(behavior) {
  const chain = {
    select: jest.fn(async () => behavior.insertSelectResult),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(async () => behavior.eqResult)
  };

  const tables = {};

  return {
    tables,
    from: jest.fn((table) => {
      if (!tables[table]) {
        tables[table] = {
          select: jest.fn(async () => behavior.selectResult),
          insert: jest.fn(() => chain),
          update: jest.fn(() => chain),
          delete: jest.fn(() => chain),
          eq: jest.fn(() => chain)
        };
      }
      return tables[table];
    })
  };
}

async function loadDbWithBehavior(behavior) {
  jest.resetModules();
  const supabaseMock = createSupabaseMock(behavior);
  jest.doMock('../utils/supabase', () => supabaseMock);
  const db = require('../utils/db');
  await new Promise((resolve) => setImmediate(resolve));
  return { db, supabaseMock };
}

describe('utils/db', () => {
  let consoleError;
  let consoleLog;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleLog.mockRestore();
    jest.dontMock('../utils/supabase');
  });

  test('read returns rows on success', async () => {
    const { db } = await loadDbWithBehavior({
      selectResult: { data: [{ id: 'p1' }], error: null },
      insertSelectResult: { data: [], error: null },
      eqResult: { error: null }
    });

    await expect(db.read('products')).resolves.toEqual([{ id: 'p1' }]);
  });

  test('read returns an empty array on error', async () => {
    const { db } = await loadDbWithBehavior({
      selectResult: { data: null, error: new Error('read failed') },
      insertSelectResult: { data: [], error: null },
      eqResult: { error: null }
    });

    await expect(db.read('products')).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith('READ ERROR:', expect.any(Error));
  });

  test('insert returns success payload on success', async () => {
    const { db } = await loadDbWithBehavior({
      selectResult: { data: [], error: null },
      insertSelectResult: { data: [{ id: 'x1' }], error: null },
      eqResult: { error: null }
    });

    await expect(db.insert('products', [{ id: 'x1' }])).resolves.toEqual({
      success: true,
      data: [{ id: 'x1' }]
    });
  });

  test('insert returns failure payload on error', async () => {
    const { db } = await loadDbWithBehavior({
      selectResult: { data: [], error: null },
      insertSelectResult: { data: null, error: new Error('insert failed') },
      eqResult: { error: null }
    });

    await expect(db.insert('products', [{ id: 'x1' }])).resolves.toEqual({
      success: false,
      error: expect.any(Error)
    });
    expect(consoleError).toHaveBeenCalledWith('INSERT ERROR:', expect.any(Error));
  });

  test('update logs errors but still resolves', async () => {
    const { db } = await loadDbWithBehavior({
      selectResult: { data: [], error: null },
      insertSelectResult: { data: [], error: null },
      eqResult: { error: new Error('update failed') }
    });

    await expect(db.update('products', 'p1', { name: 'Updated' })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith('UPDATE ERROR:', expect.any(Error));
  });

  test('remove logs errors but still resolves', async () => {
    const { db } = await loadDbWithBehavior({
      selectResult: { data: [], error: null },
      insertSelectResult: { data: [], error: null },
      eqResult: { error: new Error('delete failed') }
    });

    await expect(db.remove('products', 'p1')).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith('DELETE ERROR:', expect.any(Error));
  });

  test('seed inserts the default admin user when table is empty', async () => {
    const { supabaseMock } = await loadDbWithBehavior({
      selectResult: { data: [], error: null },
      insertSelectResult: { data: [{ id: 'admin' }], error: null },
      eqResult: { error: null }
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(supabaseMock.from).toHaveBeenCalledWith('users');
    expect(supabaseMock.tables.users.insert).toHaveBeenCalled();
  });

  test('seed does not insert when users already exist', async () => {
    const { supabaseMock } = await loadDbWithBehavior({
      selectResult: { data: [{ id: 'u1' }], error: null },
      insertSelectResult: { data: [], error: null },
      eqResult: { error: null }
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(supabaseMock.from).toHaveBeenCalledWith('users');
    expect(supabaseMock.tables.users.insert).not.toHaveBeenCalled();
  });
});

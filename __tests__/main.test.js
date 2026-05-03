function loadMainWithMockDom() {
  const listeners = {};
  const elements = {
    userMenu: { classList: { toggle: jest.fn(), remove: jest.fn() } },
    toastContainer: { appendChild: jest.fn() }
  };

  global.document = {
    addEventListener: jest.fn((event, handler) => {
      listeners[event] = handler;
    }),
    getElementById: jest.fn((id) => elements[id] || null),
    createElement: jest.fn(() => ({
      className: '',
      innerHTML: '',
      remove: jest.fn()
    })),
    body: { innerHTML: '' },
    querySelector: jest.fn()
  };
  global.window = { location: { search: '' }, confirm: jest.fn() };
  global.confirm = global.window.confirm;

  jest.isolateModules(() => {
    require('../public/js/main');
  });

  return { listeners, elements };
}

afterEach(() => {
  delete global.document;
  delete global.window;
  delete global.confirm;
  jest.resetModules();
});

test('main.js registers click and submit listeners', () => {
  const { listeners } = loadMainWithMockDom();
  expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  expect(global.document.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
  expect(typeof listeners.click).toBe('function');
  expect(typeof listeners.submit).toBe('function');
});

test('main.js click listener hides the menu when clicking outside', () => {
  const { listeners, elements } = loadMainWithMockDom();
  listeners.click({
    target: { closest: jest.fn(() => null) }
  });
  expect(elements.userMenu.classList.remove).toHaveBeenCalledWith('show');
});

test('main.js submit listener prevents unsafe delete', () => {
  const { listeners } = loadMainWithMockDom();
  const preventDefault = jest.fn();
  global.window.confirm.mockReturnValue(false);
  listeners.submit({
    target: { dataset: { confirm: 'Are you sure?' } },
    preventDefault
  });
  expect(preventDefault).toHaveBeenCalled();
});

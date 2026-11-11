// A stand-in for the browser, just enough to construct a Chroniko in Node and
// drive it through its public API. It keeps the tests free of dependencies.
//
// It does not parse HTML. An element keeps whatever markup is written to its
// innerHTML as a string, which the tests read to check what was rendered.
// querySelector('.name') hands out one stand-in element per class name, and
// only when that name appears in the markup written to the element or to its
// nearest ancestor that has any, so an element the timeline didn't render is
// null, as in a browser. querySelectorAll() finds nothing.

class FakeElement {
  constructor(parent = null) {
    this.parent = parent;
    this.innerHTML = '';
    this.textContent = '';
    this.className = '';
    this.hidden = false;
    this.dataset = {};
    this.style = { setProperty() {} };
    this.clientWidth = 1000;
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = new Map();
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force = !classes.has(name)) => {
        if (force) classes.add(name);
        else classes.delete(name);
        return force;
      },
    };
  }

  markup() {
    return this.innerHTML || this.parent?.markup() || '';
  }

  querySelector(selector) {
    const name = selector.replace(/^\./, '');
    if (!this.markup().includes(name)) return null;
    if (!this.children.has(name)) this.children.set(name, new FakeElement(this));
    return this.children.get(name);
  }

  querySelectorAll() {
    return [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener));
  }

  /** Call the listeners for an event type, as the browser would. */
  fire(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  // Label widths: 7px a character is close enough for lane packing.
  getContext() {
    return { measureText: (text) => ({ width: text.length * 7 }) };
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: 400 };
  }

  append() {}
  remove() {}
  focus() {}
  scrollIntoView() {}
  contains() {
    return false;
  }
  closest() {
    return null;
  }
}

/**
 * Put the fake browser on globalThis. Call it before each test, since it
 * starts again from an empty page and URL. Returns:
 * - container: the element to pass to new Chroniko()
 * - location:  { hash, pathname, search }; set hash to open a shared link
 * - window:    fire('hashchange') after changing location.hash
 * - frame():   run the pending animation frames, i.e. let the timeline render
 */
export function installDom() {
  const container = new FakeElement();
  const location = { hash: '', pathname: '/clock.html', search: '' };
  const window = new FakeElement();
  let frames = new Map();
  let nextFrame = 1;

  Object.assign(globalThis, {
    window,
    location,
    document: {
      activeElement: null,
      querySelector: () => container,
      createElement: () => new FakeElement(),
    },
    history: {
      state: null,
      replaceState(state, unused, url) {
        location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
      },
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame(callback) {
      frames.set(nextFrame, callback);
      return nextFrame++;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    getComputedStyle: () => ({
      fontStyle: 'normal',
      fontWeight: '400',
      fontSize: '13px',
      fontFamily: 'sans-serif',
      letterSpacing: 'normal',
      wordSpacing: 'normal',
      textTransform: 'none',
    }),
    matchMedia: () => ({ matches: false }),
  });

  const frame = () => {
    while (frames.size) {
      const pending = frames;
      frames = new Map();
      for (const callback of pending.values()) callback(0);
    }
  };

  return { container, location, window, frame };
}

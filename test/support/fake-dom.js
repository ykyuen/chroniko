// A stand-in for the browser, just enough to construct a Chroniko in Node and
// drive it through its public API. It keeps the tests free of dependencies.
//
// It does not parse HTML. An element keeps whatever markup is written to its
// innerHTML as a string, which the tests read to check what was rendered.
// querySelector('.name') hands out one stand-in element per class name, and
// only when that name appears in the markup written to the element or to its
// nearest ancestor that has any, so an element the timeline didn't render is
// null, as in a browser.
//
// Elements made with document.createElement() and put in place with append()
// or insertBefore() are real children, as the lane buttons are.
// querySelectorAll('.a, .b') finds those, by class, below the element and
// below the stand-ins it handed out; it never finds anything in markup.

class FakeElement {
  constructor(parent = null) {
    this.parent = parent;
    this.parentNode = null;
    this.childNodes = [];
    this.innerHTML = '';
    this.textContent = '';
    this.className = '';
    this.hidden = false;
    this.dataset = {};
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
    };
    this.clientWidth = 1000;
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = new Map();
    // Reads and writes className, so the two always agree.
    const classes = () => new Set(this.className.split(/\s+/).filter(Boolean));
    const write = (set) => (this.className = [...set].join(' '));
    this.classList = {
      add: (name) => write(classes().add(name)),
      remove: (name) => {
        const set = classes();
        set.delete(name);
        write(set);
      },
      contains: (name) => classes().has(name),
      toggle: (name, force = !classes().has(name)) => {
        const set = classes();
        if (force) set.add(name);
        else set.delete(name);
        write(set);
        return force;
      },
    };
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get nextSibling() {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  append(...nodes) {
    for (const node of nodes) this.insertBefore(node, null);
  }

  insertBefore(node, ref) {
    node.remove();
    const at = ref ? this.childNodes.indexOf(ref) : -1;
    if (at < 0) this.childNodes.push(node);
    else this.childNodes.splice(at, 0, node);
    node.parentNode = this;
    return node;
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.childNodes;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
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

  querySelectorAll(selector) {
    const wanted = selector.split(',').map((s) => s.trim().replace(/^\./, ''));
    const found = [];
    const walk = (el) => {
      for (const child of [...el.children.values(), ...el.childNodes]) {
        if (child.className.split(/\s+/).some((name) => wanted.includes(name))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
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

  focus() {}
  setPointerCapture() {}
  scrollIntoView() {}
  contains() {
    return false;
  }
  closest() {
    return null;
  }
}

/**
 * Click something inside an element that listens for clicks on its children:
 * the click's target is a child that matches the selector and has this
 * dataset, e.g. clickOn(timeline.legendEl, '.ck-legend-item', { category: 'war' }).
 */
export function clickOn(element, selector, dataset = {}) {
  const child = { dataset, closest: (s) => (s === selector ? child : null) };
  element.fire('click', { target: child });
}

/**
 * Put the fake browser on globalThis. Call it before each test, since it
 * starts again from an empty page and URL. Returns:
 * - container: the element to pass to new Chroniko()
 * - location:  { hash, pathname, search }; set hash to open a shared link
 * - window:    fire('hashchange') after changing location.hash
 * - document:  set hidden and fire('visibilitychange') to hide or show the page
 * - frame(rounds = 100): run the pending animation frames, and the frames they
 *              ask for, i.e. let the timeline render; frame(1) runs one frame
 * - pendingFrames(): how many animation frames are waiting to run
 */
export function installDom() {
  const container = new FakeElement();
  const location = { hash: '', pathname: '/clock.html', search: '' };
  const window = new FakeElement();
  // Listeners and fire() come from FakeElement; set hidden, then
  // fire('visibilitychange'), to hide or show the page.
  const document = Object.assign(new FakeElement(), {
    activeElement: null,
    hidden: false,
    querySelector: () => container,
    createElement: () => new FakeElement(),
  });
  let frames = new Map();
  let nextFrame = 1;

  Object.assign(globalThis, {
    window,
    location,
    document,
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

  // A frame's callbacks may ask for more frames, which run as the next round.
  // A timeline animating every frame never stops asking, so stop after rounds.
  const frame = (rounds = 100) => {
    for (let round = 0; round < rounds && frames.size; round++) {
      const pending = frames;
      frames = new Map();
      for (const callback of pending.values()) callback(0);
    }
  };

  return { container, location, window, document, frame, pendingFrames: () => frames.size };
}

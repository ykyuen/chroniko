// The source option on the Chroniko class: a function that feeds the
// timeline through { add, update, remove } and may return a cleanup that
// destroy() calls. Runs on the stand-in browser (see support/fake-dom.js).

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Chroniko } from '../src/chroniko.js';
import { installDom } from './support/fake-dom.js';

let dom;
beforeEach(() => {
  dom = installDom();
});

const timelineWith = (source, options = {}) =>
  new Chroniko(dom.container, { timeScale: 'clock', start: 0, end: 60_000, source, ...options });
const titles = (timeline) => timeline.items.map((it) => it.event.title);
// Let pending promise callbacks run.
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('source', () => {
  test('is called once with add, update and remove', () => {
    const calls = [];
    const timeline = timelineWith((api) => {
      calls.push(Object.keys(api));
      assert.deepEqual(api.add({ id: 'a', title: 'A', start: 1000 }), ['a']);
      api.add([{ id: 'b', title: 'B', start: 2000 }, { id: 'c', title: 'C', start: 3000 }]);
      api.update('a', { title: 'A2' });
      api.remove('b');
    });
    assert.deepEqual(calls, [['add', 'update', 'remove']]);
    assert.deepEqual(titles(timeline), ['A2', 'C']);
  });

  test('can feed the timeline later, as messages arrive', () => {
    let api;
    const timeline = timelineWith((a) => {
      api = a;
    });
    assert.deepEqual(titles(timeline), []);
    api.add({ title: 'Deploy', start: 1000, category: 'deploy' });
    assert.deepEqual(timeline.items.map((it) => it.id), ['deploy-0']);
  });

  test('is called after the view is set, so the events keep it', () => {
    const timeline = timelineWith((api) => api.add({ title: 'Far', start: 3_600_000 }));
    assert.deepEqual([timeline.start, timeline.end], [0, 60_000]);
  });

  test("passes on its calls' errors", () => {
    let api;
    timelineWith((a) => {
      api = a;
    });
    assert.throws(() => api.update('nope', {}), { message: 'Chroniko: updateEvent found no event with the id "nope"' });
  });

  test('cleanup is called by destroy(), once', () => {
    let cleaned = 0;
    const timeline = timelineWith(() => () => cleaned++);
    assert.equal(cleaned, 0);
    timeline.destroy();
    timeline.destroy();
    assert.equal(cleaned, 1);
  });

  test('calls after destroy() are ignored', () => {
    let api;
    const timeline = timelineWith((a) => {
      api = a;
    });
    timeline.destroy();
    assert.equal(api.add({ title: 'Late', start: 1000 }), undefined);
    assert.doesNotThrow(() => api.update('nope', {}));
    assert.deepEqual(titles(timeline), []);
  });

  test('an async source may resolve to its cleanup', async () => {
    let cleaned = 0;
    const timeline = timelineWith(async (api) => {
      api.add({ title: 'First', start: 1000 });
      return () => cleaned++;
    });
    await settle();
    timeline.destroy();
    assert.equal(cleaned, 1);
  });

  test('a cleanup resolved after destroy() is called at once', async () => {
    let cleaned = 0;
    let resolve;
    const timeline = timelineWith(() => new Promise((r) => (resolve = r)));
    timeline.destroy();
    resolve(() => cleaned++);
    await settle();
    assert.equal(cleaned, 1);
  });

  test('without a cleanup, destroy() still works', () => {
    const timeline = timelineWith(() => {});
    assert.doesNotThrow(() => timeline.destroy());
  });

  test('that throws removes the timeline, and the error passes through', () => {
    let removed = false;
    const original = dom.container.append.bind(dom.container);
    dom.container.append = (root) => {
      original(root);
      const remove = root.remove.bind(root);
      root.remove = () => {
        removed = true;
        remove();
      };
    };
    assert.throws(
      () => timelineWith(() => {
        throw new Error('no connection');
      }),
      { message: 'no connection' },
    );
    assert.equal(removed, true);
  });

  test('may return something other than a cleanup, which is ignored', () => {
    // A concise arrow returns what add() returns, the ids.
    const timeline = timelineWith((api) => api.add({ title: 'A', start: 1000 }));
    assert.deepEqual(titles(timeline), ['A']);
    assert.doesNotThrow(() => timeline.destroy());
  });

  test('must be a function', () => {
    assert.throws(() => timelineWith('/events'), { message: 'Chroniko: source must be a function, got string' });
  });

  test('works on the historical scale', () => {
    const timeline = new Chroniko(dom.container, {
      source: (api) => api.add({ title: 'Black Death', start: 1347, end: 1351 }),
    });
    assert.deepEqual(titles(timeline), ['Black Death']);
  });
});

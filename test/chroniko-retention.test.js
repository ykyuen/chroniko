// Retention on the Chroniko class: the retain and maxEvents options, which
// drop old events from a timeline that keeps growing. Runs on the stand-in
// browser (see support/fake-dom.js), with Date and setTimeout mocked so the
// tests control the time. The viewport is 1000px wide.

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Chroniko } from '../src/chroniko.js';
import { installDom } from './support/fake-dom.js';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let dom;
beforeEach(() => {
  dom = installDom();
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
});
afterEach(() => {
  mock.timers.reset();
});

// A clock timeline showing the hour before now with these events and
// options, rendered once. Records onSelectionChange calls in .calls.
function clock(events, options = {}) {
  const calls = [];
  const timeline = new Chroniko(dom.container, {
    timeScale: 'clock',
    events,
    start: NOW - HOUR,
    end: NOW,
    onSelectionChange: (events) => calls.push(events.map((e) => e.id)),
    ...options,
  });
  timeline.calls = calls;
  dom.frame();
  return timeline;
}

const ids = (timeline) => timeline.items.map((it) => it.id);
const laneOf = (timeline, id) => timeline.items.find((it) => it.id === id).lane;
// A point event `ago` ms before now.
const point = (id, ago) => ({ id, title: id, start: NOW - ago });

describe('maxEvents', () => {
  test('keeps the events that start last, from setEvents', () => {
    const timeline = clock([point('a', 40 * MINUTE), point('b', 30 * MINUTE), point('c', 20 * MINUTE), point('d', 10 * MINUTE)], {
      maxEvents: 2,
    });
    assert.deepEqual(ids(timeline), ['c', 'd']);
  });

  test('drops the events that start first as more are added', () => {
    const timeline = clock([point('a', 40 * MINUTE), point('b', 30 * MINUTE)], { maxEvents: 2 });
    timeline.addEvents(point('c', 20 * MINUTE));
    assert.deepEqual(ids(timeline), ['b', 'c']);
    // By start, not by when they were added: an early arrival goes at once.
    assert.deepEqual(timeline.addEvents(point('early', 50 * MINUTE)), ['early']);
    assert.deepEqual(ids(timeline), ['b', 'c']);
  });

  test('keeps running events, even beyond it', () => {
    const job = { id: 'job', title: 'Job', start: NOW - 50 * MINUTE, running: true };
    const timeline = clock([job, point('a', 40 * MINUTE), point('b', 30 * MINUTE)], { maxEvents: 2 });
    assert.deepEqual(ids(timeline), ['job', 'b']);
    timeline.addEvents([{ ...job, id: 'job2' }, { ...job, id: 'job3' }]);
    assert.deepEqual(ids(timeline), ['job', 'job2', 'job3']);
  });

  test('works on the historical scale', () => {
    const timeline = new Chroniko(dom.container, {
      events: [{ title: 'Black Death', start: 1347 }, { title: 'Printing press', start: 1440 }],
      maxEvents: 1,
    });
    assert.deepEqual(timeline.items.map((it) => it.event.title), ['Printing press']);
  });

  test('must be a positive whole number', () => {
    for (const maxEvents of [0, -1, 1.5, '10', Infinity]) {
      assert.throws(() => clock([], { maxEvents }), {
        message: `Chroniko: maxEvents must be a positive whole number, got ${JSON.stringify(maxEvents)}`,
      });
    }
  });
});

describe('retain', () => {
  test('drops events that ended longer ago, from setEvents', () => {
    const timeline = clock(
      [
        point('old', 31 * MINUTE),
        point('recent', 29 * MINUTE),
        { id: 'long', title: 'Long', start: NOW - 2 * HOUR, end: NOW - 20 * MINUTE },
      ],
      { retain: 30 * MINUTE },
    );
    assert.deepEqual(ids(timeline), ['long', 'recent']);
  });

  test('drops events as they expire, a range by its end', () => {
    const timeline = clock(
      [point('p', 20 * MINUTE), { id: 'r', title: 'R', start: NOW - 50 * MINUTE, end: NOW - 15 * MINUTE }],
      { retain: 30 * MINUTE },
    );
    mock.timers.tick(10 * MINUTE - 1);
    assert.deepEqual(ids(timeline), ['r', 'p']);
    mock.timers.tick(1);
    assert.deepEqual(ids(timeline), ['r']);
    mock.timers.tick(5 * MINUTE);
    assert.deepEqual(ids(timeline), []);
  });

  test('drops added events that have already expired', () => {
    const timeline = clock([], { retain: 30 * MINUTE });
    timeline.addEvents([point('old', HOUR), point('new', MINUTE)]);
    assert.deepEqual(ids(timeline), ['new']);
  });

  test('keeps running events, and counts from the end once one is closed', () => {
    const job = { id: 'job', title: 'Job', start: NOW - 2 * HOUR, running: true };
    const timeline = clock([job], { retain: 30 * MINUTE });
    mock.timers.tick(HOUR);
    assert.deepEqual(ids(timeline), ['job']);
    timeline.updateEvent('job', { end: NOW + HOUR, running: false });
    mock.timers.tick(30 * MINUTE - 1);
    assert.deepEqual(ids(timeline), ['job']);
    mock.timers.tick(1);
    assert.deepEqual(ids(timeline), []);
  });

  test('drops an event whose end is moved into the past', () => {
    const timeline = clock([{ id: 'r', title: 'R', start: NOW - 2 * HOUR, end: NOW }], { retain: 30 * MINUTE });
    timeline.updateEvent('r', { end: NOW - HOUR });
    mock.timers.tick(0);
    assert.deepEqual(ids(timeline), []);
  });

  test('waits longer than setTimeout allows in steps', () => {
    const timeline = clock([point('p', 0)], { retain: 30 * DAY });
    mock.timers.tick(2 ** 31 - 1);
    assert.deepEqual(ids(timeline), ['p']);
    mock.timers.tick(30 * DAY - (2 ** 31 - 1));
    assert.deepEqual(ids(timeline), []);
  });

  test('goes with maxEvents: expired events go first, then the cap', () => {
    const timeline = clock([point('old', HOUR), point('a', 20 * MINUTE), point('b', 10 * MINUTE), point('c', 5 * MINUTE)], {
      retain: 30 * MINUTE,
      maxEvents: 2,
    });
    assert.deepEqual(ids(timeline), ['b', 'c']);
  });

  test('stops on destroy()', () => {
    const timeline = clock([point('p', 20 * MINUTE)], { retain: 30 * MINUTE });
    timeline._evict = () => assert.fail('evicted after destroy()');
    timeline.destroy();
    mock.timers.tick(HOUR);
  });

  test('needs the clock scale', () => {
    assert.throws(() => new Chroniko(dom.container, { retain: 1000 }), {
      message: "Chroniko: retain needs timeScale: 'clock'",
    });
  });

  test('must be a positive number of ms', () => {
    for (const retain of [0, -1, Infinity, NaN, '1000']) {
      assert.throws(() => clock([], { retain }), {
        message: `Chroniko: retain must be a positive number of ms, got ${JSON.stringify(retain)}`,
      });
    }
  });
});

describe('dropped events', () => {
  test('leave the selection, calling onSelectionChange', () => {
    const timeline = clock([point('a', 20 * MINUTE), point('b', 10 * MINUTE)], { retain: 30 * MINUTE });
    timeline.select('a');
    timeline.select('b');
    timeline.calls.length = 0;
    mock.timers.tick(10 * MINUTE);
    assert.deepEqual(timeline.getSelection().map((e) => e.id), ['b']);
    assert.deepEqual(timeline.calls, [['b']]);
    assert.doesNotMatch(timeline.storyEl.innerHTML, /data-id="a"/);
  });

  test('leave the timeline without the others being packed again', () => {
    // b starts on a's label, so it packs into lane 1.
    const timeline = clock([point('a', 20 * MINUTE), point('b', 20 * MINUTE - SECOND), point('c', 5 * MINUTE)], {
      maxEvents: 3,
    });
    assert.equal(laneOf(timeline, 'b'), 1);
    timeline.addEvents(point('d', MINUTE));
    dom.frame();
    assert.deepEqual(ids(timeline), ['b', 'c', 'd']);
    assert.equal(timeline._buttons.has('a'), false);
    assert.equal(laneOf(timeline, 'b'), 1);
    assert.equal(timeline._laneCount, 2);
    // removeEvents packs them again, and lane 0 is free for b.
    timeline.removeEvents('d');
    dom.frame();
    assert.equal(laneOf(timeline, 'b'), 0);
    assert.equal(timeline._laneCount, 1);
  });
});

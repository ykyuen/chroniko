// New arrivals on the Chroniko class: events added with addEvents flash once
// (ck-new), except those added while the timeline is built. Runs on the
// stand-in browser (see support/fake-dom.js), with Date, setTimeout and
// performance.now mocked so the tests control the time.

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Chroniko } from '../src/chroniko.js';
import { installDom } from './support/fake-dom.js';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const MINUTE = 60_000;
const FLASH_MS = 1500;

let dom;
beforeEach(() => {
  dom = installDom();
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
  mock.method(performance, 'now', () => Date.now());
});
afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

function clock(options = {}) {
  const timeline = new Chroniko(dom.container, {
    timeScale: 'clock',
    events: [{ id: 'old', title: 'Old', start: NOW - 30 * MINUTE }],
    start: NOW - 50 * MINUTE,
    end: NOW + 10 * MINUTE,
    ...options,
  });
  dom.frame();
  return timeline;
}

const el = (timeline, id) => timeline._buttons.get(id).el;
const flashing = (timeline, id) => /\bck-new\b/.test(el(timeline, id).className);

describe('new arrivals', () => {
  test('flash once drawn, for FLASH_MS', () => {
    const timeline = clock();
    timeline.addEvents({ id: 'new', title: 'New', start: NOW - 20 * MINUTE });
    dom.frame();
    assert.equal(flashing(timeline, 'new'), true);
    assert.equal(el(timeline, 'new').style.animationDelay, '-0ms');
    assert.equal(flashing(timeline, 'old'), false);
    mock.timers.tick(FLASH_MS);
    timeline.zoomBy(1.0001); // any render
    dom.frame();
    assert.equal(flashing(timeline, 'new'), false);
    assert.equal(el(timeline, 'new').style.animationDelay, '');
  });

  test('that come into view mid-flash start it where it is', () => {
    const timeline = clock();
    timeline.addEvents({ id: 'far', title: 'Far', start: NOW - 3 * 60 * MINUTE });
    dom.frame();
    assert.equal(timeline._buttons.has('far'), false);
    mock.timers.tick(500);
    timeline.zoomTo(NOW - 4 * 60 * MINUTE, NOW);
    dom.frame();
    assert.equal(flashing(timeline, 'far'), true);
    assert.equal(el(timeline, 'far').style.animationDelay, '-500ms');
  });

  test('are not flashed when set with setEvents or changed with updateEvent', () => {
    const timeline = clock();
    timeline.setEvents([{ id: 'a', title: 'A', start: NOW - 20 * MINUTE }]);
    dom.frame();
    assert.equal(flashing(timeline, 'a'), false);
    timeline.updateEvent('a', { title: 'A2' });
    dom.frame();
    assert.equal(flashing(timeline, 'a'), false);
  });

  test("are not flashed while the timeline is built, e.g. a source's backfill", () => {
    let api;
    const timeline = clock({
      source: (a) => {
        api = a;
        a.add({ id: 'backfill', title: 'Backfill', start: NOW - 20 * MINUTE });
      },
    });
    assert.equal(flashing(timeline, 'backfill'), false);
    api.add({ id: 'live', title: 'Live', start: NOW - 10 * MINUTE });
    dom.frame();
    assert.equal(flashing(timeline, 'live'), true);
  });

  test('a reveal pulses instead', () => {
    const timeline = clock();
    timeline.addEvents({ id: 'new', title: 'New', start: NOW - 20 * MINUTE });
    dom.frame();
    timeline.reveal('new');
    dom.frame();
    const cls = el(timeline, 'new').className;
    assert.match(cls, /\bck-flash\b/);
    assert.doesNotMatch(cls, /\bck-new\b/);
  });

  test('flash on the historical scale too', () => {
    const timeline = new Chroniko(dom.container, { events: [{ title: 'Black Death', start: 1347 }], start: 1300, end: 1500 });
    dom.frame();
    timeline.addEvents({ id: 'press', title: 'Printing press', start: 1440 });
    dom.frame();
    assert.equal(flashing(timeline, 'press'), true);
  });
});

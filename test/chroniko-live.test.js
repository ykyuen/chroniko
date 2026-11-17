// Live mode on the Chroniko class: the "now" line, the live loop that moves
// it, and following now. Runs on the stand-in browser (see support/fake-dom.js), with
// Date and setTimeout mocked so the tests control the time. The viewport is
// 1000px wide.

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Chroniko } from '../src/chroniko.js';
import { installDom } from './support/fake-dom.js';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

let dom;
beforeEach(() => {
  dom = installDom();
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
});
afterEach(() => {
  mock.timers.reset();
});

// A clock timeline showing [start, end], rendered once.
function clock(start, end, options = {}) {
  const timeline = new Chroniko(dom.container, {
    timeScale: 'clock',
    events: [{ id: 'deploy', title: 'Deploy', start: NOW - HOUR, end: NOW - 30 * MINUTE }],
    start,
    end,
    ...options,
  });
  dom.frame();
  return timeline;
}

// Where the "now" line is drawn, in px from the left, or null while hidden.
function nowLine(timeline) {
  if (timeline.nowEl.hidden) return null;
  return Number(/translateX\(([-\d.]+)px\)/.exec(timeline.nowEl.style.transform)[1]);
}

// Whether the live loop is waiting to run again, on a timer or a frame.
const waiting = (timeline) => Boolean(timeline._liveTimer || timeline._liveFrame);

// Let ms pass, then run one frame, as the browser would.
function wait(ms) {
  mock.timers.tick(ms);
  dom.frame(1);
}

describe('the "now" line', () => {
  test('is not drawn on the historical scale', () => {
    const timeline = new Chroniko(dom.container, { events: [{ title: 'Black Death', start: 1347, end: 1351 }] });
    dom.frame();
    assert.equal(timeline.nowEl, null);
    assert.doesNotMatch(timeline.root.innerHTML, /ck-now/);
  });

  test('is drawn where now is in the view', () => {
    const timeline = clock(NOW - 30 * MINUTE, NOW + 30 * MINUTE);
    assert.equal(nowLine(timeline), 500);
    assert.match(timeline.root.innerHTML, /class="ck-now" aria-hidden="true" hidden/);
  });

  test('is hidden while the view is before now, and the loop stops', () => {
    const timeline = clock(NOW - 2 * HOUR, NOW - HOUR);
    assert.equal(nowLine(timeline), null);
    assert.equal(waiting(timeline), false);
    assert.equal(dom.pendingFrames(), 0);
  });

  test('appears when now reaches a view ahead of it', () => {
    const timeline = clock(NOW + 10 * SECOND, NOW + 70 * SECOND);
    assert.equal(nowLine(timeline), null);
    wait(10 * SECOND - 1);
    assert.equal(nowLine(timeline), null);
    wait(1);
    assert.equal(nowLine(timeline), 0);
  });

  test('appears when the view moves to now', () => {
    const timeline = clock(NOW - 2 * HOUR, NOW - HOUR);
    timeline.zoomTo(NOW - 30 * MINUTE, NOW + 30 * MINUTE);
    dom.frame();
    assert.equal(nowLine(timeline), 500);
  });

  test('is hidden when the view moves away from now', () => {
    const timeline = clock(NOW - 30 * MINUTE, NOW + 30 * MINUTE);
    timeline.zoomTo(NOW - 2 * HOUR, NOW - HOUR);
    dom.frame();
    assert.equal(nowLine(timeline), null);
    assert.equal(waiting(timeline), false);
  });
});

describe('the live loop', () => {
  test('wakes once the line has fallen half a pixel behind', () => {
    // An hour across 1000px: half a pixel is 1.8 seconds.
    const timeline = clock(NOW - 30 * MINUTE, NOW + 30 * MINUTE);
    assert.equal(dom.pendingFrames(), 0);
    wait(1799);
    assert.equal(nowLine(timeline), 500);
    wait(1);
    assert.equal(nowLine(timeline), 500.5);
    wait(1800);
    assert.equal(nowLine(timeline), 501);
  });

  test('runs every frame when zoomed in to seconds', () => {
    const timeline = clock(NOW - 5 * SECOND, NOW + 5 * SECOND);
    assert.equal(nowLine(timeline), 500);
    assert.equal(dom.pendingFrames(), 1);
    wait(16);
    assert.equal(nowLine(timeline), 501.6);
    wait(1000);
    assert.equal(nowLine(timeline), 601.6);
  });

  test('stops once now has passed the right edge', () => {
    const timeline = clock(NOW - 59 * SECOND, NOW + SECOND);
    wait(2 * SECOND);
    assert.equal(nowLine(timeline), null);
    assert.equal(waiting(timeline), false);
    assert.equal(dom.pendingFrames(), 0);
  });

  test('checks at least once a minute', () => {
    // A view a week ahead: the loop wakes every minute, not once in a week,
    // so a computer that slept or a changed clock can't leave it stuck.
    const timeline = clock(NOW + 7 * 24 * HOUR, NOW + 8 * 24 * HOUR);
    wait(MINUTE - 1);
    assert.equal(waiting(timeline), true);
    assert.equal(dom.pendingFrames(), 0);
    mock.timers.tick(1);
    assert.equal(dom.pendingFrames(), 1);
  });

  test('never renders the lanes again by itself', () => {
    const timeline = clock(NOW - 5 * SECOND, NOW + 5 * SECOND);
    let renders = 0;
    const render = timeline._render.bind(timeline);
    timeline._render = () => {
      renders++;
      render();
    };
    for (let i = 0; i < 10; i++) wait(16);
    assert.equal(renders, 0);
    assert.equal(nowLine(timeline), 516);
  });

  test('sleeps while the page is hidden and catches up when it is shown', () => {
    const timeline = clock(NOW - 30 * MINUTE, NOW + 30 * MINUTE);
    dom.document.hidden = true;
    dom.document.fire('visibilitychange');
    assert.equal(waiting(timeline), false);
    wait(10 * MINUTE);
    assert.equal(nowLine(timeline), 500);
    dom.document.hidden = false;
    dom.document.fire('visibilitychange');
    assert.equal(nowLine(timeline), 666.7);
    assert.equal(waiting(timeline), true);
  });

  test('stops on destroy()', () => {
    const timeline = clock(NOW - 5 * SECOND, NOW + 5 * SECOND);
    timeline.destroy();
    assert.equal(waiting(timeline), false);
    assert.equal(dom.pendingFrames(), 0);
    assert.equal(dom.document.listeners.get('visibilitychange').length, 0);
  });
});

// A clock timeline following now, with a 10-minute view, that records its
// onFollowChange calls in timeline.calls.
function following(options = {}) {
  const calls = [];
  const timeline = clock(NOW - 20 * MINUTE, NOW - 10 * MINUTE, {
    follow: true,
    onFollowChange: (on) => calls.push(on),
    ...options,
  });
  timeline.calls = calls;
  return timeline;
}

const viewOf = (timeline) => [timeline.start, timeline.end];
const spanOf = (timeline) => timeline.end - timeline.start;
const key = (timeline, k) => timeline.viewport.fire('keydown', { key: k, preventDefault() {} });

describe('following now', () => {
  test('needs the clock scale', () => {
    assert.throws(
      () => new Chroniko(dom.container, { follow: true }),
      { message: "Chroniko: follow needs timeScale: 'clock'" },
    );
    const timeline = new Chroniko(dom.container, { events: [{ title: 'Black Death', start: 1347 }] });
    assert.throws(() => timeline.follow(), { message: "Chroniko: follow needs timeScale: 'clock'" });
    assert.equal(timeline.isFollowing(), false);
  });

  test('is off by default', () => {
    const timeline = clock(NOW - 20 * MINUTE, NOW - 10 * MINUTE);
    assert.equal(timeline.isFollowing(), false);
    assert.deepEqual(viewOf(timeline), [NOW - 20 * MINUTE, NOW - 10 * MINUTE]);
  });

  test('the follow option moves the view to now, at its zoom', () => {
    const timeline = following();
    assert.equal(timeline.isFollowing(), true);
    assert.deepEqual(viewOf(timeline), [NOW - 9.5 * MINUTE, NOW + 0.5 * MINUTE]);
    assert.equal(nowLine(timeline), 950);
    assert.deepEqual(timeline.calls, []); // not called for the option
  });

  test('keeps now in place as time passes, panning without relayout', () => {
    const timeline = following({ start: NOW - 5 * SECOND, end: NOW + 5 * SECOND });
    let layouts = 0;
    const layout = timeline._layout.bind(timeline);
    timeline._layout = (scale) => {
      layouts++;
      layout(scale);
    };
    for (let i = 0; i < 1000; i++) wait(16);
    assert.deepEqual(viewOf(timeline), [NOW + 16 * SECOND - 9.5 * SECOND, NOW + 16 * SECOND + 0.5 * SECOND]);
    assert.equal(spanOf(timeline), 10 * SECOND);
    assert.equal(nowLine(timeline), 950);
    assert.equal(layouts, 0);
  });

  test('wakes only once now has moved half a pixel', () => {
    // Ten minutes across 1000px: half a pixel is 300 ms.
    const timeline = following();
    assert.equal(dom.pendingFrames(), 0);
    wait(299);
    assert.deepEqual(viewOf(timeline), [NOW - 9.5 * MINUTE, NOW + 0.5 * MINUTE]);
    wait(1);
    assert.deepEqual(viewOf(timeline), [NOW + 300 - 9.5 * MINUTE, NOW + 300 + 0.5 * MINUTE]);
  });

  test('follow(false) stops it and leaves the view where it is', () => {
    const timeline = following();
    timeline.follow(false);
    assert.equal(timeline.isFollowing(), false);
    assert.deepEqual(timeline.calls, [false]);
    wait(MINUTE);
    assert.deepEqual(viewOf(timeline), [NOW - 9.5 * MINUTE, NOW + 0.5 * MINUTE]);
    assert.equal(nowLine(timeline), null); // now has passed the right edge
  });

  test('follow() starts it, from wherever the view is, at its zoom', () => {
    const calls = [];
    const timeline = clock(NOW - 2 * HOUR, NOW - HOUR, { onFollowChange: (on) => calls.push(on) });
    timeline.follow();
    timeline.follow(true);
    dom.frame();
    assert.equal(timeline.isFollowing(), true);
    assert.deepEqual(calls, [true]);
    assert.deepEqual(viewOf(timeline), [NOW - 0.95 * HOUR, NOW + 0.05 * HOUR]);
  });

  test('carries on through new events and selections', () => {
    const timeline = following();
    timeline.addEvents({ id: 'job', title: 'Job', start: NOW });
    timeline.select('job');
    dom.frame();
    wait(MINUTE);
    assert.equal(timeline.isFollowing(), true);
    assert.equal(nowLine(timeline), 950);
  });

  test('sleeps while the page is hidden and catches up when it is shown', () => {
    const timeline = following();
    dom.document.hidden = true;
    dom.document.fire('visibilitychange');
    wait(10 * MINUTE);
    assert.deepEqual(viewOf(timeline), [NOW - 9.5 * MINUTE, NOW + 0.5 * MINUTE]);
    dom.document.hidden = false;
    dom.document.fire('visibilitychange');
    assert.deepEqual(viewOf(timeline), [NOW + 0.5 * MINUTE, NOW + 10.5 * MINUTE]);
    assert.equal(timeline.isFollowing(), true);
  });
});

describe('what stops following', () => {
  for (const [name, act] of [
    ['panBy', (tl) => tl.panBy(-100)],
    ['zoomTo', (tl) => tl.zoomTo(NOW - HOUR, NOW)],
    ['fit', (tl) => tl.fit()],
    ['reveal', (tl) => tl.reveal('deploy')],
    ['setState with a view', (tl) => tl.setState({ start: NOW - HOUR, end: NOW })],
    ['the arrow keys', (tl) => key(tl, 'ArrowLeft')],
    ['a horizontal wheel', (tl) => tl.viewport.fire('wheel', { deltaX: -50, deltaY: 0, preventDefault() {} })],
    ['a drag', (tl) => {
      tl.viewport.fire('pointerdown', { button: 0, pointerId: 1, clientX: 500, clientY: 100 });
      tl.viewport.fire('pointermove', { pointerId: 1, clientX: 540, clientY: 100 });
      tl.viewport.fire('pointerup', { pointerId: 1 });
    }],
  ]) {
    test(name, () => {
      const timeline = following();
      act(timeline);
      dom.frame();
      assert.equal(timeline.isFollowing(), false);
      assert.deepEqual(timeline.calls, [false]);
      const view = viewOf(timeline);
      wait(MINUTE);
      assert.deepEqual(viewOf(timeline), view); // the view stays put
    });
  }

  test('a click on an event does not', () => {
    const timeline = following();
    timeline.viewport.fire('pointerdown', { button: 0, pointerId: 1, clientX: 500, clientY: 100 });
    timeline.viewport.fire('pointermove', { pointerId: 1, clientX: 502, clientY: 100 }); // under the drag threshold
    timeline.viewport.fire('pointerup', { pointerId: 1 });
    timeline.toggle('deploy');
    assert.equal(timeline.isFollowing(), true);
  });

  test('setState without a view does not', () => {
    const timeline = following();
    timeline.setState({ selected: ['deploy'], timeZone: 'UTC' });
    assert.equal(timeline.isFollowing(), true);
  });

  test('a shared link to a view opens on that view, not following', () => {
    dom.location.hash = `#ck-view=${NOW - 2 * HOUR},${NOW - HOUR}`;
    const timeline = following({ syncUrl: true });
    assert.equal(timeline.isFollowing(), false);
    assert.deepEqual(viewOf(timeline), [NOW - 2 * HOUR, NOW - HOUR]);
  });
});

describe('zooming while following', () => {
  for (const [name, act] of [
    ['zoomBy', (tl) => tl.zoomBy(0.5)],
    ['zoomBy with an anchor', (tl) => tl.zoomBy(0.5, 0.1)],
    ['the + key', (tl) => key(tl, '+')],
    ['the zoom-in button', (tl) => tl.root.querySelector('.ck-controls').fire('click', {
      target: { closest: () => ({ dataset: { action: 'zoom-in' } }) },
    })],
  ]) {
    test(`${name} zooms around now and keeps following`, () => {
      const timeline = following();
      act(timeline);
      dom.frame();
      assert.equal(timeline.isFollowing(), true);
      assert.deepEqual(timeline.calls, []);
      assert.ok(spanOf(timeline) < 10 * MINUTE);
      assert.equal(nowLine(timeline), 950);
    });
  }

  test('a wheel zoom keeps following', () => {
    const timeline = following();
    timeline.viewport.fire('wheel', { deltaX: 0, deltaY: -100, ctrlKey: true, clientX: 200, preventDefault() {} });
    dom.frame();
    assert.equal(timeline.isFollowing(), true);
    assert.ok(spanOf(timeline) < 10 * MINUTE);
    assert.equal(nowLine(timeline), 950);
  });
});

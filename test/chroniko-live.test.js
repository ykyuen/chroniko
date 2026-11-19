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

const clickLive = (timeline) =>
  timeline.root.querySelector('.ck-controls').fire('click', {
    target: { closest: () => ({ dataset: { action: 'live' } }) },
  });
const pressed = (timeline) => timeline.liveEl.getAttribute('aria-pressed');

describe('the Live button', () => {
  test('is there only with the follow option', () => {
    const timeline = clock(NOW - HOUR, NOW);
    assert.equal(timeline.liveEl, null);
    assert.doesNotMatch(timeline.root.innerHTML, /ck-live/);
  });

  test('comes first in the toolbar, with its text in its label', () => {
    const timeline = following({ timeZones: ['local', 'UTC'] });
    const controls = /<div class="ck-controls">\s*(<button[^>]*>)<span class="ck-live-dot"><\/span>([^<]*)<\/button>/
      .exec(timeline.root.innerHTML);
    assert.match(controls[1], /data-action="live"/);
    assert.match(controls[1], /aria-label="Live: keep the view on the current time"/);
    assert.equal(controls[2], 'Live');
    assert.equal(pressed(timeline), 'true');
  });

  test('follow: false shows it, not pressed, without following', () => {
    const timeline = following({ follow: false });
    assert.equal(timeline.isFollowing(), false);
    assert.equal(pressed(timeline), 'false');
    assert.deepEqual(viewOf(timeline), [NOW - 20 * MINUTE, NOW - 10 * MINUTE]);
  });

  test('follow: false still needs the clock scale', () => {
    assert.throws(
      () => new Chroniko(dom.container, { follow: false }),
      { message: "Chroniko: follow needs timeScale: 'clock'" },
    );
  });

  test('clicking it jumps to now at the current zoom, and clicking again stops', () => {
    const timeline = following({ follow: false });
    clickLive(timeline);
    dom.frame();
    assert.equal(timeline.isFollowing(), true);
    assert.equal(pressed(timeline), 'true');
    assert.deepEqual(viewOf(timeline), [NOW - 9.5 * MINUTE, NOW + 0.5 * MINUTE]);
    clickLive(timeline);
    assert.equal(timeline.isFollowing(), false);
    assert.equal(pressed(timeline), 'false');
    assert.deepEqual(timeline.calls, [true, false]);
  });

  test('is unpressed when panning stops following, and pressed by follow()', () => {
    const timeline = following();
    timeline.panBy(-100);
    assert.equal(pressed(timeline), 'false');
    timeline.follow();
    assert.equal(pressed(timeline), 'true');
  });

  test('is translated, and uiText can replace its text', () => {
    const japanese = following({ language: 'ja' });
    assert.match(japanese.root.innerHTML, /aria-label="ライブ：表示を現在時刻に合わせ続ける"><span class="ck-live-dot"><\/span>ライブ</);
    const custom = following({ uiText: { live: 'On air' } });
    assert.match(custom.root.innerHTML, /aria-label="On air: keep the view on the current time"><span class="ck-live-dot"><\/span>On air</);
  });
});

// A UTC clock timeline showing [start, end] with the given events, rendered once.
function running(events, start = NOW - 30 * MINUTE, end = NOW + 30 * MINUTE, options = {}) {
  return clock(start, end, { events, timeZone: 'UTC', ...options });
}
const button = (timeline, id) => timeline._buttons.get(id).el;
const laneOf = (timeline, id) => timeline.items.find((it) => it.id === id).lane;
// How far the lanes are moved left: buttons sit at lane positions, and the
// lanes container is moved by this shift, so on screen x = lane x - shift.
const shiftOf = (timeline) => 0 - Number(/translateX\(([-\d.]+)px\)/.exec(timeline._lanesInner.style.transform)?.[1] ?? 0);
const onScreen = (timeline, el) => `${(parseFloat(el.style.left) - shiftOf(timeline)).toFixed(1)}px`;
const job = (fields = {}) => ({ id: 'job', title: 'Job', start: '2026-11-17T09:45:00Z', running: true, ...fields });

describe('running events', () => {
  test('draw a bar from the start to now', () => {
    const timeline = running([job()]);
    const el = button(timeline, 'job');
    assert.match(el.className, /\bck-range ck-running\b/);
    assert.equal(el.style.left, '250.0px');
    assert.equal(el.style.width, '250.0px');
  });

  test('grow as time passes, with the "now" line', () => {
    // An hour across 1000px: half a pixel is 1.8 seconds.
    const timeline = running([job()]);
    wait(1800);
    assert.equal(button(timeline, 'job').style.width, '250.5px');
    assert.equal(nowLine(timeline), 500.5);
    wait(10 * MINUTE);
    assert.equal(button(timeline, 'job').style.width, '417.2px');
  });

  test('grow while following', () => {
    const timeline = running([job()], NOW - 20 * MINUTE, NOW - 10 * MINUTE, { follow: true });
    dom.frame();
    wait(MINUTE);
    const el = button(timeline, 'job');
    // The view is [now - 9.5 min, now + 0.5 min]; the bar starts before it.
    assert.equal(onScreen(timeline, el), `${((NOW - 15 * MINUTE - (NOW + MINUTE - 9.5 * MINUTE)) / (10 * MINUTE) * 1000).toFixed(1)}px`);
    assert.equal(el.style.width, `${(16 * MINUTE / (10 * MINUTE) * 1000).toFixed(1)}px`);
  });

  test('say how long they have run in the tooltip, kept current wherever the view is', () => {
    // A view that ends before now: the live loop sleeps, the text doesn't.
    const timeline = running([job()], NOW - 50 * MINUTE, NOW - 10 * MINUTE);
    assert.equal(waiting(timeline), false);
    const el = button(timeline, 'job');
    assert.equal(el.title, 'Job · 17 Nov 2026, 09:45:00 – running for 15 minutes');
    mock.timers.tick(12 * SECOND);
    assert.equal(el.title, 'Job · 17 Nov 2026, 09:45:00 – running for 15 minutes, 12 seconds');
  });

  test('count no finer than their start was given', () => {
    const timeline = running([job({ start: '2026-11-17T09:45Z' })]);
    mock.timers.tick(30 * SECOND);
    assert.equal(button(timeline, 'job').title, 'Job · 17 Nov 2026, 09:45 – running for 15 minutes');
  });

  test('that start later than now show only their start, as a short bar', () => {
    const timeline = running([job({ start: '2026-11-17T10:15:00Z' })]);
    const el = button(timeline, 'job');
    assert.equal(el.title, 'Job · 17 Nov 2026, 10:15:00');
    assert.equal(el.style.width, '4.0px');
    wait(16 * MINUTE);
    assert.equal(el.title, 'Job · 17 Nov 2026, 10:15:00 – running for 1 minute');
    assert.equal(el.style.width, '16.7px');
  });

  test('say how long they have run in the story card, kept current', () => {
    const timeline = running([job()]);
    timeline.select('job');
    assert.match(
      timeline.storyEl.innerHTML,
      /<span class="ck-running-text" data-id="job">17 Nov 2026, 09:45:00 – running for 15 minutes<\/span>/,
    );
    // The stand-in DOM doesn't find elements in markup; hand the timer the span.
    const span = { dataset: { id: 'job' }, textContent: '' };
    timeline.storyEl.querySelectorAll = (selector) => (selector === '.ck-running-text' ? [span] : []);
    mock.timers.tick(SECOND);
    assert.equal(span.textContent, '17 Nov 2026, 09:45:00 – running for 15 minutes, 1 second');
  });

  test('keep their lane to themselves until they end', () => {
    // Without running, the job's bar ends at 09:47 and the deploy fits after it.
    const deploy = { id: 'deploy', title: 'Deploy', start: '2026-11-17T09:50:00Z' };
    const timeline = running([job(), deploy]);
    assert.equal(laneOf(timeline, 'job'), 0);
    assert.equal(laneOf(timeline, 'deploy'), 1);
    timeline.updateEvent('job', { end: '2026-11-17T09:47:00Z', running: false });
    dom.frame();
    assert.equal(laneOf(timeline, 'deploy'), 0);
  });

  test('keep their lane when events arrive after where they reached when packed', () => {
    // Packed at 10:00; at 10:05 an alert starts at 10:02, on the grown bar.
    const timeline = running([job()]);
    wait(5 * MINUTE);
    timeline.addEvents({ id: 'alert', title: 'Alert', start: '2026-11-17T10:02:00Z' });
    dom.frame();
    assert.equal(laneOf(timeline, 'alert'), 1);
  });

  test('stop growing once closed', () => {
    const timeline = running([job()]);
    timeline.updateEvent('job', { end: '2026-11-17T10:00:00Z', running: false });
    dom.frame();
    const el = button(timeline, 'job');
    assert.doesNotMatch(el.className, /ck-running/);
    assert.equal(el.title, 'Job · 17 Nov 2026, 09:45:00 – 17 Nov 2026, 10:00:00');
    wait(10 * MINUTE);
    assert.equal(el.style.width, '250.0px');
  });

  test('closed without an end become a point at their start', () => {
    const timeline = running([job()]);
    timeline.updateEvent('job', { running: false });
    dom.frame();
    assert.match(button(timeline, 'job').className, /\bck-point\b/);
    assert.equal(timeline.items[0].to, null);
  });

  test('stay running through a patch that leaves running alone', () => {
    const timeline = running([job()]);
    timeline.updateEvent('job', { title: 'Nightly job' });
    wait(MINUTE);
    const el = button(timeline, 'job');
    assert.match(el.className, /ck-running/);
    assert.equal(el.title, 'Nightly job · 17 Nov 2026, 09:45:00 – running for 16 minutes');
  });

  test('count to now for fit()', () => {
    const timeline = running([job({ start: '2026-11-17T08:00:00Z' })], NOW - 5 * HOUR, NOW - 4 * HOUR);
    timeline.fit();
    assert.ok(timeline.start <= NOW - 2 * HOUR && timeline.end >= NOW, `${timeline.start} – ${timeline.end}`);
  });

  test('cannot have an end, naming the event', () => {
    assert.throws(() => running([job({ end: '2026-11-17T10:00:00Z' })]), {
      message: 'Chroniko: event "Job" is running and has an end; set running: false when it ends',
    });
    const timeline = running([job()]);
    assert.throws(() => timeline.updateEvent('job', { end: '2026-11-17T10:00:00Z' }), {
      message: 'Chroniko: event "Job" is running and has an end; set running: false when it ends',
    });
    assert.equal(timeline.items[0].running, true);
  });

  test('need running to be true or false', () => {
    assert.throws(() => running([job({ running: 'yes' })]), {
      message: 'Chroniko: event "Job" has an invalid running: must be true or false, not "yes"',
    });
  });

  test('need the clock scale', () => {
    assert.throws(() => new Chroniko(dom.container, { events: [{ title: 'Siege', start: 1453, running: true }] }), {
      message: "Chroniko: event \"Siege\" is running, which needs timeScale: 'clock'",
    });
  });

  test('running: false is an ordinary event', () => {
    const timeline = running([job({ running: false })]);
    assert.match(button(timeline, 'job').className, /\bck-point\b/);
  });

  test('stop updating their text while the page is hidden, and catch up when shown', () => {
    const timeline = running([job()]);
    const el = button(timeline, 'job');
    dom.document.hidden = true;
    mock.timers.tick(SECOND);
    mock.timers.tick(5 * SECOND);
    assert.equal(el.title, 'Job · 17 Nov 2026, 09:45:00 – running for 15 minutes, 1 second');
    assert.equal(timeline._runningTimer, 0);
    dom.document.hidden = false;
    dom.document.fire('visibilitychange');
    mock.timers.tick(SECOND);
    assert.equal(el.title, 'Job · 17 Nov 2026, 09:45:00 – running for 15 minutes, 7 seconds');
  });

  test('stop the text timer when none are left, and on destroy', () => {
    const timeline = running([job()]);
    timeline.removeEvents('job');
    mock.timers.tick(SECOND);
    assert.equal(timeline._runningTimer, 0);
    const other = running([job()]);
    other._renderRunningText = () => assert.fail('the text timer ran after destroy()');
    other.destroy();
    mock.timers.tick(5 * SECOND);
  });

  test('are translated, and uiText can replace the text', () => {
    const japanese = running([job()], undefined, undefined, { language: 'ja' });
    assert.match(button(japanese, 'job').title, /・進行中（15分）$/);
    const custom = running([job()], undefined, undefined, { uiText: { runningFor: (date, d) => `${date} (${d} so far)` } });
    assert.equal(button(custom, 'job').title, 'Job · 17 Nov 2026, 09:45:00 (15 minutes so far)');
  });
});

// A parameter of the URL hash, or null.
const param = (k) => new URLSearchParams(dom.location.hash.slice(1)).get(k);

describe('following in the URL hash', () => {
  test('stores the span as ck-live instead of ck-view', () => {
    // Opening the page writes nothing; following does.
    const timeline = following({ syncUrl: true, follow: false });
    timeline.follow();
    mock.timers.tick(250);
    assert.equal(param('ck-live'), String(10 * MINUTE));
    assert.equal(param('ck-view'), null);
  });

  test('is not rewritten as time passes', () => {
    const timeline = following({ syncUrl: true });
    timeline.zoomBy(0.5);
    dom.frame();
    mock.timers.tick(250);
    const hash = dom.location.hash;
    assert.equal(param('ck-live'), String(5 * MINUTE));
    wait(MINUTE);
    mock.timers.tick(250);
    assert.equal(dom.location.hash, hash);
  });

  test('goes back to ck-view when following stops, and to ck-live when it starts', () => {
    const timeline = following({ syncUrl: true });
    timeline.panBy(-100);
    mock.timers.tick(250);
    assert.equal(param('ck-live'), null);
    assert.equal(param('ck-view'), `${timeline.start},${timeline.end}`);
    clickLive(timeline);
    mock.timers.tick(250);
    assert.equal(param('ck-live'), String(10 * MINUTE));
    assert.equal(param('ck-view'), null);
  });

  test('a ck-live link opens following now at that span', () => {
    dom.location.hash = `#ck-live=${5 * MINUTE}&ck-tz=UTC`;
    const timeline = clock(NOW - 2 * HOUR, NOW - HOUR, { syncUrl: true });
    assert.equal(timeline.isFollowing(), true);
    assert.deepEqual(viewOf(timeline), [NOW - 4.75 * MINUTE, NOW + 0.25 * MINUTE]);
    // Opening the page doesn't rewrite its URL.
    mock.timers.tick(250);
    assert.equal(dom.location.hash, `#ck-live=${5 * MINUTE}&ck-tz=UTC`);
  });

  test('ck-live wins over ck-view', () => {
    dom.location.hash = `#ck-view=${NOW - 2 * HOUR},${NOW - HOUR}&ck-live=${5 * MINUTE}`;
    const timeline = clock(NOW - 2 * HOUR, NOW - HOUR, { syncUrl: true });
    assert.equal(timeline.isFollowing(), true);
    assert.equal(spanOf(timeline), 5 * MINUTE);
  });

  test('a ck-view link stops a page that follows by default', () => {
    dom.location.hash = `#ck-view=${NOW - 2 * HOUR},${NOW - HOUR}`;
    const timeline = following({ syncUrl: true });
    assert.equal(timeline.isFollowing(), false);
    assert.deepEqual(viewOf(timeline), [NOW - 2 * HOUR, NOW - HOUR]);
  });

  test('a ck-live it cannot read is ignored', () => {
    for (const live of ['0', '-5', 'abc', '', 'Infinity']) {
      dom.location.hash = `#ck-view=${NOW - 2 * HOUR},${NOW - HOUR}&ck-live=${live}`;
      const timeline = clock(NOW - 3 * HOUR, NOW, { syncUrl: true });
      assert.equal(timeline.isFollowing(), false, live);
      assert.deepEqual(viewOf(timeline), [NOW - 2 * HOUR, NOW - HOUR], live);
      timeline.destroy();
    }
  });

  test('the historical scale ignores ck-live', () => {
    dom.location.hash = '#ck-live=300000';
    const timeline = new Chroniko(dom.container, {
      events: [{ title: 'Black Death', start: 1347, end: 1351 }],
      start: 1300,
      end: 1400,
      syncUrl: true,
    });
    assert.deepEqual(viewOf(timeline), [1300, 1400]);
    assert.equal(timeline.getState().following, undefined);
  });
});

describe('following in getState and setState', () => {
  test('getState says whether the view is following', () => {
    const timeline = following();
    assert.equal(timeline.getState().following, true);
    timeline.follow(false);
    assert.equal(timeline.getState().following, false);
  });

  test('setState following: true follows at the current span, false stops', () => {
    const timeline = following({ follow: false });
    timeline.setState({ following: true });
    dom.frame();
    assert.equal(timeline.isFollowing(), true);
    assert.deepEqual(viewOf(timeline), [NOW - 9.5 * MINUTE, NOW + 0.5 * MINUTE]);
    timeline.setState({ following: false });
    assert.equal(timeline.isFollowing(), false);
    assert.deepEqual(timeline.calls, [true, false]);
  });

  test("with a view and following: true, follows at the view's span", () => {
    const timeline = following({ follow: false });
    timeline.setState({ start: NOW - 2 * HOUR, end: NOW - HOUR, following: true });
    dom.frame();
    assert.equal(timeline.isFollowing(), true);
    assert.deepEqual(viewOf(timeline), [NOW - 57 * MINUTE, NOW + 3 * MINUTE]);
  });

  test('a view without following stops following, as before', () => {
    const timeline = following();
    timeline.setState({ start: NOW - 2 * HOUR, end: NOW - HOUR });
    assert.equal(timeline.isFollowing(), false);
  });

  test('a getState() result restores following', () => {
    const timeline = following();
    const state = timeline.getState();
    timeline.panBy(-100);
    timeline.setState(state);
    assert.equal(timeline.isFollowing(), true);
  });

  test('following must be true or false, and checked before anything changes', () => {
    const timeline = following({ follow: false });
    assert.throws(() => timeline.setState({ start: NOW - 2 * HOUR, end: NOW - HOUR, following: 'yes' }), {
      message: 'Chroniko: setState following must be true or false, got "yes"',
    });
    assert.deepEqual(viewOf(timeline), [NOW - 20 * MINUTE, NOW - 10 * MINUTE]);
  });

  test('following needs the clock scale', () => {
    const timeline = new Chroniko(dom.container, { events: [{ title: 'Black Death', start: 1347 }] });
    assert.throws(() => timeline.setState({ following: false }), {
      message: "Chroniko: setState following needs timeScale: 'clock'",
    });
  });
});

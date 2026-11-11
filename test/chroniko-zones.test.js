// Time zones on the Chroniko class itself: the timeZone and timeZones
// options, setTimeZone, the toolbar toggle, getState/setState and the URL
// hash. The class needs a browser, so these run on a stand-in for one (see
// support/fake-dom.js). The zone maths is covered in zone.test.js and
// clock.test.js.
//
// The machine is in Hong Kong: GMT+8 all year, so local time is never UTC.

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Chroniko } from '../src/chroniko.js';
import { installDom } from './support/fake-dom.js';

const utc = (s) => Date.parse(s);

const originalTZ = process.env.TZ;
before(() => {
  process.env.TZ = 'Asia/Hong_Kong';
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

let dom;
beforeEach(() => {
  dom = installDom();
});

// A timed range, an all-day event and an exact instant.
const events = () => [
  { id: 'deploy', title: 'Deploy', start: '2026-11-04T09:00', end: '2026-11-04T09:30', category: 'deploy' },
  { id: 'oncall', title: 'On-call', start: '2026-11-04', end: '2026-11-04', category: 'job' },
  { id: 'beat', title: 'Heartbeat', start: '2026-11-04T12:00Z' },
];

// A clock timeline that records its onTimeZoneChange calls in timeline.calls.
function clock(options = {}) {
  const calls = [];
  const timeline = new Chroniko(dom.container, {
    timeScale: 'clock',
    events: events(),
    onTimeZoneChange: (tz) => calls.push(tz),
    ...options,
  });
  timeline.calls = calls;
  return timeline;
}

const item = (timeline, id) => timeline.items.find((it) => it.id === id);
const span = (timeline, id) => [item(timeline, id).from, item(timeline, id).to];
const positions = (timeline) => timeline.items.map((it) => [it.id, it.from, it.to]);

// The axis labels, after letting the timeline render.
function axisLabels(timeline) {
  dom.frame();
  return [...timeline.axisEl.innerHTML.matchAll(/>([^<]*)<\/span>/g)].map((m) => m[1]);
}

// An event's tooltip, after letting the timeline render.
function tooltip(timeline, title) {
  dom.frame();
  return new RegExp(`title="(${title} · [^"]*)"`).exec(timeline.lanesEl.innerHTML)?.[1];
}

const clickToggle = (timeline) =>
  timeline.root.querySelector('.ck-controls').fire('click', {
    target: { closest: () => ({ dataset: { action: 'time-zone' } }) },
  });

describe('the timeZone option', () => {
  test('is local time by default', () => {
    const timeline = clock();
    assert.equal(timeline.getTimeZone(), 'local');
    assert.equal(timeline.getState().timeZone, 'local');
    assert.deepEqual(span(timeline, 'deploy'), [utc('2026-11-04T01:00Z'), utc('2026-11-04T01:30Z')]);
    assert.deepEqual(timeline.calls, []);
  });

  test('UTC reads offset-free strings in UTC', () => {
    const timeline = clock({ timeZone: 'UTC' });
    assert.equal(timeline.getTimeZone(), 'UTC');
    assert.equal(timeline.getState().timeZone, 'UTC');
    assert.deepEqual(span(timeline, 'deploy'), [utc('2026-11-04T09:00Z'), utc('2026-11-04T09:30Z')]);
    // A date-only range covers the whole UTC day.
    assert.deepEqual(span(timeline, 'oncall'), [utc('2026-11-04T00:00Z'), utc('2026-11-05T00:00Z')]);
    // Exact inputs don't depend on the zone.
    assert.equal(item(timeline, 'beat').from, utc('2026-11-04T12:00Z'));
    // The option itself isn't a change.
    assert.deepEqual(timeline.calls, []);
  });

  test('throws for a zone that is not local or UTC', () => {
    for (const timeZone of ['Asia/Tokyo', 'utc', '', 8]) {
      assert.throws(() => clock({ timeZone }), /timeZone must be 'local' or 'UTC'.*IANA time zones/);
    }
  });

  test('throws on the historical scale, which has no zone', () => {
    const historical = (options) => new Chroniko(dom.container, { events: [{ title: 'A', start: 1300 }], ...options });
    assert.throws(() => historical({ timeZone: 'UTC' }), /timeZone needs timeScale: 'clock'/);
    assert.throws(() => historical({ timeZones: ['local', 'UTC'] }), /timeZones needs timeScale: 'clock'/);
    const timeline = historical();
    assert.equal(timeline.getTimeZone(), null);
    assert.equal('timeZone' in timeline.getState(), false);
    assert.throws(() => timeline.setTimeZone('UTC'), /setTimeZone needs timeScale: 'clock'/);
    assert.throws(() => timeline.setState({ timeZone: 'UTC' }), /setTimeZone needs timeScale: 'clock'/);
  });
});

describe('setTimeZone', () => {
  test('moves no event and keeps the view', () => {
    const timeline = clock();
    const before = { ...timeline.getState(), positions: positions(timeline) };
    timeline.setTimeZone('UTC');
    assert.equal(timeline.getTimeZone(), 'UTC');
    assert.deepEqual({ ...timeline.getState(), positions: positions(timeline) }, { ...before, timeZone: 'UTC' });
  });

  test('calls onTimeZoneChange once per change', () => {
    const timeline = clock();
    timeline.setTimeZone('UTC');
    timeline.setTimeZone('UTC'); // no change
    timeline.setTimeZone('local');
    assert.deepEqual(timeline.calls, ['UTC', 'local']);
  });

  test('throws for an unknown zone and changes nothing', () => {
    const timeline = clock();
    assert.throws(() => timeline.setTimeZone('Asia/Tokyo'), /timeZone must be 'local' or 'UTC'/);
    assert.equal(timeline.getTimeZone(), 'local');
    assert.deepEqual(timeline.calls, []);
  });

  test('labels the axis again in the new zone', () => {
    const timeline = clock();
    timeline.zoomTo('2026-11-04T00:00', '2026-11-05T00:00'); // the local day
    assert.deepEqual(axisLabels(timeline), ['4 Nov', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '5 Nov']);
    assert.equal(timeline.zoneEl.textContent, 'GMT+8');

    timeline.setTimeZone('UTC'); // the same view is 16:00 to 16:00 in UTC
    assert.deepEqual(axisLabels(timeline), ['18:00', '21:00', '4 Nov', '03:00', '06:00', '09:00', '12:00', '15:00']);
    assert.equal(timeline.zoneEl.textContent, 'UTC');
  });

  test('shows times in the new zone in tooltips and the story', () => {
    const timeline = clock();
    timeline.select('deploy');
    assert.equal(tooltip(timeline, 'Deploy'), 'Deploy · 4 Nov 2026, 09:00 – 4 Nov 2026, 09:30');
    assert.match(timeline.storyEl.innerHTML, /4 Nov 2026, 09:00 – 4 Nov 2026, 09:30/);

    timeline.setTimeZone('UTC');
    assert.equal(tooltip(timeline, 'Deploy'), 'Deploy · 4 Nov 2026, 01:00 – 4 Nov 2026, 01:30');
    assert.match(timeline.storyEl.innerHTML, /4 Nov 2026, 01:00 – 4 Nov 2026, 01:30/);
  });

  test('a date-only event shows its time once it is in another zone', () => {
    const timeline = clock();
    timeline.select('oncall');
    assert.equal(tooltip(timeline, 'On-call'), 'On-call · 4 Nov 2026 – 4 Nov 2026');

    // Hong Kong's 4 November runs from 16:00 UTC on the 3rd to 16:00 on the 4th.
    timeline.setTimeZone('UTC');
    assert.equal(tooltip(timeline, 'On-call'), 'On-call · 3 Nov 2026, 16:00 – 4 Nov 2026, 16:00');
    assert.match(timeline.storyEl.innerHTML, /3 Nov 2026, 16:00 – 4 Nov 2026, 16:00/);

    timeline.setTimeZone('local');
    assert.equal(tooltip(timeline, 'On-call'), 'On-call · 4 Nov 2026 – 4 Nov 2026');
  });

  test('events added afterwards are read in the new zone', () => {
    const timeline = clock();
    timeline.setTimeZone('UTC');
    timeline.addEvents({ id: 'late', title: 'Late', start: '2026-11-04T09:00' });
    assert.equal(item(timeline, 'late').from, utc('2026-11-04T09:00Z'));
    // The one added in local time stays where it was.
    assert.equal(item(timeline, 'deploy').from, utc('2026-11-04T01:00Z'));
  });
});

describe('updateEvent after a zone switch', () => {
  test('keeps the dates the patch leaves alone', () => {
    const timeline = clock();
    const before = [span(timeline, 'deploy'), span(timeline, 'oncall')];
    timeline.setTimeZone('UTC');
    timeline.updateEvent('deploy', { title: 'Deploy api' });
    timeline.updateEvent('oncall', { description: 'All day' });
    assert.deepEqual([span(timeline, 'deploy'), span(timeline, 'oncall')], before);
    assert.equal(item(timeline, 'deploy').event.title, 'Deploy api');
  });

  test('reads the dates in the patch in the new zone', () => {
    const timeline = clock();
    timeline.setTimeZone('UTC');
    timeline.updateEvent('deploy', { end: '2026-11-04T10:00' });
    // The start was read in local time, the new end in UTC.
    assert.deepEqual(span(timeline, 'deploy'), [utc('2026-11-04T01:00Z'), utc('2026-11-04T10:00Z')]);
    timeline.updateEvent('oncall', { start: '2026-11-04' });
    assert.deepEqual(span(timeline, 'oncall'), [utc('2026-11-04T00:00Z'), utc('2026-11-04T16:00Z')]);
  });

  test('removes an end, and still needs a start', () => {
    const timeline = clock();
    timeline.setTimeZone('UTC');
    timeline.updateEvent('deploy', { end: undefined });
    assert.deepEqual(span(timeline, 'deploy'), [utc('2026-11-04T01:00Z'), null]);
    assert.throws(() => timeline.updateEvent('deploy', { start: undefined }), /event "Deploy" has no start date/);
    assert.equal(item(timeline, 'deploy').from, utc('2026-11-04T01:00Z'));
  });
});

describe('the timeZones option', () => {
  test('shows no toggle when omitted', () => {
    const timeline = clock();
    assert.doesNotMatch(timeline.root.innerHTML, /data-action="time-zone"/);
    assert.equal(timeline.zoneToggleEl, null);
    timeline.setTimeZone('UTC'); // still works without the button
    assert.equal(timeline.getTimeZone(), 'UTC');
  });

  test('adds a toggle that shows the zone in use', () => {
    const timeline = clock({ timeZones: ['local', 'UTC'] });
    assert.match(timeline.root.innerHTML, /data-action="time-zone"/);
    assert.equal(timeline.zoneToggleEl.textContent, 'Local time');
    assert.equal(timeline.zoneToggleEl.getAttribute('aria-label'), 'Local time (time zone). Switch to UTC');
  });

  test('the toggle switches to the next zone and wraps around', () => {
    const timeline = clock({ timeZones: ['local', 'UTC'] });
    clickToggle(timeline);
    assert.equal(timeline.getTimeZone(), 'UTC');
    assert.equal(timeline.zoneToggleEl.textContent, 'UTC');
    assert.equal(timeline.zoneToggleEl.getAttribute('aria-label'), 'UTC (time zone). Switch to Local time');
    clickToggle(timeline);
    assert.equal(timeline.getTimeZone(), 'local');
    assert.equal(timeline.zoneToggleEl.textContent, 'Local time');
    assert.deepEqual(timeline.calls, ['UTC', 'local']);
  });

  test('the toggle follows setTimeZone and the timeZone option', () => {
    const timeline = clock({ timeZones: ['local', 'UTC'], timeZone: 'UTC' });
    assert.equal(timeline.zoneToggleEl.textContent, 'UTC');
    timeline.setTimeZone('local');
    assert.equal(timeline.zoneToggleEl.textContent, 'Local time');
    assert.equal(timeline.zoneToggleEl.getAttribute('aria-label'), 'Local time (time zone). Switch to UTC');
  });

  test('the toggle is translated, and uiText can replace its text', () => {
    const chinese = clock({ timeZones: ['local', 'UTC'], language: 'zh-Hant' });
    assert.equal(chinese.zoneToggleEl.textContent, '本地時間');
    assert.equal(chinese.zoneToggleEl.getAttribute('aria-label'), '時區：本地時間。切換至UTC');
    const custom = clock({ timeZones: ['local', 'UTC'], uiText: { localTime: 'Your time' } });
    assert.equal(custom.zoneToggleEl.textContent, 'Your time');
    assert.equal(custom.zoneToggleEl.getAttribute('aria-label'), 'Your time (time zone). Switch to UTC');
  });

  test('throws unless it lists two or more different zones', () => {
    for (const timeZones of ['UTC', [], ['UTC']]) {
      assert.throws(() => clock({ timeZones }), /timeZones must be an array of at least two time zones/);
    }
    assert.throws(() => clock({ timeZones: ['UTC', 'local', 'UTC'] }), /timeZones lists "UTC" more than once/);
    assert.throws(() => clock({ timeZones: ['local', 'Asia/Tokyo'] }), /timeZone must be 'local' or 'UTC'/);
  });
});

describe('setState with a time zone', () => {
  test('restores the zone', () => {
    const timeline = clock();
    timeline.setState({ timeZone: 'UTC' });
    assert.equal(timeline.getTimeZone(), 'UTC');
    assert.deepEqual(timeline.calls, ['UTC']);
  });

  test('reads string dates in the zone of the state', () => {
    const timeline = clock();
    timeline.setState({ timeZone: 'UTC', start: '2026-11-04', end: '2026-11-05' });
    assert.deepEqual([timeline.start, timeline.end], [utc('2026-11-04T00:00Z'), utc('2026-11-05T00:00Z')]);
    // Without a zone in the state, the zone in use reads them.
    timeline.setState({ start: '2026-11-04T06:00', end: '2026-11-04T18:00' });
    assert.deepEqual([timeline.start, timeline.end], [utc('2026-11-04T06:00Z'), utc('2026-11-04T18:00Z')]);
  });

  test('a getState() result puts everything back', () => {
    const timeline = clock();
    timeline.setTimeZone('UTC');
    timeline.zoomTo('2026-11-04T00:00', '2026-11-04T12:00');
    timeline.select('deploy');
    const saved = timeline.getState();

    const other = clock();
    other.setState(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(other.getState(), saved);
  });

  test('a state that throws changes nothing', () => {
    const timeline = clock();
    const before = timeline.getState();
    const bad = [
      [{ timeZone: 'UTC', start: 'nope', end: '2026-11-05' }, /setState start is invalid: cannot parse time "nope"/],
      [{ timeZone: 'UTC', start: '2026-11-05', end: '2026-11-04' }, /setState start \(2026-11-05\) must be before setState end \(2026-11-04\)/],
      [{ timeZone: 'Asia/Tokyo', hidden: ['job'] }, /timeZone must be 'local' or 'UTC'/],
      [{ timeZone: 'UTC', start: '2026-11-04', end: '2026-11-05', hidden: 'job' }, TypeError],
      [{ timeZone: 'UTC', selected: 5 }, TypeError],
    ];
    for (const [state, error] of bad) {
      assert.throws(() => timeline.setState(state), error);
      assert.deepEqual(timeline.getState(), before);
      assert.deepEqual(timeline.calls, []);
    }
  });
});

describe('errors for a bad range name the caller', () => {
  test('zoomTo', () => {
    const timeline = clock();
    assert.throws(() => timeline.zoomTo('nope', '2026-11-05'), /^Error: Chroniko: zoomTo start is invalid: cannot parse time "nope"$/);
    assert.throws(() => timeline.zoomTo('2026-11-04'), /^Error: Chroniko: zoomTo end is missing$/);
    assert.throws(
      () => timeline.zoomTo('2026-11-05', '2026-11-04'),
      /^Error: Chroniko: zoomTo start \(2026-11-05\) must be before zoomTo end \(2026-11-04\)$/,
    );
  });

  test('the start and end options', () => {
    assert.throws(() => clock({ start: '2026-11-04', end: 'x' }), /^Error: Chroniko: the end option is invalid: cannot parse time "x"$/);
    assert.throws(
      () => new Chroniko(dom.container, { start: 1500, end: 1300 }),
      /^Error: Chroniko: the start option \(1500\) must be before the end option \(1300\)$/,
    );
  });
});

describe('the URL hash', () => {
  // The hash is written 250 ms after a change.
  const synced = (t, options) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    return clock({ syncUrl: true, ...options });
  };
  const param = (key) => new RegExp(`[#&]${key}=([^&]*)`).exec(dom.location.hash)?.[1];

  test('loading the page does not write the hash', (t) => {
    synced(t);
    t.mock.timers.tick(1000);
    assert.equal(dom.location.hash, '');
  });

  test('stores the zone as ck-tz, local time included', (t) => {
    const timeline = synced(t);
    timeline.zoomTo('2026-11-04T00:00', '2026-11-05T00:00');
    t.mock.timers.tick(250);
    assert.equal(param('ck-tz'), 'local');
    timeline.setTimeZone('UTC');
    t.mock.timers.tick(250);
    assert.equal(param('ck-tz'), 'UTC');
    assert.equal(param('ck-view'), `${utc('2026-11-03T16:00Z')},${utc('2026-11-04T16:00Z')}`);
  });

  test('a link opens in the zone of its sender', (t) => {
    dom.location.hash = `#ck-view=${utc('2026-11-04T00:00Z')},${utc('2026-11-04T12:00Z')}&ck-tz=UTC&ck-sel=deploy`;
    const timeline = synced(t, { timeZones: ['local', 'UTC'] });
    assert.deepEqual(timeline.getState(), {
      start: utc('2026-11-04T00:00Z'),
      end: utc('2026-11-04T12:00Z'),
      selected: ['deploy'],
      hidden: [],
      timeZone: 'UTC',
    });
    assert.equal(timeline.zoneToggleEl.textContent, 'UTC');
    // Called during construction, like onSelectionChange.
    assert.deepEqual(timeline.calls, ['UTC']);
    // The events were added before the hash was read, in the page's own zone.
    assert.equal(item(timeline, 'deploy').from, utc('2026-11-04T01:00Z'));
  });

  test('a zone it does not know is ignored', (t) => {
    for (const tz of ['Asia%2FTokyo', 'utc', '%E0%A4%A']) {
      dom.location.hash = `#ck-tz=${tz}&ck-sel=deploy`;
      const timeline = synced(t, { timeZone: 'UTC' });
      assert.equal(timeline.getTimeZone(), 'UTC');
      assert.deepEqual(timeline.getState().selected, ['deploy']); // the rest still applies
      assert.deepEqual(timeline.calls, []);
      t.mock.timers.reset();
    }
  });

  test('a hash change on an open page switches the zone', (t) => {
    const timeline = synced(t);
    dom.location.hash = '#ck-tz=UTC';
    dom.window.fire('hashchange');
    assert.equal(timeline.getTimeZone(), 'UTC');
    assert.deepEqual(timeline.calls, ['UTC']);
    // A hash without ck-tz keeps the zone in use.
    dom.location.hash = '#ck-sel=deploy';
    dom.window.fire('hashchange');
    assert.equal(timeline.getTimeZone(), 'UTC');
  });

  test('the historical scale has no ck-tz', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const timeline = new Chroniko(dom.container, { events: [{ title: 'A', start: 1300, end: 1500 }], syncUrl: true });
    timeline.zoomTo(1200, 1600);
    t.mock.timers.tick(250);
    assert.equal(param('ck-view'), '1200,1600');
    assert.equal(param('ck-tz'), undefined);
  });
});

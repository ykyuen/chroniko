// The Chroniko class on the historical scale: events and their ids and
// colors, selection, the view, getState/setState, the URL hash and lane
// packing. The class needs a browser, so these run on a stand-in for one (see
// support/fake-dom.js); what needs real layout, pointers or focus isn't
// covered here. Time zones are in chroniko-zones.test.js.

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Chroniko } from '../src/chroniko.js';
import { installDom, clickOn } from './support/fake-dom.js';

let dom;
beforeEach(() => {
  dom = installDom();
});

// Two given ids and two generated ones (science-2 and war-3), out of order.
const events = () => [
  { title: 'Fall of Constantinople', start: '1453-05-29', category: 'war', tags: ['Byzantium'] },
  { id: 'hyw', title: "Hundred Years' War", start: '1337', end: '1453', category: 'war', tags: ['France', 'England'] },
  { title: 'Printing press', start: '1440', category: 'science' },
  { id: 'plague', title: 'Black Death', start: '1347', end: '1351', category: 'disease', tags: ['France'] },
];

// A timeline that records its onSelectionChange calls, as lists of ids, in
// timeline.calls.
function make(options = {}) {
  const calls = [];
  const timeline = new Chroniko(dom.container, {
    events: events(),
    onSelectionChange: (selected) => calls.push(selected.map((e) => e.id ?? e.title)),
    ...options,
  });
  timeline.calls = calls;
  return timeline;
}

const ids = (timeline) => timeline.items.map((it) => it.id);
const item = (timeline, id) => timeline.items.find((it) => it.id === id);
const colors = (timeline) => Object.fromEntries(timeline.items.map((it) => [it.id, it.color]));
const lanes = (timeline) => Object.fromEntries(timeline.items.map((it) => [it.id, it.lane]));
const view = (timeline) => [timeline.start, timeline.end];
const selectedIds = (timeline) => timeline.getState().selected;

describe('the constructor', () => {
  test('throws for a missing container or a bad option', () => {
    assert.throws(() => new Chroniko(null), /container not found/);
    assert.throws(() => make({ timeScale: 'hours' }), /timeScale must be 'historical' or 'clock', got "hours"/);
    assert.throws(() => make({ storyPosition: 'left' }), /storyPosition must be 'below' or 'right', got "left"/);
    assert.throws(() => make({ split: 1 }), /split must be a number between 0 and 1, got 1/);
    assert.throws(() => make({ language: 'xx' }), /language must be one of 'en'.*got "xx"/);
  });

  test('fits all events, or shows the start and end options', () => {
    // 1337 to the end of 1453, with room for labels on the right.
    const span = 1454 - 1337;
    assert.deepEqual(view(make()), [1337 - span * 0.04, 1454 + span * 0.12]);
    assert.deepEqual(view(make({ start: 1300, end: '1500' })), [1300, 1500]);
    assert.deepEqual(view(make({ events: [] })), [0, 2000]);
  });
});

describe('setEvents', () => {
  test('puts events in start order and gives ids to those without one', () => {
    const timeline = make();
    assert.deepEqual(ids(timeline), ['hyw', 'plague', 'science-2', 'war-0']);
  });

  test('generated ids use the category and the position in the array', () => {
    const timeline = make({
      events: [
        { title: 'A', start: 1 },
        { title: 'B', start: 2, category: '  Olympic   Game ' },
        { title: 'C', start: 3, id: 7 },
      ],
    });
    assert.deepEqual(ids(timeline), ['event-0', 'olympic-game-1', '7']);
  });

  test('a range end covers its whole last year', () => {
    const timeline = make();
    assert.deepEqual([item(timeline, 'hyw').from, item(timeline, 'hyw').to], [1337, 1454]);
    assert.equal(item(timeline, 'science-2').to, null);
  });

  test('throws, naming the event, and leaves the timeline unchanged', () => {
    const timeline = make();
    const before = ids(timeline);
    const bad = [
      [[{ title: 'A', start: 1 }, null], /event 1 passed to setEvents must be an object, not null/],
      [['A'], /event 0 passed to setEvents must be an object, not a string/],
      [[{ title: 'No start' }], /event "No start" has no start date/],
      [[{ title: 'Bad', start: '1453-13' }], /event "Bad" has an invalid start: invalid date/],
      [[{ title: 'Bad end', start: 1, end: 'soon' }], /event "Bad end" has an invalid end: cannot parse date/],
      [[{ id: 'x', title: 'A', start: 1 }, { id: 'x', title: 'B', start: 2 }], /events "A" and "B" share the id "x"; ids must be unique/],
    ];
    for (const [list, error] of bad) {
      assert.throws(() => timeline.setEvents(list), error);
      assert.deepEqual(ids(timeline), before);
    }
  });

  test('keeps the selection of events that are still there', () => {
    const timeline = make();
    timeline.select('hyw');
    timeline.select('plague');
    timeline.calls.length = 0;

    timeline.setEvents(events()); // the same ids
    assert.deepEqual(selectedIds(timeline), ['hyw', 'plague']);
    assert.deepEqual(timeline.calls, []);

    timeline.setEvents(events().filter((e) => e.id !== 'plague'));
    assert.deepEqual(selectedIds(timeline), ['hyw']);
    assert.deepEqual(timeline.calls, [['hyw']]);
  });
});

describe('addEvents', () => {
  test('takes one event or an array and returns the ids', () => {
    const timeline = make();
    assert.deepEqual(timeline.addEvents({ id: 'joan', title: 'Joan of Arc', start: '1429' }), ['joan']);
    assert.deepEqual(timeline.addEvents([{ id: 'b', title: 'B', start: 1500 }, { id: 'a', title: 'A', start: 1300 }]), ['a', 'b']);
    assert.deepEqual(ids(timeline), ['a', 'hyw', 'plague', 'joan', 'science-2', 'war-0', 'b']);
  });

  test('continues the id numbering, also after removals', () => {
    const timeline = make();
    assert.deepEqual(timeline.addEvents({ title: 'Agincourt', start: '1415', category: 'war' }), ['war-4']);
    timeline.removeEvents(['war-4', 'war-0']);
    assert.deepEqual(timeline.addEvents([{ title: 'A', start: 1 }, { title: 'B', start: 2, category: 'war' }]), ['event-5', 'war-6']);
    assert.deepEqual(ids(timeline), ['event-5', 'war-6', 'hyw', 'plague', 'science-2']);
  });

  test('adds none of the events if one is invalid', () => {
    const timeline = make();
    const before = ids(timeline);
    const bad = [
      [[{ title: 'Good', start: 1400 }, { title: 'Bad', start: 'x' }], /event "Bad" has an invalid start/],
      [[{ title: 'Good', start: 1400 }, 5], /event 1 passed to addEvents must be an object, not a number/],
      [{ id: 'hyw', title: 'Again', start: 1400 }, /events "Hundred Years' War" and "Again" share the id "hyw"/],
      [null, /event 0 passed to addEvents must be an object, not null/],
    ];
    for (const [list, error] of bad) {
      assert.throws(() => timeline.addEvents(list), error);
      assert.deepEqual(ids(timeline), before);
    }
    // The failed calls used up no numbers.
    assert.deepEqual(timeline.addEvents({ title: 'Next', start: 1400 }), ['event-4']);
  });

  test('keeps the view and the selection', () => {
    const timeline = make();
    timeline.zoomTo(1300, 1500);
    timeline.select('hyw');
    timeline.calls.length = 0;
    timeline.addEvents({ title: 'Moon landing', start: '1969-07-20' });
    assert.deepEqual(view(timeline), [1300, 1500]);
    assert.deepEqual(selectedIds(timeline), ['hyw']);
    assert.deepEqual(timeline.calls, []);
  });

  test('raises the default maxSpan as the data grows', () => {
    const timeline = make();
    timeline.zoomTo(0, 2000); // 3× the 117 years of data
    assert.equal(timeline.end - timeline.start, 117 * 3);
    timeline.addEvents({ title: 'Moon landing', start: 1969 }); // now 632 years of data
    timeline.zoomTo(0, 1800);
    assert.deepEqual(view(timeline), [0, 1800]);
  });

  test('redraws the legend once, on the next frame', () => {
    const timeline = make();
    dom.frame();
    timeline.addEvents({ title: 'A', start: 1400, category: 'art' });
    timeline.addEvents({ title: 'B', start: 1410, category: 'music' });
    assert.doesNotMatch(timeline.legendEl.innerHTML, /art|music/);
    dom.frame();
    assert.match(timeline.legendEl.innerHTML, /data-category="art"/);
    assert.match(timeline.legendEl.innerHTML, /data-category="music"/);
  });
});

describe('updateEvent', () => {
  test('merges the patch into the event', () => {
    const timeline = make();
    timeline.updateEvent('plague', { title: 'The Black Death', end: '1353', description: 'A pandemic' });
    const { event, to } = item(timeline, 'plague');
    assert.deepEqual(event, {
      id: 'plague',
      title: 'The Black Death',
      start: '1347',
      end: '1353',
      category: 'disease',
      tags: ['France'],
      description: 'A pandemic',
    });
    assert.equal(to, 1354);
    timeline.updateEvent('plague', { end: undefined });
    assert.equal(item(timeline, 'plague').to, null);
  });

  test('moves the event when its start changes', () => {
    const timeline = make();
    timeline.updateEvent('hyw', { start: '1445' });
    assert.deepEqual(ids(timeline), ['plague', 'science-2', 'hyw', 'war-0']);
  });

  test('keeps the id, the selection and the view', () => {
    const timeline = make();
    timeline.zoomTo(1300, 1500);
    timeline.select('science-2');
    timeline.calls.length = 0;
    timeline.updateEvent('science-2', { id: 'science-2', title: 'Movable type', category: 'technology' });
    assert.deepEqual(selectedIds(timeline), ['science-2']);
    assert.deepEqual(timeline.getSelection().map((e) => e.title), ['Movable type']);
    assert.deepEqual(view(timeline), [1300, 1500]);
    assert.deepEqual(timeline.calls, []);
  });

  test('throws and leaves the event as it was', () => {
    const timeline = make();
    const before = { ...item(timeline, 'plague').event };
    const bad = [
      [['nobody', { title: 'X' }], /updateEvent found no event with the id "nobody"/],
      [['plague', null], /the patch passed to updateEvent must be an object, not null/],
      [['plague', [{ title: 'X' }]], /the patch passed to updateEvent must be an object, not an array/],
      [['plague', { id: 'pest' }], /updateEvent cannot change the id of "plague"; remove the event and add it again/],
      [['plague', { start: '1347-02-30' }], /event "Black Death" has an invalid start: invalid date/],
      [['plague', { start: undefined }], /event "Black Death" has no start date/],
    ];
    for (const [args, error] of bad) {
      assert.throws(() => timeline.updateEvent(...args), error);
      assert.deepEqual(item(timeline, 'plague').event, before);
    }
  });
});

describe('removeEvents', () => {
  test('takes one id or an array and ignores unknown ids', () => {
    const timeline = make();
    timeline.removeEvents('plague');
    timeline.removeEvents(['hyw', 'nobody']);
    timeline.removeEvents('nobody');
    assert.deepEqual(ids(timeline), ['science-2', 'war-0']);
  });

  test('removed events leave the selection', () => {
    const timeline = make();
    timeline.select('hyw');
    timeline.select('plague');
    timeline.calls.length = 0;

    timeline.removeEvents('science-2'); // not selected
    assert.deepEqual(timeline.calls, []);
    timeline.removeEvents('hyw');
    assert.deepEqual(selectedIds(timeline), ['plague']);
    assert.deepEqual(timeline.calls, [['plague']]);
  });
});

describe('colors', () => {
  const PALETTE = ['#4e79a7', '#e15759', '#59a14f', '#f28e2b'];

  test('categories take palette colors in order of appearance', () => {
    const timeline = make();
    assert.deepEqual(colors(timeline), { hyw: PALETTE[0], plague: PALETTE[1], 'science-2': PALETTE[2], 'war-0': PALETTE[0] });
  });

  test('the colors option and an event color come first', () => {
    const timeline = make({
      colors: { war: '#c0392b', science: PALETTE[0] },
      events: [...events(), { id: 'own', title: 'Own', start: 1400, category: 'war', color: 'gold' }],
    });
    // The palette color taken by the option isn't handed out again.
    assert.deepEqual(colors(timeline), { hyw: '#c0392b', plague: PALETTE[1], own: 'gold', 'science-2': PALETTE[0], 'war-0': '#c0392b' });
  });

  test('a category keeps its color when the events change', () => {
    const timeline = make();
    timeline.addEvents({ id: 'art', title: 'Art', start: 1300, category: 'art' }); // before every other event
    assert.equal(item(timeline, 'art').color, PALETTE[3]);
    assert.equal(item(timeline, 'hyw').color, PALETTE[0]);

    timeline.removeEvents(['hyw', 'war-0']);
    timeline.setEvents([
      { id: 'new', title: 'New', start: 1200, category: 'music' },
      { id: 'war', title: 'War', start: 1300, category: 'war' },
      { id: 'sci', title: 'Science', start: 1400, category: 'science' },
    ]);
    assert.deepEqual(colors(timeline), { new: '#b07aa1', war: PALETTE[0], sci: PALETTE[2] });
  });
});

describe('selection', () => {
  test('select, deselect, toggle and clearSelection', () => {
    const timeline = make();
    timeline.select('plague');
    timeline.select('hyw');
    timeline.toggle('science-2');
    timeline.toggle('plague');
    timeline.deselect('hyw');
    timeline.select('war-0');
    timeline.clearSelection();
    assert.deepEqual(timeline.calls, [
      ['plague'],
      ['hyw', 'plague'], // in chronological order, not the order selected
      ['hyw', 'plague', 'Printing press'],
      ['hyw', 'Printing press'],
      ['Printing press'],
      ['Printing press', 'Fall of Constantinople'],
      [],
    ]);
  });

  test('calls that change nothing are ignored', () => {
    const timeline = make();
    timeline.select('hyw');
    timeline.select('hyw');
    timeline.select('nobody');
    timeline.deselect('plague');
    timeline.toggle('nobody');
    assert.deepEqual(timeline.calls, [['hyw']]);
    timeline.clearSelection();
    timeline.clearSelection();
    assert.deepEqual(timeline.calls, [['hyw'], []]);
  });

  test('ids are compared as strings', () => {
    const timeline = make({ events: [{ id: 7, title: 'Seven', start: 1 }] });
    timeline.select('7');
    timeline.deselect(7);
    timeline.toggle(7);
    assert.deepEqual(selectedIds(timeline), ['7']);
  });

  test('getSelection returns the event objects in chronological order', () => {
    const list = events();
    const timeline = make({ events: list });
    timeline.select('war-0');
    timeline.select('hyw');
    assert.deepEqual(timeline.getSelection(), [list[1], list[0]]);
  });

  test('the story lists selected events with their dates and durations', () => {
    const timeline = make();
    assert.equal(timeline.storyEl.hidden, true);
    timeline.select('hyw');
    timeline.select('war-0');
    assert.equal(timeline.storyEl.hidden, false);
    const story = timeline.storyEl.innerHTML;
    assert.match(story, /1337 – 1453/);
    assert.match(story, /lasted 116 years/);
    assert.match(story, /29 May 1453/);
    // A range's end marker comes after its own card.
    assert.ok(story.indexOf('data-id="hyw" tabindex') < story.indexOf('ck-end-date'));
  });

  test('clicks select events, and Clear all and Escape clear', () => {
    const timeline = make();
    clickOn(timeline.viewport, '.ck-event', { id: 'hyw' });
    clickOn(timeline.viewport, '.ck-event', { id: 'plague' });
    clickOn(timeline.viewport, '.ck-event', { id: 'hyw' });
    assert.deepEqual(selectedIds(timeline), ['plague']);
    clickOn(timeline.storyEl, '.ck-clear');
    assert.deepEqual(selectedIds(timeline), []);
    timeline.select('hyw');
    clickOn(timeline.storyEl, '.ck-remove', { id: 'hyw' });
    assert.deepEqual(selectedIds(timeline), []);
    timeline.select('hyw');
    timeline.viewport.fire('keydown', { key: 'Escape', preventDefault() {} });
    assert.deepEqual(selectedIds(timeline), []);
  });

  test('a tag selects every event with it, then deselects them', () => {
    const timeline = make();
    timeline.select('science-2');
    clickOn(timeline.tagbarEl, '.ck-tag', { tag: 'France' });
    assert.deepEqual(selectedIds(timeline), ['hyw', 'plague', 'science-2']);
    clickOn(timeline.tagbarEl, '.ck-tag', { tag: 'France' });
    assert.deepEqual(selectedIds(timeline), ['science-2']);
    // Partly selected counts as off: the click selects the rest.
    timeline.select('hyw');
    clickOn(timeline.tagbarEl, '.ck-tag', { tag: 'France' });
    assert.deepEqual(selectedIds(timeline), ['hyw', 'plague', 'science-2']);
  });
});

describe('hidden categories', () => {
  test('the legend hides and shows a category', () => {
    const timeline = make();
    dom.frame();
    assert.match(timeline.lanesEl.innerHTML, /Black Death/);

    clickOn(timeline.legendEl, '.ck-legend-item', { category: 'disease' });
    dom.frame();
    assert.deepEqual(timeline.getState().hidden, ['disease']);
    assert.doesNotMatch(timeline.lanesEl.innerHTML, /Black Death/);
    assert.match(timeline.lanesEl.innerHTML, /Printing press/);

    clickOn(timeline.legendEl, '.ck-legend-item', { category: 'disease' });
    dom.frame();
    assert.deepEqual(timeline.getState().hidden, []);
    assert.match(timeline.lanesEl.innerHTML, /Black Death/);
  });

  test('reveal shows a hidden event and centers it', () => {
    const timeline = make();
    timeline.zoomTo(1300, 1400);
    timeline.setState({ hidden: ['science', 'war'] });

    timeline.reveal('science-2'); // a point keeps the zoom
    assert.deepEqual(timeline.getState().hidden, ['war']);
    assert.deepEqual(view(timeline), [1390, 1490]);

    timeline.reveal('hyw'); // a range fills the middle 60%
    assert.deepEqual(timeline.getState().hidden, []);
    const span = (1454 - 1337) / 0.6;
    assert.deepEqual(view(timeline), [1395.5 - span / 2, 1395.5 + span / 2]);

    timeline.reveal('nobody');
    assert.deepEqual(view(timeline), [1395.5 - span / 2, 1395.5 + span / 2]);
  });
});

describe('the view', () => {
  test('zoomTo clamps the span around the middle of the range', () => {
    const timeline = make({ minSpan: 10, maxSpan: 400 });
    timeline.zoomTo(1400, 1402);
    assert.deepEqual(view(timeline), [1396, 1406]);
    timeline.zoomTo(1000, 2000);
    assert.deepEqual(view(timeline), [1300, 1700]);
    timeline.zoomTo('1300', '1500-07');
    assert.deepEqual(view(timeline), [1300, 1500.5]);
  });

  test('zoomBy zooms around a point across the width', () => {
    const timeline = make({ maxSpan: 1000 });
    timeline.zoomTo(1300, 1500);
    timeline.zoomBy(0.5);
    assert.deepEqual(view(timeline), [1350, 1450]);
    timeline.zoomBy(2, 0); // the left edge stays
    assert.deepEqual(view(timeline), [1350, 1550]);
    timeline.zoomBy(100, 1); // clamped to maxSpan; the right edge stays
    assert.deepEqual(view(timeline), [550, 1550]);
  });

  test('panBy moves by pixels of the 1000px viewport', () => {
    const timeline = make();
    timeline.zoomTo(1300, 1500); // 5px a year
    timeline.panBy(100);
    assert.deepEqual(view(timeline), [1320, 1520]);
    timeline.panBy(-250);
    assert.deepEqual(view(timeline), [1270, 1470]);
  });

  test('the toolbar and keyboard zoom, pan and fit', () => {
    const timeline = make();
    const fitted = view(timeline);
    const controls = timeline.root.querySelector('.ck-controls');
    const key = (k) => timeline.viewport.fire('keydown', { key: k, preventDefault() {} });

    timeline.zoomTo(1300, 1500);
    const spanIs = (years) => assert.ok(Math.abs(timeline.end - timeline.start - years) < 1e-9);
    clickOn(controls, 'button', { action: 'zoom-in' });
    spanIs(200 / 1.5);
    clickOn(controls, 'button', { action: 'zoom-out' });
    spanIs(200);
    timeline.zoomTo(1300, 1500);
    key('ArrowRight'); // a tenth of the width
    assert.deepEqual(view(timeline), [1320, 1520]);
    key('ArrowLeft');
    assert.deepEqual(view(timeline), [1300, 1500]);
    clickOn(controls, 'button', { action: 'fit' });
    assert.deepEqual(view(timeline), fitted);
  });
});

describe('getState and setState', () => {
  test('a saved state puts everything back', () => {
    const timeline = make();
    timeline.zoomTo(1300, 1500);
    timeline.select('war-0');
    timeline.select('hyw');
    timeline.setState({ hidden: ['science'] });
    const saved = timeline.getState();
    assert.deepEqual(saved, { start: 1300, end: 1500, selected: ['hyw', 'war-0'], hidden: ['science'] });

    const other = make();
    other.setState(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(other.getState(), saved);
    assert.deepEqual(other.calls, [['hyw', 'Fall of Constantinople']]);
  });

  test('a partial state changes only what it names', () => {
    const timeline = make();
    timeline.zoomTo(1300, 1500);
    timeline.select('hyw');
    timeline.setState({ hidden: ['war'] });
    assert.deepEqual(timeline.getState(), { start: 1300, end: 1500, selected: ['hyw'], hidden: ['war'] });
    timeline.setState({ selected: ['plague', 'nobody', 7] }); // unknown ids are ignored
    assert.deepEqual(timeline.getState(), { start: 1300, end: 1500, selected: ['plague'], hidden: ['war'] });
    timeline.setState({ start: 1400 }); // a view needs both ends
    timeline.setState();
    assert.deepEqual(view(timeline), [1300, 1500]);
  });
});

describe('the URL hash', () => {
  // The hash is written 250 ms after a change.
  const synced = (t, options) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    return make({ syncUrl: true, ...options });
  };

  test('is not written without syncUrl, or by loading the page', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    make().zoomTo(1300, 1500);
    make({ syncUrl: true });
    t.mock.timers.tick(1000);
    assert.equal(dom.location.hash, '');
  });

  test('holds the view, the selection and the hidden categories', (t) => {
    const timeline = synced(t);
    timeline.zoomTo(1300, 1500);
    t.mock.timers.tick(250);
    assert.equal(dom.location.hash, '#ck-view=1300,1500');

    timeline.select('plague');
    timeline.select('hyw');
    timeline.setState({ hidden: ['science'] });
    t.mock.timers.tick(249);
    assert.equal(dom.location.hash, '#ck-view=1300,1500'); // one write for the three changes
    t.mock.timers.tick(1);
    assert.equal(dom.location.hash, '#ck-view=1300,1500&ck-sel=hyw,plague&ck-hide=science');

    timeline.clearSelection();
    t.mock.timers.tick(250);
    assert.equal(dom.location.hash, '#ck-view=1300,1500&ck-hide=science');
  });

  test('keeps the view to about a thousandth of its span', (t) => {
    const timeline = synced(t);
    timeline.zoomTo(1400.123456789, 1401.123456789);
    t.mock.timers.tick(250);
    assert.equal(dom.location.hash, '#ck-view=1400.123,1401.123');
  });

  test('encodes ids and keeps other parameters', (t) => {
    dom.location.hash = '#section&lang=fr';
    const timeline = synced(t, { events: [{ id: 'a,b c&d', title: 'Odd id', start: 1400 }] });
    timeline.select('a,b c&d');
    t.mock.timers.tick(250);
    assert.match(dom.location.hash, /^#section&lang=fr&ck-view=[\d.]+,[\d.]+&ck-sel=a%2Cb%20c%26d$/);

    // And reads it back.
    const other = make({ syncUrl: true, events: [{ id: 'a,b c&d', title: 'Odd id', start: 1400 }] });
    assert.deepEqual(selectedIds(other), ['a,b c&d']);
  });

  test('a link restores the state during construction', (t) => {
    dom.location.hash = '#ck-view=1300,1500&ck-sel=plague,nobody,hyw&ck-hide=science';
    const timeline = synced(t);
    assert.deepEqual(timeline.getState(), { start: 1300, end: 1500, selected: ['hyw', 'plague'], hidden: ['science'] });
    assert.deepEqual(timeline.calls, [['hyw', 'plague']]);
  });

  test('a view that makes no sense is ignored', (t) => {
    const fitted = view(make());
    for (const bad of ['1500,1300', '1300', 'a,b', '1300,1300', '1300,1400,1500', '']) {
      dom.location.hash = `#ck-view=${bad}&ck-sel=hyw`;
      const timeline = synced(t);
      assert.deepEqual(view(timeline), fitted);
      assert.deepEqual(selectedIds(timeline), ['hyw']); // the rest still applies
      t.mock.timers.reset();
    }
  });

  test('a broken escape in a list reads as an empty list', (t) => {
    dom.location.hash = '#ck-view=1300,1500&ck-sel=%E0%A4%A&ck-hide=%';
    const timeline = synced(t);
    assert.deepEqual(timeline.getState(), { start: 1300, end: 1500, selected: [], hidden: [] });
  });

  test('a hash change on an open page applies, until destroy()', (t) => {
    const timeline = synced(t);
    dom.location.hash = '#ck-view=1300,1500&ck-sel=hyw';
    dom.window.fire('hashchange');
    assert.deepEqual(timeline.getState(), { start: 1300, end: 1500, selected: ['hyw'], hidden: [] });

    timeline.destroy();
    dom.location.hash = '#ck-view=1400,1450';
    dom.window.fire('hashchange');
    assert.deepEqual(view(timeline), [1300, 1500]);
    // Nothing is written after destroy() either.
    t.mock.timers.tick(1000);
    assert.equal(dom.location.hash, '#ck-view=1400,1450');
  });
});

// Lane packing, at 1px a year: the view is 1000 to 2000 on the 1000px
// viewport. A point takes 5px before its year, then a 10px dot, 6px, its
// label (7px a character here) and a 12px gap; a range takes its bar or its
// label, whichever is longer, and the gap.
describe('lanes', () => {
  const at = (options) => make({ start: 1000, end: 2000, maxSpan: 5000, ...options });
  const point = (id, start, title = 'AAAA') => ({ id, title, start });

  test('events share a lane when they fit one after another', () => {
    const timeline = at({
      events: [
        point('a', 1000), // takes 995 to 1051
        point('b', 1040), // overlaps a: lane 1, to 1091
        point('c', 1056), // starts at 1051, so it fits after a: lane 0, to 1107
        { id: 'd', title: 'AAAA', start: 1060, end: 1199 }, // overlaps b and c: lane 2
        point('e', 1217), // the first lane that is free again is lane 0
        { id: 'f', title: 'A long label on a short bar', start: 1100, end: 1100 }, // fits after b: lane 1
      ],
    });
    dom.frame();
    assert.deepEqual(lanes(timeline), { a: 0, b: 1, c: 0, d: 2, f: 1, e: 0 });
  });

  test('hidden categories take no lane', () => {
    const list = [
      { ...point('a', 1000), category: 'x' },
      { ...point('b', 1010), category: 'y' },
      { ...point('c', 1020), category: 'x' },
    ];
    const timeline = at({ events: list });
    dom.frame();
    assert.deepEqual(lanes(timeline), { a: 0, b: 1, c: 2 });
    timeline.setState({ hidden: ['y'] });
    dom.frame();
    assert.deepEqual(lanes(timeline), { a: 0, b: -1, c: 1 });
  });

  // Starts and lengths from a fixed sequence, so every run packs the same events.
  const many = () => {
    let seed = 7;
    const next = (n) => (seed = (seed * 16807) % 2147483647) % n;
    return Array.from({ length: 60 }, (unused, i) => {
      const start = 1000 + next(1000);
      const title = 'x'.repeat(1 + next(12));
      return next(3) ? { id: `e${i}`, title, start } : { id: `e${i}`, title, start, end: start + next(120) };
    });
  };

  test('events added in time order go into the lanes already shown', () => {
    const sorted = many().sort((a, b) => a.start - b.start);
    const whole = at({ events: sorted });
    dom.frame();

    const grown = at({ events: sorted.slice(0, 20) });
    dom.frame();
    const early = lanes(grown);
    // Count full repacks: appending must not need one.
    let repacks = 0;
    const layout = grown._layout;
    grown._layout = function (scale) {
      repacks += 1;
      return layout.call(this, scale);
    };
    for (const event of sorted.slice(20)) grown.addEvents(event);
    dom.frame();

    assert.equal(repacks, 0);
    assert.deepEqual(lanes(grown), lanes(whole));
    for (const [id, lane] of Object.entries(early)) assert.equal(lanes(grown)[id], lane);
  });

  test('an earlier event, an update or a removal packs the lanes again', () => {
    const list = many();
    const whole = at({ events: list });
    dom.frame();

    // Added latest first, so every add comes before the events already there.
    const sorted = [...list].sort((a, b) => b.start - a.start);
    const grown = at({ events: sorted.slice(0, 20) });
    dom.frame();
    for (const event of sorted.slice(20)) grown.addEvents(event);
    dom.frame();
    assert.deepEqual(lanes(grown), lanes(whole));

    // The same events after a change must match a fresh timeline with them.
    const changed = list.map((e) => (e.id === 'e5' ? { ...e, start: 1500, end: 1900 } : e)).filter((e) => e.id !== 'e9');
    grown.updateEvent('e5', { start: 1500, end: 1900 });
    grown.removeEvents('e9');
    dom.frame();
    const fresh = at({ events: changed });
    dom.frame();
    assert.deepEqual(lanes(grown), lanes(fresh));
  });
});

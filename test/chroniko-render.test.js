// How the lanes are drawn: each event on screen keeps one button from render
// to render, so the button under the pointer survives a view that moves every
// frame. Runs on the stand-in browser (see support/fake-dom.js), whose
// viewport is 1000px wide.

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Chroniko } from '../src/chroniko.js';
import { installDom } from './support/fake-dom.js';

let dom;
beforeEach(() => {
  dom = installDom();
});

const events = () => [
  { id: 'hyw', title: "Hundred Years' War", start: 1337, end: 1453, category: 'war' },
  { id: 'plague', title: 'Black Death', start: 1347, end: 1351, category: 'disease' },
  { id: 'press', title: 'Printing press', start: 1440, category: 'science' },
  { id: 'columbus', title: 'Columbus reaches America', start: 1492, category: 'science' },
];

function make(options = {}) {
  const timeline = new Chroniko(dom.container, { events: events(), start: 1300, end: 1500, ...options });
  dom.frame();
  return timeline;
}

const buttons = (timeline) => timeline.lanesEl.querySelectorAll('.ck-event');
const button = (timeline, id) => buttons(timeline).find((b) => b.dataset.id === id);
const order = (timeline) => buttons(timeline).map((b) => b.dataset.id);
// How far the lanes are moved left: buttons sit at lane positions, and the
// lanes container is moved by this shift, so on screen x = lane x - shift.
const shiftOf = (timeline) => 0 - Number(/translateX\(([-\d.]+)px\)/.exec(timeline._lanesInner.style.transform)?.[1] ?? 0);
const onScreen = (timeline, el) => `${(parseFloat(el.style.left) - shiftOf(timeline)).toFixed(1)}px`;

describe('lane buttons', () => {
  test('one per event on screen, in the events’ order', () => {
    const timeline = make();
    assert.deepEqual(order(timeline), ['hyw', 'plague', 'press', 'columbus']);
    const plague = button(timeline, 'plague');
    assert.equal(plague.type, 'button');
    assert.equal(plague.className, 'ck-event ck-range');
    assert.equal(plague.getAttribute('aria-pressed'), 'false');
    assert.equal(plague.title, 'Black Death · 1347 – 1351');
    assert.equal(plague.style['--ck-color'], timeline.colorOf.get('disease'));
    assert.deepEqual([plague.style.left, plague.style.width], ['235.0px', '25.0px']);
  });

  test('stay the same elements while the view moves every frame', () => {
    const timeline = make();
    const before = buttons(timeline);
    for (let i = 0; i < 10; i++) {
      timeline.panBy(1);
      dom.frame();
    }
    assert.deepEqual(buttons(timeline), before);
    // The buttons keep their lane positions; only the lanes move, by 10px.
    assert.equal(button(timeline, 'plague').style.left, '235.0px');
    assert.equal(shiftOf(timeline), 10);
    assert.equal(onScreen(timeline, button(timeline, 'plague')), '225.0px');
  });

  test("keep a bar's label at the view's left edge while the bar starts before it", () => {
    const timeline = make();
    timeline.panBy(300); // the view is [1360, 1560]
    dom.frame();
    const hyw = button(timeline, 'hyw');
    const label = hyw.childNodes[0];
    // The bar starts at lane x 185 (1337), 300px left of the view's edge is
    // at 300; its label sits LABEL_PAD (6px) inside the edge.
    assert.equal(hyw.style.left, '185.0px');
    assert.equal(label.style.left, '121.0px');
    assert.equal(parseFloat(onScreen(timeline, hyw)) + parseFloat(label.style.left), 6);
  });

  test('are placed again from a new origin after a zoom', () => {
    const timeline = make();
    timeline.panBy(100);
    dom.frame();
    timeline.zoomBy(0.5, 0);
    dom.frame();
    // The view is [1320, 1420]: 10px a year, the origin at its start.
    assert.equal(shiftOf(timeline), 0);
    assert.equal(button(timeline, 'plague').style.left, '270.0px');
  });

  test('are placed again from a new origin once the view has moved far', () => {
    const timeline = make({ events: [...events(), { id: 'late', title: 'Late', start: 2400 }], maxSpan: 5000 });
    timeline.panBy(4000);
    dom.frame();
    assert.equal(shiftOf(timeline), 4000);
    timeline.panBy(50_000);
    dom.frame();
    // 54,000px from the first origin: past ORIGIN_DRIFT_PX, so it starts again.
    assert.equal(shiftOf(timeline), 0);
    assert.deepEqual([timeline.start, timeline.end], [1300 + 54_000 / 5, 1500 + 54_000 / 5]);
  });

  test('stay the same elements when events are added, updated or selected', () => {
    const timeline = make();
    const plague = button(timeline, 'plague');
    timeline.addEvents({ id: 'joan', title: 'Joan of Arc', start: 1429, category: 'war' });
    timeline.updateEvent('plague', { title: 'The Black Death' });
    timeline.select('plague');
    dom.frame();
    assert.equal(button(timeline, 'plague'), plague);
    assert.equal(plague.title, 'The Black Death · 1347 – 1351');
    assert.equal(plague.className, 'ck-event ck-range ck-selected');
    assert.equal(plague.getAttribute('aria-pressed'), 'true');
  });

  test('show a selection at once, without waiting for a render', () => {
    const timeline = make();
    timeline.select('press');
    assert.equal(button(timeline, 'press').getAttribute('aria-pressed'), 'true');
    assert.ok(button(timeline, 'press').classList.contains('ck-selected'));
  });

  test('go when their event leaves the view, and come back in order', () => {
    const timeline = make();
    timeline.zoomTo(1460, 1500);
    dom.frame();
    assert.deepEqual(order(timeline), ['columbus']);
    timeline.zoomTo(1300, 1500);
    dom.frame();
    assert.deepEqual(order(timeline), ['hyw', 'plague', 'press', 'columbus']);
  });

  test('go when their event is removed or its category hidden', () => {
    const timeline = make();
    timeline.removeEvents('press');
    timeline.setState({ hidden: ['war'] });
    dom.frame();
    assert.deepEqual(order(timeline), ['plague', 'columbus']);
  });

  test('keep the events’ order when an earlier event is added', () => {
    const timeline = make();
    const columbus = button(timeline, 'columbus');
    timeline.addEvents({ id: 'joan', title: 'Joan of Arc', start: 1429, category: 'war' });
    dom.frame();
    assert.deepEqual(order(timeline), ['hyw', 'plague', 'joan', 'press', 'columbus']);
    assert.equal(button(timeline, 'columbus'), columbus);
  });

  test('follow an event that moves past another', () => {
    const timeline = make();
    timeline.updateEvent('press', { start: 1300 });
    dom.frame();
    assert.deepEqual(order(timeline), ['press', 'hyw', 'plague', 'columbus']);
  });

  test('a point gets a dot, which it loses when it gets an end', () => {
    const timeline = make();
    const press = button(timeline, 'press');
    assert.deepEqual(press.childNodes.map((n) => n.className), ['ck-dot', 'ck-label']);
    assert.equal(press.childNodes[1].textContent, 'Printing press');
    timeline.updateEvent('press', { end: 1450 });
    dom.frame();
    assert.equal(button(timeline, 'press'), press);
    assert.deepEqual(press.childNodes.map((n) => n.className), ['ck-label']);
    assert.equal(press.className, 'ck-event ck-range');
    assert.equal(press.childNodes[0].style.left, '6.0px');
  });

  test('a focused button that leaves the view hands focus to the timeline', () => {
    const timeline = make();
    let focused = null;
    timeline.viewport.focus = () => (focused = timeline.viewport);
    globalThis.document.activeElement = button(timeline, 'hyw');
    timeline.zoomTo(1460, 1500);
    dom.frame();
    assert.equal(focused, timeline.viewport);
  });

  test('the lanes are as tall as the lanes in use', () => {
    const timeline = make();
    const inner = timeline.lanesEl.childNodes[0];
    assert.equal(inner.className, 'ck-lanes-inner');
    assert.equal(inner.style.height, `${12 * 2 + timeline._laneCount * 30}px`);
  });
});

// Count writes to an element's innerHTML, keeping what is written.
function countWrites(el) {
  let html = el.innerHTML;
  const counter = { writes: 0 };
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set: (v) => {
      counter.writes += 1;
      html = v;
    },
  });
  return counter;
}

describe('work skipped while events stream in', () => {
  test('the legend is written only when it changes', () => {
    const timeline = make();
    const legend = countWrites(timeline.legendEl);
    timeline.addEvents({ title: 'Joan of Arc', start: 1429, category: 'war' });
    dom.frame();
    assert.equal(legend.writes, 0);
    timeline.addEvents({ title: 'Magna Carta', start: 1215, category: 'law' });
    dom.frame();
    assert.equal(legend.writes, 1);
    assert.match(timeline.legendEl.innerHTML, /data-category="law"/);
  });

  test('tag counts are updated in place, and the tag bar is rebuilt only for a new tag', () => {
    const timeline = make({ events: [{ title: 'A', start: 1340, tags: ['France'] }] });
    const tags = countWrites(timeline.tagbarEl.querySelector('.ck-tags'));
    // The stand-in DOM doesn't find elements in markup; hand it the count span.
    const span = { textContent: '1' };
    timeline.tagbarEl.querySelectorAll = (selector) => (selector === '.ck-tag-count' ? [span] : []);
    timeline.addEvents({ title: 'B', start: 1350, tags: ['France'] });
    dom.frame();
    assert.equal(tags.writes, 0);
    assert.equal(span.textContent, '2');
    timeline.addEvents({ title: 'C', start: 1360, tags: ['England'] });
    dom.frame();
    assert.equal(tags.writes, 1);
    assert.match(timeline.tagbarEl.querySelector('.ck-tags').innerHTML, /England <span class="ck-tag-count">1<\/span>.*France <span class="ck-tag-count">2<\/span>/s);
  });

  test("the label font is read when every label is measured, not for each added event", () => {
    const timeline = make({ textSizeToggle: true });
    let reads = 0;
    const read = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (...args) => {
      reads += 1;
      return read(...args);
    };
    try {
      timeline.addEvents({ title: 'Joan of Arc', start: 1429 });
      timeline.updateEvent('plague', { title: 'The Black Death' });
      assert.equal(reads, 0);
      assert.equal(timeline.items.find((it) => it.id === 'plague').labelWidth, 'The Black Death'.length * 7);
      timeline.setEvents(events());
      assert.equal(reads, 1);
      timeline.root.querySelector('.ck-controls').fire('click', {
        target: { closest: () => ({ dataset: { action: 'text-size' }, setAttribute() {} }) },
      });
      assert.equal(reads, 2);
    } finally {
      globalThis.getComputedStyle = read;
    }
  });

  test('the axis and grid move with the lanes, and are rewritten only when the ticks change', () => {
    // Ticks every 20 years, at 1320 to 1500: the view starts between ticks.
    const timeline = make({ start: 1305, end: 1505 });
    const axis = countWrites(timeline._axisInner);
    const grid = countWrites(timeline._gridInner);
    timeline.panBy(1);
    dom.frame();
    assert.deepEqual([axis.writes, grid.writes], [0, 0]);
    assert.equal(timeline._axisInner.style.transform, 'translateX(-1px)');
    assert.equal(timeline._gridInner.style.transform, 'translateX(-1px)');
    // Panning 100px (20 years) takes 1320 out of view and brings 1520 in.
    timeline.panBy(100);
    dom.frame();
    assert.deepEqual([axis.writes, grid.writes], [1, 1]);
  });
});

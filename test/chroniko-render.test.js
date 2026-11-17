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
    assert.equal(button(timeline, 'plague').style.left, '225.0px');
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

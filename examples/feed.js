// A made-up feed of deploys, jobs, errors and alerts for the live example.
// scripts/serve.js sends it over Server-Sent Events at /events; the page
// runs it itself when that endpoint isn't there. It uses only setTimeout and
// Math.random, so it runs the same in Node and in the browser.
//
// send(op, data) gets each change: ('add', event) or ('update', { id, patch }).
// Deploys, jobs and some alerts are added running, and updated with
// { end, running: false } when they finish.

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const services = ['api', 'web', 'worker', 'billing', 'search'];
const jobs = ['Sync invoices', 'Rebuild search index', 'Send digest emails', 'Rotate logs', 'Refresh cache'];
const errors = ['500 on /checkout', 'Timeout calling payments', 'Null pointer in worker', 'Rate limit exceeded', 'DB connection reset'];
const alerts = ['p99 latency above 800 ms', 'CPU above 90%', 'Queue depth above 1k', 'Disk 85% full'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.random() * (max - min);
// The wait before the next event, for on average `rate` events a second.
const gap = (rate) => (-Math.log(1 - Math.random()) / rate) * SECOND;

/**
 * Start a feed sending on average `rate` events a second (0 sends none, but
 * still finishes those running), after `history` ms of past events, so a
 * timeline doesn't start empty. Returns { setRate(rate), stop() }.
 */
export function createFeed(send, { rate = 2, history = 5 * MINUTE } = {}) {
  // Ids are unique to this feed (ev-k3x9-1, ev-k3x9-2, …), so a page that
  // reconnects to a new feed never gets an id it already has.
  const feedId = Math.random().toString(36).slice(2, 6);
  let count = 0;
  let timer = 0;
  const open = new Map(); // id → the timer that finishes it

  // Something that started at `at` and lasts `ms`: running until it ends.
  // One that has already ended is added with its end.
  function ranged(event, at, ms) {
    const end = Math.round(at + ms);
    if (end <= Date.now()) return send('add', { ...event, start: at, end });
    send('add', { ...event, start: at, running: true });
    open.set(event.id, setTimeout(() => {
      open.delete(event.id);
      send('update', { id: event.id, patch: { end, running: false } });
    }, end - Date.now()));
  }

  function emit(at = Date.now()) {
    at = Math.round(at);
    const id = `ev-${feedId}-${++count}`;
    const service = pick(services);
    const roll = Math.random();
    if (roll < 0.12) {
      ranged({ id, title: `Deploy ${service} v${Math.floor(between(1, 4))}.${Math.floor(between(0, 30))}`,
        category: 'deploy', tags: [service] }, at, between(20, 90) * SECOND);
    } else if (roll < 0.4) {
      ranged({ id, title: pick(jobs), category: 'job', tags: [service] }, at, between(5, 60) * SECOND);
    } else if (roll < 0.8) {
      send('add', { id, title: pick(errors), start: at, category: 'error', tags: [service] });
    } else if (roll < 0.9) {
      ranged({ id, title: pick(alerts), category: 'alert', tags: [service] }, at, between(10, 40) * SECOND);
    } else {
      send('add', { id, title: pick(alerts), start: at, category: 'alert', tags: [service] });
    }
  }

  function next() {
    clearTimeout(timer);
    if (!(rate > 0)) return;
    timer = setTimeout(() => {
      emit();
      next();
    }, gap(rate));
  }

  if (rate > 0) {
    for (let at = Date.now() - history + gap(rate); at < Date.now(); at += gap(rate)) emit(at);
  }
  next();

  return {
    setRate(r) {
      rate = r;
      next();
    },
    stop() {
      clearTimeout(timer);
      open.forEach((t) => clearTimeout(t));
      open.clear();
    },
  };
}

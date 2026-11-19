// Copyright 2026 Ying Kit Yuen <yingkityuen@gmail.com>
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Chroniko: render historical events on a single zoomable time axis.
//
// Dates are converted to numbers ("values") by the timeline's scale, which
// also draws the axis and writes dates and durations; see src/scales/.

import LOCALES from './locales/index.js';
import historical, { parseDate, dateText, durationText } from './scales/historical.js';
import { clockScale, parseTime, timeText, timeDurationText } from './scales/clock.js';
import { zoneNamed } from './zone.js';

const SCALES = ['historical', 'clock'];

export { parseDate, parseTime };

const PALETTE = ['#4e79a7', '#e15759', '#59a14f', '#f28e2b', '#b07aa1', '#76b7b2', '#edc948', '#9c755f'];
const MIN_TICK_GAP = 90; // px between axis labels
const LANE_HEIGHT = 30; // px, matches .ck-event height + spacing in CSS
const LANE_TOP = 12; // px above the first lane
const DOT = 10; // px, point marker diameter
const LABEL_PAD = 6; // px between marker and label
const LANE_GAP = 12; // px kept free after a label before the next event in the lane
const FLASH_MS = 1500; // matches the .ck-event.ck-flash animation in CSS
const NOW_STEP_PX = 0.5; // px the "now" line may fall behind before it is moved
const NOW_MAX_WAIT = 60_000; // ms between checks of the "now" line, at most
const FOLLOW_MARGIN = 0.05; // share of the view kept after now while following
const RUNNING_TEXT_MS = 1000; // ms between updates of "running for …" text
const MAX_TIMEOUT = 2 ** 31 - 1; // ms, the longest wait setTimeout allows

// The UI text for a language: the built-in locale over English (so a key it
// lacks still has text), then the caller's overrides, plus the language's
// number and plural rules. Built-in languages are cached, since the exported
// formatters below look them up on every call.
const messageCache = new Map();

function messagesFor(language, overrides) {
  if (!Object.hasOwn(LOCALES, language)) {
    const valid = Object.keys(LOCALES).map((l) => `'${l}'`).join(', ');
    throw new Error(`Chroniko: language must be one of ${valid}, got ${JSON.stringify(language)}`);
  }
  if (!overrides && messageCache.has(language)) return messageCache.get(language);
  const m = {
    ...LOCALES.en,
    ...LOCALES[language],
    ...overrides,
    language,
    number: new Intl.NumberFormat(language),
    plural: new Intl.PluralRules(language),
  };
  if (!overrides) messageCache.set(language, m);
  return m;
}

/** A year in the given language, e.g. formatYear(-221) → "221 BCE". */
export function formatYear(year, language = 'en') {
  return messagesFor(language).year(year);
}

/**
 * A parseDate() or parseTime() result in the given language, e.g.
 * "19 Mar 1644" or "28 Oct 2026, 10:30".
 */
export function formatDate(d, language = 'en') {
  return (d.scale === 'clock' ? timeText : dateText)(d, messagesFor(language));
}

/**
 * How long a range lasted, e.g. "116 years", "2 years, 11 months" or
 * "2 hours, 5 minutes", at the coarser precision of its two dates and in at
 * most two adjacent units. Both dates come from parseDate(), or both from
 * parseTime(). There is no year zero: 1 BCE (year -1) is followed by 1 CE, so
 * 27 BCE to 14 CE is 40 years. Returns "" if end is before start.
 */
export function formatDuration(start, end, language = 'en') {
  const clock = start.scale === 'clock';
  if (clock !== (end.scale === 'clock')) {
    throw new Error('Chroniko: formatDuration needs two parseDate() results or two parseTime() results, not one of each');
  }
  return (clock ? timeDurationText : durationText)(start, end, messagesFor(language));
}

// Anything but a plain object (null, a string, an array) would otherwise fail
// later with a TypeError that doesn't say which call or event was wrong.
function checkObject(value, what) {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return;
  const kind = value == null ? String(value) : Array.isArray(value) ? 'an array' : `a ${typeof value}`;
  throw new Error(`Chroniko: ${what} must be an object, not ${kind}`);
}

// A date as the caller gave it, for an error message. A Date is shown as an
// ISO string, not its long toString() form; it parsed, so it is valid.
function shown(input) {
  return input instanceof Date ? input.toISOString() : input;
}

// Id for an event without one: its category, lowercased with whitespace runs
// turned into hyphens, then its position in the input array, e.g.
// "olympic-game-3". Events without a category use "event", e.g. "event-3".
function defaultId(event, index) {
  const prefix = String(event.category ?? '').trim().toLowerCase().replace(/\s+/g, '-') || 'event';
  return `${prefix}-${index}`;
}

// The URL hash as an ordered map of raw (still encoded) key → value; a part
// without "=" (e.g. a plain "#section" anchor) maps to null and is kept.
function hashParams() {
  const params = new Map();
  for (const part of location.hash.slice(1).split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) params.set(part, null);
    else params.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return params;
}

// Call write(value) only if value differs from the one last written, which
// obj keeps under key; reading styles back from the DOM would be slower.
function writeIfChanged(obj, key, value, write) {
  if (obj[key] === value) return;
  obj[key] = value;
  write(value);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export class Chroniko {
  /**
   * @param {string|HTMLElement} container  Element (or selector) to render into.
   * @param {object} options
   * @param {Array}  options.events     [{ id, title, start, end?, running?, category?, tags?, description?, url?, color? }]
   *                                    running: true (clock scale only, and without an end) draws a bar
   *                                    from start to now that grows as time passes; close it with
   *                                    updateEvent(id, { end, running: false }).
   * @param {string} [options.timeScale] 'historical' (default): dates are years, months and days, read by
   *                                    parseDate. 'clock': dates are instants (epoch ms, Date or ISO string)
   *                                    read by parseTime, shown in the time zone.
   * @param {string} [options.timeZone] Clock scale only: 'local' (default) or 'UTC'. Times are shown, and
   *                                    offset-free strings read, in this zone.
   * @param {string[]} [options.timeZones] Clock scale only: the zones a toolbar control switches between,
   *                                    e.g. ['local', 'UTC'] for a toggle button. No control when omitted.
   * @param {Function} [options.onTimeZoneChange] Called with the new time zone's name when it changes.
   * @param {boolean} [options.follow] Clock scale only: start following now (true) or not (false), which
   *                                    keeps now near the view's right edge as time passes. Panning stops it;
   *                                    zooming doesn't. Either value adds a Live toolbar button that toggles it.
   * @param {Function} [options.onFollowChange] Called with true or false when following starts or stops.
   * @param {number} [options.retain]   Clock scale only: drop events that ended (or, points, happened) more
   *                                    than this many ms ago. Running events stay.
   * @param {number} [options.maxEvents] Keep at most this many events, dropping those that start first.
   *                                    Running events stay, even beyond it.
   * @param {Function} [options.source] Called once with { add, update, remove } (addEvents, updateEvent and
   *                                    removeEvents) to feed the timeline, e.g. from an EventSource or a
   *                                    WebSocket. May return a cleanup function, or a Promise of one, which
   *                                    destroy() calls; calls made after destroy() are ignored.
   * @param {*}      [options.start]    Initial visible range start (any date the time scale reads).
   * @param {*}      [options.end]      Initial visible range end. Fits all events when omitted.
   * @param {object} [options.colors]   Category → color, e.g. { war: '#c0392b' }.
   * @param {number} [options.minSpan]  Smallest visible span, in years or (clock) ms (default: 1 month, or 1 second).
   * @param {number} [options.maxSpan]  Largest visible span, in years or (clock) ms (default: 3× the data span,
   *                                    at least 100 years or 1 day).
   * @param {Function} [options.onSelectionChange] Called with the selected events in chronological order.
   * @param {boolean} [options.syncUrl] Keep the view, selection and hidden categories in the URL hash.
   * @param {string} [options.storyPosition] 'below' (default) or 'right' of the timeline.
   * @param {number} [options.split] With storyPosition 'right': the timeline's share of the width (default 0.6).
   * @param {boolean} [options.dimToggle] Show a toolbar button which is ON by default and it dims unselected events while any are selected (default true).
   * @param {boolean} [options.textSizeToggle] Show a toolbar button that enlarges the event, axis and category labels, the story and the toolbar buttons.
   * @param {string} [options.language] UI language: 'en' (default), 'zh-Hant', 'zh-Hans', 'yue', 'ja', 'ko',
   *                                    'fr', 'de', 'it', 'es', 'pt', 'pl' or 'nl'.
   * @param {object} [options.uiText] Overrides for individual UI strings; see src/locales/en.js for the keys.
   * @param {object} [options.categoryLabels] Category → text shown in the legend and on cards.
   * @param {object} [options.tagLabels] Tag → text shown in the tag bar and on cards.
   */
  constructor(container, options = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) throw new Error('Chroniko: container not found');
    this.options = {
      timeScale: 'historical',
      colors: {},
      storyPosition: 'below',
      split: 0.6,
      dimToggle: true,
      language: 'en',
      categoryLabels: {},
      tagLabels: {},
      ...options,
    };
    const { timeScale, timeZone, timeZones, storyPosition, split } = this.options;
    if (!SCALES.includes(timeScale)) {
      throw new Error(`Chroniko: timeScale must be 'historical' or 'clock', got ${JSON.stringify(timeScale)}`);
    }
    for (const [key, value] of [['timeZone', timeZone], ['timeZones', timeZones]]) {
      if (timeScale === 'historical' && value != null) {
        throw new Error(`Chroniko: ${key} needs timeScale: 'clock'; historical dates have no time of day`);
      }
    }
    for (const key of ['follow', 'retain']) {
      if (timeScale === 'historical' && this.options[key] != null) {
        throw new Error(`Chroniko: ${key} needs timeScale: 'clock'`);
      }
    }
    const { retain, maxEvents } = this.options;
    if (retain != null && !(typeof retain === 'number' && retain > 0 && retain < Infinity)) {
      throw new Error(`Chroniko: retain must be a positive number of ms, got ${JSON.stringify(retain)}`);
    }
    if (maxEvents != null && !(Number.isInteger(maxEvents) && maxEvents > 0)) {
      throw new Error(`Chroniko: maxEvents must be a positive whole number, got ${JSON.stringify(maxEvents)}`);
    }
    if (this.options.source != null && typeof this.options.source !== 'function') {
      throw new Error(`Chroniko: source must be a function, got ${typeof this.options.source}`);
    }
    if (timeZones != null) {
      if (!Array.isArray(timeZones) || timeZones.length < 2) {
        throw new Error(`Chroniko: timeZones must be an array of at least two time zones, got ${JSON.stringify(timeZones)}`);
      }
      const names = timeZones.map((tz) => zoneNamed(tz).name);
      const repeated = names.find((name, i) => names.indexOf(name) !== i);
      if (repeated) throw new Error(`Chroniko: timeZones lists ${JSON.stringify(repeated)} more than once`);
      this._zoneNames = names;
    }
    if (storyPosition !== 'below' && storyPosition !== 'right') {
      throw new Error(`Chroniko: storyPosition must be 'below' or 'right', got ${JSON.stringify(storyPosition)}`);
    }
    if (!(typeof split === 'number' && split > 0 && split < 1)) {
      throw new Error(`Chroniko: split must be a number between 0 and 1, got ${JSON.stringify(split)}`);
    }
    this.m = messagesFor(this.options.language, this.options.uiText);
    this.scale = timeScale === 'clock' ? clockScale(zoneNamed(timeZone ?? 'local')) : historical;
    this.items = [];
    this.hidden = new Set();
    this.selected = new Set();
    this.colorOf = new Map();
    this._paletteNext = 0;
    this._nextIndex = 0;
    this.start = 0;
    this.end = 1;
    this._following = false;
    this._frame = 0;
    this._building = true; // until the constructor returns; see addEvents
    this._build(el);
    this._bind();
    this.setEvents(options.events ?? []);
    if (options.start != null && options.end != null) {
      this._showRange(this._range(options.start, options.end, 'options'));
    }
    else this.fit();
    // Before the hash is read, so a shared link to a view opens on that view.
    this._following = Boolean(this.options.follow);
    this.liveEl?.setAttribute('aria-pressed', this._following);
    if (this.options.syncUrl) {
      this._onHashChange = () => this._readHash();
      window.addEventListener('hashchange', this._onHashChange);
      this._readHash();
      clearTimeout(this._hashTimer); // loading the page shouldn't rewrite its URL
    }
    // Last, so what the source adds first lands on the view the page opens on.
    if (this.options.source) this._startSource(this.options.source);
    this._building = false;
  }

  // Call the source option with { add, update, remove }. A function it
  // returns, or a Promise resolves to, is its cleanup, called once by
  // destroy(); one that resolves after destroy() is called at once. Anything
  // else is ignored, e.g. the ids from `(api) => api.add(events)`. Calls the
  // source makes after destroy() are ignored, so a message arriving late
  // doesn't throw. A source that throws removes the timeline, and the error
  // passes through.
  _startSource(source) {
    const live = (fn) => (...args) => (this._destroyed ? undefined : fn.apply(this, args));
    const api = { add: live(this.addEvents), update: live(this.updateEvent), remove: live(this.removeEvents) };
    let result;
    try {
      result = source(api);
    } catch (err) {
      this.destroy();
      throw err;
    }
    const take = (cleanup) => {
      if (typeof cleanup !== 'function') return;
      if (this._destroyed) cleanup();
      else this._sourceCleanup = cleanup;
    };
    // A rejection is left unhandled, so it shows in the console.
    if (typeof result?.then === 'function') result.then(take);
    else take(result);
  }

  // ---- Public API ---------------------------------------------------------

  setEvents(events) {
    const items = events
      .map((event, i) => {
        checkObject(event, `event ${i} passed to setEvents`);
        return this._toItem(event, String(event.id ?? defaultId(event, i)));
      })
      .sort((a, b) => a.from - b.from);
    this._checkIds(items);
    this.items = items;
    this._nextIndex = events.length;
    this._assignColors(items);
    this._itemsChanged();
    this._measureLabels();
    this._renderLegend();
    this._renderTagbar();
    const selected = this.selected.size;
    this.selected = new Set(this.items.filter((it) => this.selected.has(it.id)).map((it) => it.id));
    this._renderStory();
    this._syncTags();
    this._invalidateLayout();
    // Selected events that are gone leave the selection, as with removeEvents.
    if (this.selected.size < selected) {
      this._stateChanged();
      this.options.onSelectionChange?.(this.getSelection());
    }
    this._evict();
  }

  /**
   * Add one event or an array of events, keeping everything already shown.
   * An event without an id gets one as if it were appended to the events
   * array, so existing ids never change. Returns the added events' ids,
   * including any that retain or maxEvents dropped straight away.
   */
  addEvents(events) {
    events = [events].flat();
    const added = events
      .map((event, i) => {
        checkObject(event, `event ${i} passed to addEvents`);
        return this._toItem(event, String(event.id ?? defaultId(event, this._nextIndex + i)));
      })
      .sort((a, b) => a.from - b.from);
    this._checkIds([...this.items, ...added]);
    this._nextIndex += events.length;
    // New arrivals flash once drawn; not those added while the timeline is
    // built, e.g. a source's backfill of history.
    if (!this._building) {
      const at = performance.now();
      for (const it of added) it.addedAt = at;
    }
    // Events arriving in time order can be packed into the existing lanes;
    // anything earlier needs the whole layout redone.
    const appended = !this.items.length || !added.length || added[0].from >= this.items.at(-1).from;
    for (const it of added) this._insert(it);
    this._assignColors(added);
    this._itemsChanged();
    this._measureLabels(added);
    if (appended && this._layoutScale != null) this._pack(added);
    else this._layoutScale = null;
    this._dataChanged(false);
    this._evict();
    return added.map((it) => it.id);
  }

  /**
   * Change fields of an event, e.g. updateEvent('deploy-42', { end: '2026-10-28' }).
   * The patch is merged into the event; a field set to undefined is removed.
   */
  updateEvent(id, patch) {
    id = String(id);
    const index = this.items.findIndex((it) => it.id === id);
    if (index < 0) throw new Error(`Chroniko: updateEvent found no event with the id "${id}"`);
    checkObject(patch, `the patch passed to updateEvent`);
    if (patch.id != null && String(patch.id) !== id) {
      throw new Error(`Chroniko: updateEvent cannot change the id of "${id}"; remove the event and add it again`);
    }
    // Dates the patch leaves alone keep their parsed instants. Parsing their
    // strings again would read offset-free ones in the zone now in use, and
    // move an event added before a zone switch.
    const old = this.items[index];
    const kept = {};
    if (!Object.hasOwn(patch, 'start')) kept.start = old.start;
    // A running event's range end is now, not an end to keep.
    if (!Object.hasOwn(patch, 'end')) Object.assign(kept, { end: old.end, to: old.end ? old.to : null });
    const item = this._toItem({ ...old.event, ...patch }, id, kept);
    this.items.splice(index, 1);
    this._insert(item);
    this._assignColors([item]);
    this._itemsChanged();
    this._measureLabels([item]);
    this._layoutScale = null;
    this._dataChanged(this.selected.has(id));
  }

  /** Remove one event or an array of events by id. Unknown ids are ignored. */
  removeEvents(ids) {
    const gone = new Set([ids].flat().map(String));
    this._keepItems((it) => !gone.has(it.id), true);
  }

  // Keep only the events for which keep(item) is true. Selected events that
  // go leave the selection, calling onSelectionChange. With repack, the lanes
  // are packed again; without, the rest keep their lanes, and the lane count
  // shrinks on the next full packing.
  _keepItems(keep, repack) {
    const items = this.items.filter(keep);
    if (items.length === this.items.length) return;
    this.items = items;
    this._itemsChanged();
    if (repack) this._layoutScale = null;
    this._dataChanged(false);
    const ids = new Set(items.map((it) => it.id));
    const selected = [...this.selected].filter((id) => ids.has(id));
    if (selected.length < this.selected.size) this._setSelection(selected);
  }

  // Retention: drop the events that ended (a point: happened) more than
  // retain ms ago, then those starting first beyond maxEvents. Running
  // events haven't ended, and always stay. Called after events are set or
  // added, and by a timer when the next event is due to expire; see
  // _scheduleEviction. Eviction doesn't repack the lanes, so a stream of
  // events isn't repacked at every arrival.
  _evict() {
    const { retain, maxEvents } = this.options;
    if (retain == null && maxEvents == null) return;
    const now = Date.now();
    const expired = (it) => retain != null && !it.running && (it.to ?? it.from) + retain <= now;
    let excess = (maxEvents == null ? 0 : this.items.filter((it) => !expired(it)).length - maxEvents);
    this._keepItems((it) => {
      if (expired(it)) return false;
      if (excess > 0 && !it.running) {
        excess -= 1;
        return false;
      }
      return true;
    }, false);
  }

  // Time the next retain eviction for when the first event expires. Set
  // again whenever the events change.
  _scheduleEviction() {
    clearTimeout(this._evictTimer);
    this._evictTimer = 0;
    const { retain } = this.options;
    if (retain == null) return;
    let first = Infinity;
    for (const it of this.items) if (!it.running) first = Math.min(first, it.to ?? it.from);
    if (first === Infinity) return;
    const wait = Math.min(Math.max(0, first + retain - Date.now()), MAX_TIMEOUT);
    this._evictTimer = setTimeout(() => {
      this._evictTimer = 0;
      this._evict();
      // Nothing may have expired yet, after a wait capped at MAX_TIMEOUT.
      if (!this._evictTimer) this._scheduleEviction();
    }, wait);
  }

  /**
   * Show the range [start, end]; accepts any date the time scale reads. A span outside
   * minSpan/maxSpan is clamped around the range's center.
   */
  zoomTo(start, end) {
    this._showRange(this._range(start, end));
  }

  // The positions [from, to] of a range given as dates, read by the scale
  // (the current one unless given). Throws on a missing, invalid or
  // backwards range, naming the dates as the caller knows them: "zoomTo
  // start", "setState end", or "the start option" for caller 'options'.
  _range(start, end, caller = 'zoomTo', scale = this.scale) {
    const name = (field) => (caller === 'options' ? `the ${field} option` : `${caller} ${field}`);
    const read = (field, input) => {
      let parsed;
      try {
        parsed = scale.parse(input);
      } catch (err) {
        throw new Error(`Chroniko: ${name(field)} is invalid: ${err.message.replace(/^Chroniko: /, '')}`);
      }
      if (!parsed) throw new Error(`Chroniko: ${name(field)} is missing`);
      return parsed.value;
    };
    const from = read('start', start);
    const to = read('end', end);
    if (from >= to) {
      throw new Error(`Chroniko: ${name('start')} (${shown(start)}) must be before ${name('end')} (${shown(end)})`);
    }
    return [from, to];
  }

  _showRange([from, to]) {
    const center = (from + to) / 2;
    const span = this._clampSpan(to - from);
    this._setView(center - span / 2, center + span / 2);
  }

  /** Zoom so every event is visible. */
  fit() {
    if (!this.items.length) return this._setView(...this.scale.emptyView);
    const [min, max] = this._extent();
    const span = Math.max(max - min, this.scale.minFitSpan);
    this._setView(min - span * 0.04, max + span * 0.12);
  }

  /**
   * factor < 1 zooms in, > 1 zooms out. ratio is the anchor point across the
   * width (0–1). While following, it zooms around now and keeps following.
   */
  zoomBy(factor, ratio = 0.5) {
    if (this._following) ratio = 1 - FOLLOW_MARGIN;
    const span = this.end - this.start;
    const anchor = this.start + span * ratio;
    const next = this._clampSpan(span * factor);
    this._setView(anchor - next * ratio, anchor - next * ratio + next, true);
  }

  /** Pan by a number of pixels (positive moves forward in time). */
  panBy(px) {
    const dv = px / this._scale();
    this._setView(this.start + dv, this.end + dv);
  }

  /** Add an event to the selection. */
  select(id) {
    id = String(id);
    if (this.selected.has(id) || !this.items.some((it) => it.id === id)) return;
    this._setSelection([...this.selected, id]);
  }

  /** Remove an event from the selection. */
  deselect(id) {
    id = String(id);
    if (this.selected.has(id)) this._setSelection([...this.selected].filter((s) => s !== id));
  }

  toggle(id) {
    if (this.selected.has(String(id))) this.deselect(id);
    else this.select(id);
  }

  clearSelection() {
    if (this.selected.size) this._setSelection([]);
  }

  /** Selected events in chronological order. */
  getSelection() {
    return this.items.filter((it) => this.selected.has(it.id)).map((it) => it.event);
  }

  /**
   * Pan and zoom so the event is in view, then focus and highlight it. A range
   * fills the middle of the view; a point is centered at the current zoom.
   * Shows the event's category if it was hidden.
   */
  reveal(id) {
    const item = this.items.find((it) => it.id === String(id));
    if (!item) return;
    if (item.category && this.hidden.has(item.category)) {
      this._setHidden([...this.hidden].filter((c) => c !== item.category));
    }
    const center = item.to != null ? (item.from + item.to) / 2 : item.from;
    const span = item.to != null ? this._clampSpan((item.to - item.from) / 0.6) : this.end - this.start;
    this._revealing = { id: item.id, at: performance.now(), pending: true };
    this._setView(center - span / 2, center + span / 2);
  }

  /**
   * Show times in another zone: 'local' or 'UTC'. Clock scale only. Events
   * and the view stay where they are; the axis, story and tooltips are
   * relabeled. Offset-free strings added later are read in the new zone.
   */
  setTimeZone(timeZone) {
    this._setZone(this._zoneFor(timeZone));
  }

  // The zone with this name. Throws on the historical scale, naming the
  // caller ("setTimeZone" or "setState timeZone"), and for a name that isn't
  // a zone.
  _zoneFor(timeZone, caller = 'setTimeZone') {
    if (!this.scale.zone) {
      throw new Error(`Chroniko: ${caller} needs timeScale: 'clock'; historical dates have no time of day`);
    }
    return zoneNamed(timeZone);
  }

  _setZone(zone) {
    if (zone === this.scale.zone) return;
    this.scale = clockScale(zone);
    this._syncZoneToggle();
    this._renderStory();
    this._scheduleRender();
    this._stateChanged();
    this.options.onTimeZoneChange?.(zone.name);
  }

  /**
   * Start (true, the default) or stop (false) following now: the view keeps
   * now near its right edge, at the current zoom, as time passes. Clock scale
   * only. Panning, zoomTo(), fit(), reveal() and setState() with a view stop
   * it; zooming doesn't.
   */
  follow(on = true) {
    if (!this.nowEl) throw new Error("Chroniko: follow needs timeScale: 'clock'");
    this._setFollowing(Boolean(on));
  }

  /** Whether the view is following now. */
  isFollowing() {
    return this._following;
  }

  _setFollowing(on) {
    if (on === this._following) return;
    this._following = on;
    this.liveEl?.setAttribute('aria-pressed', on);
    // Starting moves the view to now; stopping leaves it where it is.
    if (on) this._scheduleRender();
    this._stateChanged();
    this.options.onFollowChange?.(on);
  }

  /** The time zone times are shown in ('local' or 'UTC'), or null on the historical scale. */
  getTimeZone() {
    return this.scale.zone?.name ?? null;
  }

  /**
   * The view (in fractional years, or epoch ms on the clock scale), selected
   * ids and hidden categories, for saving or sharing. On the clock scale it
   * also has the time zone.
   */
  getState() {
    return {
      start: this.start,
      end: this.end,
      selected: this.items.filter((it) => this.selected.has(it.id)).map((it) => it.id),
      hidden: [...this.hidden],
      ...(this.scale.zone && { timeZone: this.scale.zone.name, following: this._following }),
    };
  }

  /**
   * Restore a state from getState(). Every field is optional, so a partial
   * state changes only what it names. Unknown event ids are ignored. A view
   * (start and end) stops following, unless following is true: then the
   * view's span is followed.
   */
  setState(state = {}) {
    // Everything is read before anything is applied, so a state that throws
    // leaves the timeline as it was. String dates are read in the state's
    // own time zone when it has one.
    const { following } = state;
    if (following != null) {
      if (!this.nowEl) throw new Error("Chroniko: setState following needs timeScale: 'clock'");
      if (typeof following !== 'boolean') {
        throw new Error(`Chroniko: setState following must be true or false, got ${JSON.stringify(following)}`);
      }
    }
    const zone = state.timeZone != null ? this._zoneFor(state.timeZone, 'setState timeZone') : null;
    const range =
      state.start != null && state.end != null
        ? this._range(state.start, state.end, 'setState', zone ? clockScale(zone) : this.scale)
        : null;
    const hidden = state.hidden ? state.hidden.map(String) : null;
    const ids = state.selected ? new Set(state.selected.map(String)) : null;
    if (zone) this._setZone(zone);
    if (range) this._showRange(range);
    if (following != null) this._setFollowing(following);
    if (hidden) this._setHidden(hidden);
    if (ids) this._setSelection(this.items.filter((it) => ids.has(it.id)).map((it) => it.id));
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    cancelAnimationFrame(this._frame);
    this._stopLive();
    if (this._onVisibilityChange) document.removeEventListener('visibilitychange', this._onVisibilityChange);
    clearTimeout(this._zoomTimer);
    clearTimeout(this._hintTimer);
    clearTimeout(this._hashTimer);
    clearTimeout(this._runningTimer);
    clearTimeout(this._evictTimer);
    if (this._onHashChange) window.removeEventListener('hashchange', this._onHashChange);
    this._resizeObserver.disconnect();
    document.fonts?.removeEventListener('loadingdone', this._onFontsLoaded);
    this.root.remove();
    // Last: the rest is torn down even if the source's cleanup throws.
    const cleanup = this._sourceCleanup;
    this._sourceCleanup = null;
    cleanup?.();
  }

  // ---- DOM & interaction ---------------------------------------------------

  _build(el) {
    this.root = document.createElement('div');
    this.root.className = 'chroniko';
    // Screen readers pick the pronunciation, and browsers the CJK glyph forms, from lang.
    this.root.lang = this.options.language;
    if (this.options.storyPosition === 'right') {
      this.root.classList.add('ck-side');
      this.root.style.setProperty('--ck-split', this.options.split);
    }
    if (this.options.dimToggle) this.root.classList.add('ck-dim');
    const m = this.m;
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform);
    const ctrl = mac ? '⌘' : m.ctrlKey;
    // .ck-layout is separate from the root so the root can be the container
    // that the side-by-side layout's narrow-width fallback queries.
    this.root.innerHTML = `
      <div class="ck-layout">
        <div class="ck-main">
          <div class="ck-toolbar">
            <div class="ck-legend" role="group" aria-label="${esc(m.categories)}"></div>
            <div class="ck-controls">
              ${this.options.follow != null ? `<button type="button" data-action="live" class="ck-live" aria-pressed="false" aria-label="${esc(m.followNow(m.live))}"><span class="ck-live-dot"></span>${esc(m.live)}</button>` : ''}
              ${this._zoneNames ? '<button type="button" data-action="time-zone" class="ck-zone-toggle"></button>' : ''}
              <button type="button" data-action="zoom-in" aria-label="${esc(m.zoomIn)}">+</button>
              <button type="button" data-action="zoom-out" aria-label="${esc(m.zoomOut)}">−</button>
              <button type="button" data-action="fit">${esc(m.fit)}</button>
              ${this.options.dimToggle ? `<button type="button" data-action="dim" aria-pressed="true" aria-label="${esc(m.dimUnselected)}">◐</button>` : ''}
              ${this.options.textSizeToggle ? `<button type="button" data-action="text-size" aria-pressed="false" aria-label="${esc(m.largerText)}">Aa</button>` : ''}
            </div>
          </div>
          <details class="ck-tagbar" hidden>
            <summary>${esc(m.tags)} <span class="ck-count"></span></summary>
            <ul class="ck-tags" aria-label="${esc(m.tags)}"></ul>
          </details>
          <div class="ck-viewport" tabindex="0" aria-label="${m.viewport(esc(ctrl))}">
            <div class="ck-grid"></div>
            <div class="ck-lanes"></div>
            <div class="ck-axis"></div>
            ${this.options.timeScale === 'clock' ? '<div class="ck-now" aria-hidden="true" hidden></div>' : ''}
            <div class="ck-zone" hidden></div>
            <div class="ck-hint" aria-hidden="true"></div>
          </div>
        </div>
        <section class="ck-story" aria-label="${esc(m.selectedEvents)}" hidden></section>
      </div>`;
    el.append(this.root);
    this.legendEl = this.root.querySelector('.ck-legend');
    this.tagbarEl = this.root.querySelector('.ck-tagbar');
    this.viewport = this.root.querySelector('.ck-viewport');
    this.gridEl = this.root.querySelector('.ck-grid');
    this.lanesEl = this.root.querySelector('.ck-lanes');
    this._lanesInner = document.createElement('div');
    this._lanesInner.className = 'ck-lanes-inner';
    this.lanesEl.append(this._lanesInner);
    this._buttons = new Map(); // event id → its button while on screen; see _renderEvents
    this.axisEl = this.root.querySelector('.ck-axis');
    this.zoneEl = this.root.querySelector('.ck-zone');
    this.nowEl = this.root.querySelector('.ck-now');
    this.storyEl = this.root.querySelector('.ck-story');
    this.hintEl = this.root.querySelector('.ck-hint');
    this.hintEl.innerHTML = m.hint(esc(ctrl));
    this.zoneToggleEl = this.root.querySelector('.ck-zone-toggle');
    this.liveEl = this.root.querySelector('.ck-live');
    this._syncZoneToggle();
  }

  _showHint() {
    this.hintEl.classList.add('ck-visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hintEl.classList.remove('ck-visible'), 1500);
  }

  _bind() {
    const vp = this.viewport;

    this.root.querySelector('.ck-controls').addEventListener('click', (e) => {
      const action = e.target.closest('button')?.dataset.action;
      if (action === 'zoom-in') this.zoomBy(1 / 1.5);
      else if (action === 'zoom-out') this.zoomBy(1.5);
      else if (action === 'fit') this.fit();
      else if (action === 'dim') this._toggleDim(e.target.closest('button'));
      else if (action === 'text-size') this._toggleTextSize(e.target.closest('button'));
      else if (action === 'time-zone') this.setTimeZone(this._nextZone());
      else if (action === 'live') this.follow(!this._following);
    });

    this.tagbarEl.addEventListener('click', (e) => {
      const tag = e.target.closest('.ck-tag');
      if (tag) this._toggleTag(tag.dataset.tag, tag);
    });

    this.legendEl.addEventListener('click', (e) => {
      const category = e.target.closest('.ck-legend-item')?.dataset.category;
      if (category == null) return;
      const hidden = new Set(this.hidden);
      if (hidden.has(category)) hidden.delete(category);
      else hidden.add(category);
      this._setHidden(hidden);
    });

    // Hovering or focusing an event, its card or its end marker highlights all
    // of them, linking the timeline and the story.
    const HOVERABLE = '.ck-event, .ck-card, .ck-end-jump';
    const hoverFrom = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return; // no sticky hover after a tap
      this._setHover(e.target.closest(HOVERABLE)?.dataset.id ?? null);
    };
    for (const el of [this.lanesEl, this.storyEl]) {
      el.addEventListener('pointerover', hoverFrom);
      el.addEventListener('focusin', hoverFrom);
      el.addEventListener('pointerleave', () => this._setHover(null));
      el.addEventListener('focusout', () => this._setHover(null));
    }

    // Horizontal wheel pans. Vertical wheel zooms only with Ctrl/⌘ held (also
    // what trackpad pinch sends) or once the timeline has focus; otherwise it
    // scrolls the page, so the timeline doesn't trap readers scrolling past it.
    vp.addEventListener(
      'wheel',
      (e) => {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vp.clientWidth : 1;
        const dx = e.deltaX * unit;
        const dy = e.deltaY * unit;
        if (Math.abs(dx) > Math.abs(dy)) {
          e.preventDefault();
          this.panBy(dx);
          return;
        }
        if (!e.ctrlKey && !e.metaKey && !vp.contains(document.activeElement)) {
          this._showHint();
          return;
        }
        e.preventDefault();
        // Keep lanes as they are mid-gesture and repack once the wheel settles.
        this._zooming = true;
        clearTimeout(this._zoomTimer);
        this._zoomTimer = setTimeout(() => {
          this._zooming = false;
          this._scheduleRender();
        }, 150);
        this.zoomBy(Math.exp(dy * 0.002), this._ratioAt(e.clientX));
      },
      { passive: false },
    );

    // One pointer drags to pan; two (touch) pinch to zoom. Pointer capture
    // starts only once a drag has moved, so a plain click still reaches the
    // event element underneath.
    const pointers = new Map(); // pointerId → { x, y }
    let drag = null;
    let pinch = null;
    const startDrag = (id, x) => {
      drag = { id, x, start: this.start, span: this.end - this.start, moved: false };
    };
    // The time under the fingers' midpoint stays under it: spreading the
    // fingers zooms in around it, sliding both pans.
    const pinchGeometry = () => {
      const [a, b] = pointers.values();
      return { dist: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1), ratio: this._ratioAt((a.x + b.x) / 2) };
    };
    // (Re)start a pinch from the current view and the first two pointers.
    const startPinch = () => {
      const { dist, ratio } = pinchGeometry();
      const span = this.end - this.start;
      pinch = { dist, span, anchor: this.start + span * ratio };
    };
    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        this._suppressClick = false;
        startDrag(e.pointerId, e.clientX);
      } else if (pointers.size === 2) {
        for (const id of pointers.keys()) vp.setPointerCapture(id);
        startPinch();
        drag = null;
        this._zooming = true; // keep lanes as they are until the pinch ends
        vp.classList.add('ck-dragging');
      }
    });
    vp.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pinch) {
        const { dist, ratio } = pinchGeometry();
        const span = this._clampSpan((pinch.span * pinch.dist) / dist);
        const start = pinch.anchor - span * ratio;
        this._setView(start, start + span, true); // a zoom; following carries on around now
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 4) return;
        drag.moved = true;
        vp.setPointerCapture(e.pointerId);
        vp.classList.add('ck-dragging');
      }
      const start = drag.start - dx / this._scale();
      this._setView(start, start + drag.span);
    });
    const endPointer = (e) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pinch) {
        if (pointers.size >= 2) {
          startPinch(); // the pair of fingers changed; avoid a jump
          return;
        }
        pinch = null;
        this._suppressClick = true;
        this._zooming = false;
        this._scheduleRender();
        // Carry on panning with the finger still down, from where it is now.
        const [rest] = pointers;
        if (rest) {
          startDrag(rest[0], rest[1].x);
          drag.moved = true;
          return;
        }
      } else if (drag?.id === e.pointerId && drag.moved) {
        this._suppressClick = true;
      }
      if (!pointers.size) {
        drag = null;
        vp.classList.remove('ck-dragging');
      }
    };
    vp.addEventListener('pointerup', endPointer);
    vp.addEventListener('pointercancel', endPointer);

    vp.addEventListener('click', (e) => {
      if (this._suppressClick) {
        this._suppressClick = false;
        return;
      }
      const id = e.target.closest('.ck-event')?.dataset.id;
      if (id != null) this.toggle(id);
    });

    vp.addEventListener('keydown', (e) => {
      const step = vp.clientWidth * 0.1;
      const actions = {
        ArrowLeft: () => this.panBy(-step),
        ArrowRight: () => this.panBy(step),
        '+': () => this.zoomBy(1 / 1.5),
        '=': () => this.zoomBy(1 / 1.5),
        '-': () => this.zoomBy(1.5),
        Escape: () => this.clearSelection(),
      };
      if (actions[e.key]) {
        e.preventDefault();
        actions[e.key]();
      }
    });

    this.storyEl.addEventListener('click', (e) => {
      const remove = e.target.closest('.ck-remove');
      const jump = e.target.closest('.ck-end-jump');
      const locate = e.target.closest('.ck-locate');
      const tag = e.target.closest('.ck-tag');
      if (tag) this._toggleTag(tag.dataset.tag, tag);
      else if (remove) this.deselect(remove.dataset.id);
      else if (jump) this._jumpToCard(jump.dataset.id);
      else if (locate) this.reveal(locate.dataset.id);
      else if (e.target.closest('.ck-clear')) this.clearSelection();
    });

    this._resizeObserver = new ResizeObserver(() => this._scheduleRender());
    this._resizeObserver.observe(vp);

    // A web font that finishes loading after setEvents() changes label widths,
    // so the lanes are packed again with the real font.
    this._onFontsLoaded = () => {
      this._measureLabels();
      this._invalidateLayout();
    };
    document.fonts?.addEventListener('loadingdone', this._onFontsLoaded);

    // The live loop and the running text sleep while the page is hidden, and
    // catch up when it's shown.
    if (this.nowEl) {
      this._onVisibilityChange = () => {
        this._live();
        this._syncRunningText();
      };
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  // A tag is on while every event with it is selected, and partly on while
  // only some are. Clicking an off or partly-on tag selects them all;
  // clicking an on tag deselects them all. The story is
  // rebuilt, so a tag clicked on a card hands focus to the same tag on the
  // rebuilt card, if that card is still there.
  _toggleTag(tag, button) {
    const tagged = new Set(this.items.filter((it) => it.tags.includes(tag)).map((it) => it.id));
    const on = [...tagged].every((id) => this.selected.has(id));
    const ids = on ? [...this.selected].filter((id) => !tagged.has(id)) : [...new Set([...this.selected, ...tagged])];
    const cardId = button.closest('.ck-card')?.dataset.id;
    const refocus = cardId != null && button === document.activeElement;
    this._setSelection(ids);
    if (!refocus) return;
    const card = [...this.storyEl.querySelectorAll('.ck-card')].find((c) => c.dataset.id === cardId);
    [...(card?.querySelectorAll('.ck-tag') ?? [])].find((b) => b.dataset.tag === tag)?.focus();
  }

  // Each tag's state: "true" when every event with it is selected, "mixed"
  // when only some are, "false" when none are.
  _tagStates() {
    const seen = new Map();
    for (const it of this.items) {
      const sel = this.selected.has(it.id);
      for (const t of it.tags) {
        const s = seen.get(t) ?? { some: false, all: true };
        s.some ||= sel;
        s.all &&= sel;
        seen.set(t, s);
      }
    }
    return new Map([...seen].map(([t, s]) => [t, s.all ? 'true' : s.some ? 'mixed' : 'false']));
  }

  _syncTags() {
    const states = this._tagStates();
    for (const el of this.root.querySelectorAll('.ck-tag')) el.setAttribute('aria-pressed', states.get(el.dataset.tag) ?? 'false');
  }

  // Dimming applies only while something is selected; see ck-has-selection in _renderStory.
  _toggleDim(button) {
    button.setAttribute('aria-pressed', this.root.classList.toggle('ck-dim'));
  }

  // The zone after the current one in timeZones, wrapping around. A zone
  // that isn't listed (set through setTimeZone or the URL) goes to the first.
  _nextZone() {
    const names = this._zoneNames;
    return names[(names.indexOf(this.scale.zone.name) + 1) % names.length];
  }

  _zoneText(name) {
    return name === 'local' ? this.m.localTime : name;
  }

  // The toggle shows the zone in use. Its label, which is also its tooltip,
  // starts with that text, so speech input can still find it by what it shows.
  // setAttribute and textContent don't parse HTML, so nothing is escaped here.
  _syncZoneToggle() {
    const button = this.zoneToggleEl;
    if (!button) return;
    const current = this._zoneText(this.scale.zone.name);
    button.textContent = current;
    button.setAttribute('aria-label', this.m.switchTimeZone(current, this._zoneText(this._nextZone())));
  }

  // Label widths are cached for lane packing, and a size change fires neither
  // the ResizeObserver nor a font load, so they are measured again here.
  _toggleTextSize(button) {
    const large = this.root.classList.toggle('ck-large-text');
    button.setAttribute('aria-pressed', large);
    this._measureLabels();
    this._invalidateLayout();
  }

  _setSelection(ids) {
    this.selected = new Set(ids);
    for (const [id, { el }] of this._buttons) {
      const on = this.selected.has(id);
      el.classList.toggle('ck-selected', on);
      el.setAttribute('aria-pressed', on);
    }
    this._renderStory();
    this._syncTags();
    this._stateChanged();
    this.options.onSelectionChange?.(this.getSelection());
  }

  // Any view change stops following, except a zoom (keepFollowing), which
  // the next render moves back to now.
  _setView(start, end, keepFollowing = false) {
    if (!keepFollowing) this._setFollowing(false);
    this.start = start;
    this.end = end;
    this._scheduleRender();
    this._stateChanged();
  }

  _setHidden(categories) {
    this.hidden = new Set(categories);
    this._renderLegend();
    this._invalidateLayout();
    this._stateChanged();
  }

  _setHover(id) {
    if (id === this._hoverId) return;
    this._hoverId = id;
    for (const el of this.root.querySelectorAll('.ck-event, .ck-card, .ck-end-jump')) {
      el.classList.toggle('ck-hover', el.dataset.id === id);
    }
  }

  // ---- URL hash sync (options.syncUrl) ---------------------------------------
  //
  // The hash holds ck-view=<start>,<end>, ck-sel=<ids> and ck-hide=<categories>,
  // each list item URI-encoded, e.g. #ck-view=1300,1500&ck-sel=hyw,black-death.
  // The clock scale adds ck-tz=<zone>, always, so a shared link opens in the
  // sender's zone even where the page's own default differs. While following
  // now, ck-live=<span in ms> takes the place of ck-view.
  // Other hash parameters are kept as they are.

  _stateChanged() {
    if (!this.options.syncUrl) return;
    clearTimeout(this._hashTimer);
    this._hashTimer = setTimeout(() => this._writeHash(), 250);
  }

  _readHash() {
    const params = hashParams();
    const list = (key) => {
      const raw = params.get(key);
      if (!raw) return [];
      try {
        return raw.split(',').map(decodeURIComponent);
      } catch {
        return []; // malformed escape in a hand-edited URL
      }
    };
    const state = {};
    const view = params.get('ck-view')?.split(',').map(Number);
    if (view?.length === 2 && view.every(Number.isFinite) && view[0] < view[1]) [state.start, state.end] = view;
    // ck-live=<span> follows now at that span, and wins over ck-view.
    const live = Number(params.get('ck-live'));
    if (this.nowEl && params.has('ck-live') && live > 0 && live < Infinity) {
      const now = Date.now();
      Object.assign(state, { start: now - live, end: now, following: true });
    }
    if (params.has('ck-sel')) state.selected = list('ck-sel');
    if (params.has('ck-hide')) state.hidden = list('ck-hide');
    // A zone this version doesn't know (e.g. from a newer one) is ignored.
    const tz = params.get('ck-tz');
    if (this.scale.zone && tz) {
      try {
        state.timeZone = zoneNamed(decodeURIComponent(tz)).name;
      } catch {
        // keep the current zone
      }
    }
    this.setState(state);
  }

  _writeHash() {
    const { start, end, selected, hidden, timeZone, following } = this.getState();
    const params = hashParams();
    // While following, the view moves every frame; the hash keeps only its
    // span (zoom), as ck-live, so it isn't rewritten as time passes.
    if (following) {
      params.delete('ck-view');
      params.set('ck-live', String(Math.round(end - start)));
    } else {
      // Enough decimals to keep the view to about a thousandth of its span.
      const digits = Math.min(6, Math.max(0, Math.ceil(3 - Math.log10(end - start))));
      params.delete('ck-live');
      params.set('ck-view', `${+start.toFixed(digits)},${+end.toFixed(digits)}`);
    }
    if (timeZone) params.set('ck-tz', encodeURIComponent(timeZone));
    for (const [key, values] of [['ck-sel', selected], ['ck-hide', hidden]]) {
      if (values.length) params.set(key, values.map(encodeURIComponent).join(','));
      else params.delete(key);
    }
    const hash = [...params].map(([k, v]) => (v == null ? k : `${k}=${v}`)).join('&');
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${hash}`);
  }

  _clampSpan(span) {
    const min = this.options.minSpan ?? this.scale.minSpan;
    const max = this.options.maxSpan ?? this.scale.maxSpan(this._dataSpan);
    return Math.min(Math.max(span, min), max);
  }

  _scale() {
    return (this.viewport.clientWidth || 1) / (this.end - this.start);
  }

  _ratioAt(clientX) {
    const rect = this.viewport.getBoundingClientRect();
    return (clientX - rect.left) / rect.width;
  }

  // ---- Event data ------------------------------------------------------------

  // The internal record for an event. Throws, naming the event, on bad dates
  // and on an end before the start. kept holds already parsed dates to use as
  // they are: start, or end with its range end (to).
  _toItem(event, id, kept = {}) {
    const date = (field) => {
      if (Object.hasOwn(kept, field)) return kept[field];
      try {
        return this.scale.parse(event[field]);
      } catch (err) {
        const reason = err.message.replace(/^Chroniko: /, '');
        throw new Error(`Chroniko: event "${event.title ?? id}" has an invalid ${field}: ${reason}`);
      }
    };
    const name = event.title ?? id;
    const start = date('start');
    if (!start) throw new Error(`Chroniko: event "${name}" has no start date`);
    const end = date('end');
    // A running event has started and not yet ended: its bar runs to now, so
    // it has no end until it is closed with { end, running: false }.
    const running = event.running ?? false;
    if (typeof running !== 'boolean') {
      throw new Error(`Chroniko: event "${name}" has an invalid running: must be true or false, not ${JSON.stringify(running)}`);
    }
    if (running && !this.scale.zone) {
      throw new Error(`Chroniko: event "${name}" is running, which needs timeScale: 'clock'`);
    }
    if (running && end) {
      throw new Error(`Chroniko: event "${name}" is running and has an end; set running: false when it ends`);
    }
    const to = running
      ? Math.max(start.value, Date.now())
      : Object.hasOwn(kept, 'to') ? kept.to : end ? this.scale.rangeEnd(end) : null;
    // Compared by where the range stops, so a date-only end on the start's
    // day (or a historical end in the start's year) is fine.
    if (to != null && to < start.value) {
      throw new Error(
        `Chroniko: event "${name}" ends (${shown(event.end)}) before it starts (${shown(event.start)})`,
      );
    }
    return {
      event,
      id,
      start,
      end,
      from: start.value,
      to, // a running event's is moved to now as time passes; see _runTo
      running,
      category: event.category ?? null,
      // A single string is one tag; blanks and repeats are dropped.
      tags: [...new Set([event.tags ?? []].flat().map((t) => String(t).trim()).filter(Boolean))],
    };
  }

  // Ids key selection and DOM lookups; two events sharing one would select
  // together. Checked before any state changes, so a bad call leaves the
  // timeline as it was.
  _checkIds(items) {
    const seen = new Map();
    for (const it of items) {
      const other = seen.get(it.id);
      if (other) {
        throw new Error(
          `Chroniko: events "${other.event.title}" and "${it.event.title}" share the id "${it.id}"; ids must be unique`,
        );
      }
      seen.set(it.id, it);
    }
  }

  // Insert keeping this.items in start order; ties go after the events
  // already there, as a stable sort of the combined list would put them.
  _insert(item) {
    let lo = 0;
    let hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.items[mid].from <= item.from) lo = mid + 1;
      else hi = mid;
    }
    this.items.splice(lo, 0, item);
  }

  // A category keeps its color once it has one, so adding or replacing events
  // never recolors those already shown. Categories without a configured color
  // take palette colors not used in options.colors.
  _assignColors(items) {
    const used = new Set(Object.values(this.options.colors));
    const free = PALETTE.filter((c) => !used.has(c));
    for (const it of items) {
      const c = it.category;
      if (c && !this.colorOf.has(c)) {
        this.colorOf.set(c, this.options.colors[c] ?? free[this._paletteNext++ % free.length] ?? PALETTE[0]);
      }
      it.color = it.event.color ?? this.colorOf.get(c) ?? PALETTE[0];
    }
  }

  // What is derived from the whole event list: the legend's categories (in
  // order of first appearance), the data span behind the default maxSpan,
  // and the running events, which change as time passes.
  _itemsChanged() {
    this.categories = [...new Set(this.items.map((it) => it.category).filter(Boolean))];
    const [min, max] = this._extent();
    this._dataSpan = max - min;
    this._running = this.items.filter((it) => it.running);
    this._syncRunningText();
    this._scheduleEviction();
  }

  // addEvents, updateEvent and removeEvents redraw the legend, tag bar and
  // (if a selected event changed) the story once per frame, however many
  // calls were made in it.
  _dataChanged(story) {
    this._pendingData = { story: this._pendingData?.story || story };
    this._scheduleRender();
  }

  _flushData() {
    const { story } = this._pendingData;
    this._pendingData = null;
    this._renderLegend();
    this._renderTagbar();
    if (story) this._renderStory();
    this._syncTags();
  }

  _extent() {
    let min = Infinity;
    let max = -Infinity;
    for (const it of this.items) {
      min = Math.min(min, it.from);
      max = Math.max(max, it.to ?? it.from);
    }
    return this.items.length ? [min, max] : [0, 0];
  }

  // Label widths come from a canvas rather than the DOM so measuring thousands
  // of titles stays cheap. The font is read from a probe .ck-label, so styles
  // aimed at the label itself (not just .ck-lanes) are picked up too.
  _measureLabels(items = this.items) {
    const ctx = (this._ctx ??= document.createElement('canvas').getContext('2d'));
    const probe = document.createElement('span');
    probe.className = 'ck-label';
    probe.style.visibility = 'hidden';
    this.lanesEl.append(probe);
    const cs = getComputedStyle(probe);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    ctx.wordSpacing = cs.wordSpacing === 'normal' ? '0px' : cs.wordSpacing;
    const transform = cs.textTransform;
    probe.remove();
    for (const it of items) {
      let title = it.event.title ?? '';
      if (transform === 'uppercase') title = title.toUpperCase();
      else if (transform === 'lowercase') title = title.toLowerCase();
      it.labelWidth = ctx.measureText(title).width;
    }
  }

  // ---- Rendering ------------------------------------------------------------

  _scheduleRender() {
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      this._render();
    });
  }

  _render() {
    // While following, a render (a zoom, new data) also brings the view to now.
    const now = Date.now();
    this._runTo(now);
    if (this._following) this._followTo(now);
    this._draw();
    this._live(now);
  }

  _draw() {
    if (this._pendingData) this._flushData();
    const width = this.viewport.clientWidth;
    if (!width) return;
    const scale = width / (this.end - this.start);
    const x = (v) => (v - this.start) * scale;
    // Panning leaves the scale unchanged up to float noise, so it never repacks.
    const rescaled = this._layoutScale == null || Math.abs(scale / this._layoutScale - 1) > 1e-6;
    if (this._layoutScale == null || (rescaled && !this._zooming)) this._layout(scale);
    this._renderAxis(scale, x);
    this._renderEvents(width, x);
  }

  // ---- Live loop ------------------------------------------------------------
  //
  // A loop separate from _scheduleRender that moves only what changes as time
  // passes, so the time passing never relayouts or rebuilds the lanes: the
  // "now" line, running events' bars, and while following, the view, which
  // only pans. The loop wakes only when there is something to move: once now
  // has moved NOW_STEP_PX (every frame when zoomed in to seconds, every few
  // minutes when a day fills the view), or when now reaches a view that is
  // ahead of it. A view that ends before now, and isn't following, never
  // needs it: a running bar in it already reaches past its right edge. It
  // sleeps while the page is hidden.
  //
  // drawnAt is the time a render has just drawn the view for; without it,
  // the loop itself moves a following view to now.

  _live(drawnAt = null) {
    this._stopLive();
    if (!this.nowEl) return;
    const now = drawnAt ?? Date.now();
    const width = this.viewport.clientWidth;
    if (drawnAt == null) {
      this._runTo(now);
      if (this._following && this._followTo(now)) this._draw();
      // Running bars that may be in view grow to now; nothing else moved.
      else if (width && this._running.length && now >= this.start) {
        const scale = width / (this.end - this.start);
        this._renderEvents(width, (v) => (v - this.start) * scale);
      }
    }
    if (!width) return;
    const scale = width / (this.end - this.start);
    const left = (now - this.start) * scale;
    const inView = left >= 0 && left <= width;
    if (inView) this.nowEl.style.transform = `translateX(${left.toFixed(1)}px)`;
    if (this.nowEl.hidden === inView) this.nowEl.hidden = !inView;
    if (left > width || document.hidden) return;
    const wait = Math.min(left < 0 ? this.start - now : NOW_STEP_PX / scale, NOW_MAX_WAIT);
    const next = () => {
      this._liveTimer = 0;
      this._liveFrame = requestAnimationFrame(() => {
        this._liveFrame = 0;
        this._live();
      });
    };
    // A wait shorter than about a frame goes straight to the next frame.
    if (wait < 16) next();
    else this._liveTimer = setTimeout(next, wait);
  }

  // Pan the view, at its zoom, so now is FOLLOW_MARGIN of the width from its
  // right edge. Not a _setView: it keeps following and leaves the URL alone.
  // Returns whether the view moved.
  _followTo(now) {
    // Rounded to 0.01 ms: end - start drifts by float noise at epoch-ms
    // magnitudes, and a span that drifted far enough would repack the lanes.
    const span = Math.round((this.end - this.start) * 100) / 100;
    const end = now + span * FOLLOW_MARGIN;
    if (end === this.end) return false;
    this.start = end - span;
    this.end = end;
    return true;
  }

  _stopLive() {
    cancelAnimationFrame(this._liveFrame);
    clearTimeout(this._liveTimer);
    this._liveFrame = this._liveTimer = 0;
  }

  // Running bars end at now (or at their start, until now reaches it).
  _runTo(now) {
    for (const it of this._running) it.to = Math.max(it.from, now);
  }

  // Running events' tooltips and story cards say how long they have been
  // running. This timer keeps that text current, once a second, while there
  // are running events and the page is visible, wherever the view is; their
  // bars grow in the live loop. Started at most once, so events streaming in
  // don't keep putting it off.
  _syncRunningText() {
    if (this._runningTimer || !this._running.length || document.hidden) return;
    this._runningTimer = setTimeout(() => {
      this._runningTimer = 0;
      this._renderRunningText();
      this._syncRunningText();
    }, RUNNING_TEXT_MS);
  }

  _renderRunningText() {
    const byId = new Map(this._running.map((it) => [it.id, it]));
    for (const it of this._running) {
      const b = this._buttons.get(it.id);
      if (b) writeIfChanged(b, 'tooltip', this._tooltip(it), (v) => (b.el.title = v));
    }
    for (const el of this.storyEl.querySelectorAll('.ck-running-text')) {
      const it = byId.get(el.dataset.id);
      if (!it) continue;
      const text = this._rangeText(it);
      if (el.textContent !== text) el.textContent = text;
    }
  }

  // Greedy lane packing over every visible-category event at the given scale:
  // each event goes into the first lane whose previous occupant (marker +
  // label) ends before this one starts. Packing the whole data set, not just
  // what is on screen, keeps each event in its lane while panning.
  _layout(scale) {
    this._layoutScale = scale;
    this._laneEnds = [];
    this._pack(this.items);
  }

  // Pack items, in start order and all starting no earlier than those already
  // packed, into the lanes at the current layout scale. Packing events that
  // arrive in time order this way gives the same lanes as a full _layout().
  _pack(items) {
    const scale = this._layoutScale;
    const laneEnds = this._laneEnds;
    for (const it of items) {
      if (it.category && this.hidden.has(it.category)) {
        it.lane = -1;
        continue;
      }
      const isRange = it.to != null;
      const x1 = it.from * scale;
      const x2 = isRange ? it.to * scale : x1;
      const left = isRange ? x1 : x1 - DOT / 2;
      const labelOffset = isRange ? LABEL_PAD : DOT + LABEL_PAD;
      // A running bar keeps growing, so its lane stays taken until it ends.
      const right = it.running ? Infinity : Math.max(x2, left + labelOffset + it.labelWidth) + LANE_GAP;
      let lane = laneEnds.findIndex((end) => end <= left);
      if (lane < 0) lane = laneEnds.push(right) - 1;
      else laneEnds[lane] = right;
      it.lane = lane;
    }
    this._laneCount = laneEnds.length;
  }

  _invalidateLayout() {
    this._layoutScale = null;
    this._scheduleRender();
  }

  _renderAxis(scale, x) {
    let ticks = '';
    let lines = '';
    for (const { value, label } of this.scale.ticks(this.start, this.end, scale, MIN_TICK_GAP, this.m)) {
      const left = x(value).toFixed(1);
      ticks += `<span class="ck-tick" style="left:${left}px">${esc(label)}</span>`;
      lines += `<span class="ck-gridline" style="left:${left}px"></span>`;
    }
    this.axisEl.innerHTML = ticks;
    this.gridEl.innerHTML = lines;
    // The clock scale names its time zone, so screenshots aren't ambiguous.
    const zone = this.scale.zoneLabel?.(this.start, this.end) ?? '';
    if (this.zoneEl.textContent !== zone) this.zoneEl.textContent = zone;
    this.zoneEl.hidden = !zone;
  }

  // Each event on screen keeps one button, found by its id, from render to
  // render; a render only changes what differs. Rebuilding the buttons on
  // every render, as the view follows the time, would replace the button
  // under the pointer between press and release, so a click, a tooltip or a
  // hover never landed. Buttons come and go as events enter and leave the
  // view, and stay in the events' order, which is the Tab order.
  _renderEvents(width, x) {
    const rev = this._revealing;
    const now = performance.now();
    const inner = this._lanesInner;
    const shown = [];
    for (const it of this.items) {
      if (it.lane < 0) continue;
      const isRange = it.to != null;
      const x1 = x(it.from);
      const x2 = isRange ? x(it.to) : x1;
      const left = isRange ? x1 : x1 - DOT / 2;
      // Range labels stick to the left edge while the bar is partly off-screen,
      // but never slide past the space the lane packing reserved for them.
      const labelOffset = isRange
        ? Math.min(Math.max(0, -x1), Math.max(0, x2 - x1 - it.labelWidth - LABEL_PAD)) + LABEL_PAD
        : DOT + LABEL_PAD;
      const right = Math.max(x2, left + labelOffset + it.labelWidth);
      if ((isRange ? x2 : right) < 0 || left > width) continue;

      const b = this._buttons.get(it.id) ?? this._newButton(it.id);
      b.seen = true;
      shown.push(b);
      const { el, label } = b;
      const on = this.selected.has(it.id);
      // A revealed event pulses for FLASH_MS (ck-flash), and a newly added
      // one flashes more softly for as long (ck-new); a reveal wins. A button
      // that comes into view mid-flash starts it where it is, by a negative
      // animation-delay; one revealed again restarts it.
      const revealAt = rev?.id === it.id && now - rev.at < FLASH_MS ? rev.at : null;
      const addedAt = it.addedAt != null && now - it.addedAt < FLASH_MS ? it.addedAt : null;
      const flashAt = revealAt ?? addedAt;
      const flash = revealAt != null ? ' ck-flash' : addedAt != null ? ' ck-new' : '';
      if (flashAt !== b.flashAt) {
        b.flashAt = flashAt;
        el.style.animationDelay = flash ? `-${Math.round(now - flashAt)}ms` : '';
        if (flash && el.classList.contains(flash.trim())) {
          el.classList.remove(flash.trim());
          void el.offsetWidth; // restart the animation
        }
      }
      const cls =
        `ck-event ${isRange ? 'ck-range' : 'ck-point'}${it.running ? ' ck-running' : ''}${on ? ' ck-selected' : ''}` +
        `${this._hoverClass(it)}${flash}`;
      if (el.className !== cls) el.className = cls;
      const pressed = String(on);
      if (el.getAttribute('aria-pressed') !== pressed) el.setAttribute('aria-pressed', pressed);

      const title = it.event.title ?? '';
      writeIfChanged(b, 'text', title, () => (label.textContent = title));
      writeIfChanged(b, 'tooltip', this._tooltip(it), (v) => (el.title = v));
      writeIfChanged(b, 'color', it.color, () => el.style.setProperty('--ck-color', it.color));
      writeIfChanged(b, 'left', `${left.toFixed(1)}px`, (v) => (el.style.left = v));
      writeIfChanged(b, 'top', `${LANE_TOP + it.lane * LANE_HEIGHT}px`, (v) => (el.style.top = v));
      writeIfChanged(b, 'width', isRange ? `${Math.max(x2 - x1, 4).toFixed(1)}px` : '', (v) => (el.style.width = v));
      writeIfChanged(b, 'labelLeft', isRange ? `${labelOffset.toFixed(1)}px` : '', (v) => (label.style.left = v));
      // A point has a dot before its label; a point that gets an end loses it.
      if (isRange && b.dot) {
        b.dot.remove();
        b.dot = null;
      } else if (!isRange && !b.dot) {
        b.dot = document.createElement('span');
        b.dot.className = 'ck-dot';
        el.insertBefore(b.dot, label);
      }
    }

    // Buttons whose event left the view, or is gone or hidden. A focused one
    // can't keep focus; keep it in the timeline.
    for (const [id, b] of this._buttons) {
      if (b.seen) {
        b.seen = false;
        continue;
      }
      if (b.el === document.activeElement) this.viewport.focus({ preventScroll: true });
      b.el.remove();
      this._buttons.delete(id);
    }
    // Put the buttons in the events' order, moving only those out of place:
    // new ones, and any whose event moved past another.
    let prev = null;
    for (const { el } of shown) {
      const want = prev ? prev.nextSibling : inner.firstChild;
      if (el !== want) inner.insertBefore(el, want);
      prev = el;
    }
    writeIfChanged(this, '_lanesHeight', `${LANE_TOP * 2 + this._laneCount * LANE_HEIGHT}px`, (v) => (inner.style.height = v));
    if (rev?.pending) this._finishReveal(rev);
  }

  _newButton(id) {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.id = id;
    const label = document.createElement('span');
    label.className = 'ck-label';
    el.append(label);
    const b = { el, label, dot: null, flashAt: null, seen: false };
    this._buttons.set(id, b);
    return b;
  }

  // After reveal() has moved the view: scroll the event's lane into view inside
  // the timeline, bring the timeline on screen and focus the event.
  _finishReveal(rev) {
    rev.pending = false;
    const el = this._buttons.get(rev.id)?.el;
    if (!el) return;
    const lanes = this.lanesEl;
    if (el.offsetTop < lanes.scrollTop || el.offsetTop + el.offsetHeight > lanes.scrollTop + lanes.clientHeight) {
      lanes.scrollTop = el.offsetTop - (lanes.clientHeight - el.offsetHeight) / 2;
    }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.viewport.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }

  _renderLegend() {
    this.legendEl.innerHTML = this.categories
      .map(
        (c) => `<button type="button" class="ck-legend-item" data-category="${esc(c)}"
                  aria-pressed="${!this.hidden.has(c)}" style="--ck-color:${esc(this.colorOf.get(c))}">
                  <span class="ck-swatch"></span>${esc(this._categoryLabel(c))}</button>`,
      )
      .join('');
  }

  // Every tag in the events, alphabetically by label, with how many events
  // have it. Hidden when no event has tags.
  _renderTagbar() {
    const counts = new Map();
    for (const it of this.items) for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const tags = [...counts.keys()].sort((a, b) => this._tagLabel(a).localeCompare(this._tagLabel(b), this.options.language));
    this.tagbarEl.hidden = !tags.length;
    this.tagbarEl.querySelector('.ck-count').textContent = tags.length;
    this.tagbarEl.querySelector('.ck-tags').innerHTML = tags
      .map(
        (t) => `<li><button type="button" class="ck-tag" data-tag="${esc(t)}" aria-pressed="false">${esc(this._tagLabel(t))} <span class="ck-tag-count">${counts.get(t)}</span></button></li>`,
      )
      .join('');
  }

  // The story lists selected events in chronological order: a card at each
  // start date, plus a small end marker at each range's end date, so the
  // list reads top to bottom as one sequence of moments.
  _renderStory() {
    const items = this.items.filter((it) => this.selected.has(it.id));
    // Beside the timeline the story column stays when empty, so the first
    // selection doesn't narrow the timeline under the pointer.
    const side = this.options.storyPosition === 'right';
    this.storyEl.hidden = !items.length && !side;
    this.storyEl.classList.toggle('ck-empty', !items.length);
    this.root.classList.toggle('ck-has-selection', items.length > 0);
    if (!items.length) {
      this.storyEl.innerHTML = side ? `<p class="ck-story-placeholder">${esc(this.m.placeholder)}</p>` : '';
      return;
    }
    const entries = items.map((item) => ({ item, at: item.from, isEnd: false }));
    for (const item of items) {
      // On the clock scale the marker sits where the range stops, so a
      // date-only end on the start's day comes after it. A historical end sits
      // at its date; one with coarser precision than the start (e.g. "1453"
      // after "1453-04-06") can sort before it, and gets no marker.
      const at = item.end && (this.scale.zone ? item.to : item.end.value);
      if (item.end && at > item.from) entries.push({ item, at, isEnd: true });
    }
    // Stable sort keeps start-date order among ties; an end sorts before a start
    // at the same moment, so "X ends" reads before "Y begins".
    entries.sort((a, b) => a.at - b.at || b.isEnd - a.isEnd);
    this.storyEl.innerHTML = `
      <div class="ck-story-header">
        <span class="ck-story-title">${esc(this.m.selectedEvents)} <span class="ck-count">${this.m.number.format(items.length)}</span></span>
        <button type="button" class="ck-clear">${esc(this.m.clearAll)}</button>
      </div>
      <ol class="ck-story-list">${entries
        .map((en) => (en.isEnd ? this._storyEnd(en.item) : this._storyCard(en.item)))
        .join('')}</ol>`;
  }

  _storyEnd(item) {
    const m = this.m;
    const title = esc(item.event.title ?? '');
    const date = esc(this._endText(item));
    const duration = esc(this._lastedText(item));
    return `
      <li class="ck-end" style="--ck-color:${esc(item.color)}">
        <button type="button" class="ck-end-jump${this._hoverClass(item)}" data-id="${esc(item.id)}"
                aria-label="${m.endsAria(title, date, duration)}">
          <span class="ck-end-date">${date}</span>
          <span>${m.endOf(`<strong>${title}</strong>`)}</span>
          ${duration ? `<span class="ck-end-duration">${m.lasted(duration)}</span>` : ''}
        </button>
      </li>`;
  }

  _jumpToCard(id) {
    const card = [...this.storyEl.querySelectorAll('.ck-card')].find((el) => el.dataset.id === id);
    if (!card) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    card.focus({ preventScroll: true });
    card.classList.remove('ck-flash');
    void card.offsetWidth; // restart the animation on repeated clicks
    card.classList.add('ck-flash');
  }

  _storyCard(item) {
    const e = item.event;
    const safeUrl = e.url && /^https?:\/\//i.test(e.url) ? e.url : null;
    return `
      <li class="ck-card${this._hoverClass(item)}" data-id="${esc(item.id)}" tabindex="-1"
          style="--ck-color:${esc(item.color)}">
        <button type="button" class="ck-remove" data-id="${esc(item.id)}"
                aria-label="${this.m.remove(esc(e.title ?? ''))}">×</button>
        <div class="ck-meta">
          ${item.category ? `<span class="ck-badge">${esc(this._categoryLabel(item.category))}</span>` : ''}
          ${item.running
            ? `<span class="ck-running-text" data-id="${esc(item.id)}">${esc(this._rangeText(item))}</span>`
            : `<span>${esc(this._rangeText(item))}</span>`}
        </div>
        <h3 class="ck-title">${esc(e.title ?? '')}</h3>
        ${e.description ? `<p class="ck-description">${esc(e.description)}</p>` : ''}
        ${item.tags.length ? `<ul class="ck-tags" aria-label="${esc(this.m.tags)}">${item.tags.map((t) => `<li><button type="button" class="ck-tag" data-tag="${esc(t)}" aria-pressed="false">${esc(this._tagLabel(t))}</button></li>`).join('')}</ul>` : ''}
        <div class="ck-card-actions">
          <button type="button" class="ck-locate" data-id="${esc(item.id)}">${esc(this.m.showOnTimeline)}</button>
          ${safeUrl ? `<a class="ck-link" href="${esc(safeUrl)}" target="_blank" rel="noopener">${esc(this.m.readMore)}</a>` : ''}
        </div>
      </li>`;
  }

  _tooltip(item) {
    return `${item.event.title ?? ''} · ${this._rangeText(item)}`;
  }

  // A running event says how long it has run so far, to the second at most,
  // or no less coarsely than its start was given; one that starts later
  // than now shows only its start.
  _rangeText(item) {
    const start = this.scale.formatDate(item.start, this.m);
    if (item.running) {
      const now = { scale: 'clock', value: Date.now(), precision: 'second' };
      const duration = this.scale.formatDuration(item.start, now, this.m);
      return duration ? this.m.runningFor(start, duration) : start;
    }
    return item.end ? `${start} – ${this._endText(item)}` : start;
  }

  // The clock scale words a range's end itself (see timeEndText); historical
  // ends are plain dates.
  _endText(item) {
    const { formatEnd, formatDate } = this.scale;
    return formatEnd ? formatEnd(item.end, item.to, this.m) : formatDate(item.end, this.m);
  }

  // How long an event lasted. The clock scale measures to where the range
  // stops (see timeRangeDurationText); historical durations run to the end
  // date, so 1337 to 1453 is 116 years.
  _lastedText(item) {
    const { formatLasted, formatDuration } = this.scale;
    return formatLasted
      ? formatLasted(item.start, item.end, item.to, this.m)
      : formatDuration(item.start, item.end, this.m);
  }

  _hoverClass(item) {
    return this._hoverId === item.id ? ' ck-hover' : '';
  }

  // Categories stay the keys for colors, the URL hash and getState(); only the
  // text shown is translated.
  _categoryLabel(category) {
    return this.options.categoryLabels[category] ?? category;
  }

  // Likewise, tags stay the keys that match events to each other; only the
  // text shown is translated.
  _tagLabel(tag) {
    return this.options.tagLabels[tag] ?? tag;
  }
}

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
// Dates are converted to fractional years ("values"), e.g. 1453-05-29 → ~1453.41.
// Negative years are BCE. Year zero is not skipped, so positions across the
// BCE/CE boundary are off by one year, which is invisible at historical scales.

import LOCALES from './locales/index.js';

const PALETTE = ['#4e79a7', '#e15759', '#59a14f', '#f28e2b', '#b07aa1', '#76b7b2', '#edc948', '#9c755f'];
const UNIT = { year: 1, month: 1 / 12, day: 1 / 372 };
const TICK_STEPS = [1 / 12, 1 / 4, ...[1, 10, 100, 1000, 10000, 100000].flatMap((p) => [p, 2 * p, 5 * p])];
const MIN_TICK_GAP = 90; // px between axis labels
const LANE_HEIGHT = 30; // px, matches .ck-event height + spacing in CSS
const LANE_TOP = 12; // px above the first lane
const DOT = 10; // px, point marker diameter
const LABEL_PAD = 6; // px between marker and label
const LANE_GAP = 12; // px kept free after a label before the next event in the lane
const FLASH_MS = 1500; // matches the .ck-event.ck-flash animation in CSS

/**
 * Parse a historical date.
 * Accepts a number (year), a string "YYYY", "YYYY-MM" or "YYYY-MM-DD" (negative
 * year for BCE, e.g. "-44-03-15"), or an object { year, month?, day? }.
 * Throws if the date doesn't exist, e.g. month 13 or 31 April. 29 February is
 * accepted in any year, since historical dates may use the Julian calendar.
 */
export function parseDate(input) {
  if (input == null || input === '') return null;
  const shown = typeof input === 'object' ? JSON.stringify(input) : typeof input === 'string' ? `"${input}"` : String(input);
  let year, month, day;
  if (typeof input === 'number') {
    // Any finite number, so fractional years from getState() work too.
    if (!Number.isFinite(input)) throw new Error(`Chroniko: invalid date ${shown}`);
    return withValue(input);
  }
  if (typeof input === 'object') {
    ({ year, month, day } = input);
  } else {
    const m = /^(-?\d+)(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(String(input).trim());
    if (!m) throw new Error(`Chroniko: cannot parse date ${shown}`);
    [year, month, day] = [Number(m[1]), m[2] && Number(m[2]), m[3] && Number(m[3])];
  }
  const problem = dateProblem(year, month ?? null, day ?? null);
  if (problem) throw new Error(`Chroniko: invalid date ${shown}: ${problem}`);
  return withValue(year, month, day);
}

const MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function dateProblem(year, month, day) {
  if (!Number.isInteger(year)) return 'year must be a whole number';
  if (month != null && !(Number.isInteger(month) && month >= 1 && month <= 12)) return 'month must be 1–12';
  if (day != null) {
    if (month == null) return 'a day needs a month';
    if (!(Number.isInteger(day) && day >= 1 && day <= MAX_DAYS[month - 1])) {
      return `day must be 1–${MAX_DAYS[month - 1]} in ${LOCALES.en.months[month - 1]}`;
    }
  }
  return null;
}

function withValue(year, month, day) {
  let value = year;
  if (month) value += (month - 1) / 12;
  if (day) value += (day - 1) / 372;
  const precision = day ? 'day' : month ? 'month' : 'year';
  return { year, month: month || null, day: day || null, precision, value };
}

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

/** A parseDate() result in the given language, e.g. "19 Mar 1644". */
export function formatDate(d, language = 'en') {
  return dateText(d, messagesFor(language));
}

function dateText(d, m) {
  const year = m.year(d.year);
  if (d.day) return m.day(d.day, m.months[d.month - 1], year);
  if (d.month) return m.month(m.months[d.month - 1], year);
  return year;
}

/**
 * How long a range lasted, e.g. "116 years" or "2 years, 11 months", at the
 * coarser precision of its two dates and in at most two adjacent units.
 * There is no year zero: 1 BCE (year -1) is followed by 1 CE, so 27 BCE to
 * 14 CE is 40 years. Returns "" if end is before start.
 */
export function formatDuration(start, end, language = 'en') {
  return durationText(start, end, messagesFor(language));
}

function durationText(start, end, m) {
  const astro = (y) => (y < 0 ? y + 1 : y); // 1 BCE → 0, 2 BCE → -1, …
  const precisions = [start.precision, end.precision];
  const unit = precisions.includes('year') ? 'year' : precisions.includes('month') ? 'month' : 'day';
  let years = astro(end.year) - astro(start.year);
  let months = unit === 'year' ? 0 : end.month - start.month;
  let days = unit === 'day' ? end.day - start.day : 0;
  if (days < 0) {
    // Borrow the month before end's. A start day past that month's length
    // (31 Jan → 1 Mar) counts from its last day, so days never go negative.
    months -= 1;
    days = Math.max(daysInMonth(astro(end.year), end.month - 1) - start.day, 0) + end.day;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return '';
  const parts = [['year', years], ['month', months], ['day', days]];
  const first = parts.findIndex(([, n]) => n > 0);
  if (first < 0) return m.lessThan[unit];
  const amount = ([name, n]) => {
    const forms = m.units[name];
    return (forms[m.plural.select(n)] ?? forms.other).replace('#', m.number.format(n));
  };
  const next = parts[first + 1];
  return next?.[1] > 0 ? `${amount(parts[first])}${m.unitJoin}${amount(next)}` : amount(parts[first]);
}

// Days in a month of a proleptic Gregorian astronomical year; month 0 is the
// previous year's December.
function daysInMonth(year, month) {
  if (month === 0) return 31;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function rangeText(item, m) {
  const start = dateText(item.start, m);
  return item.end ? `${start} – ${dateText(item.end, m)}` : start;
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

function tickLabel(value, step, m) {
  if (step >= 1) return m.year(Math.round(value));
  const year = Math.floor(value + 1e-9);
  const month = Math.round((value - year) * 12) % 12;
  return month === 0 ? m.year(year) : m.months[month];
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export class Chroniko {
  /**
   * @param {string|HTMLElement} container  Element (or selector) to render into.
   * @param {object} options
   * @param {Array}  options.events     [{ id, title, start, end?, category?, description?, url?, color? }]
   * @param {*}      [options.start]    Initial visible range start (any parseDate input).
   * @param {*}      [options.end]      Initial visible range end. Fits all events when omitted.
   * @param {object} [options.colors]   Category → color, e.g. { war: '#c0392b' }.
   * @param {number} [options.minSpan]  Smallest visible span in years (default: 1 month).
   * @param {number} [options.maxSpan]  Largest visible span in years (default: 3× the data span).
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
   */
  constructor(container, options = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) throw new Error('Chroniko: container not found');
    this.options = {
      minSpan: 1 / 12,
      colors: {},
      storyPosition: 'below',
      split: 0.6,
      dimToggle: true,
      language: 'en',
      categoryLabels: {},
      ...options,
    };
    const { storyPosition, split } = this.options;
    if (storyPosition !== 'below' && storyPosition !== 'right') {
      throw new Error(`Chroniko: storyPosition must be 'below' or 'right', got ${JSON.stringify(storyPosition)}`);
    }
    if (!(typeof split === 'number' && split > 0 && split < 1)) {
      throw new Error(`Chroniko: split must be a number between 0 and 1, got ${JSON.stringify(split)}`);
    }
    this.m = messagesFor(this.options.language, this.options.uiText);
    this.items = [];
    this.hidden = new Set();
    this.selected = new Set();
    this.start = 0;
    this.end = 1;
    this._frame = 0;
    this._build(el);
    this._bind();
    this.setEvents(options.events ?? []);
    if (options.start != null && options.end != null) this.zoomTo(options.start, options.end);
    else this.fit();
    if (this.options.syncUrl) {
      this._onHashChange = () => this._readHash();
      window.addEventListener('hashchange', this._onHashChange);
      this._readHash();
      clearTimeout(this._hashTimer); // loading the page shouldn't rewrite its URL
    }
  }

  // ---- Public API ---------------------------------------------------------

  setEvents(events) {
    const items = events
      .map((event, i) => {
        // Name the event in date errors, so bad data is easy to find.
        const date = (field) => {
          try {
            return parseDate(event[field]);
          } catch (err) {
            const reason = err.message.replace(/^Chroniko: /, '');
            throw new Error(`Chroniko: event "${event.title ?? i}" has an invalid ${field}: ${reason}`);
          }
        };
        const start = date('start');
        if (!start) throw new Error(`Chroniko: event "${event.title ?? i}" has no start date`);
        const end = date('end');
        return {
          event,
          id: String(event.id ?? defaultId(event, i)),
          start,
          end,
          from: start.value,
          to: end ? end.value + UNIT[end.precision] : null,
          category: event.category ?? null,
        };
      })
      .sort((a, b) => a.from - b.from);

    // Ids key selection and DOM lookups; two events sharing one would select
    // together. Checked before any state changes, so a bad call leaves the
    // timeline as it was.
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
    this.items = items;

    this.categories = [...new Set(this.items.map((it) => it.category).filter(Boolean))];
    // Categories without a configured color take palette colors not already in use.
    const used = new Set(Object.values(this.options.colors));
    const free = PALETTE.filter((c) => !used.has(c));
    let next = 0;
    this.colorOf = new Map(
      this.categories.map((c) => [c, this.options.colors[c] ?? free[next++ % free.length] ?? PALETTE[0]]),
    );
    for (const it of this.items) it.color = it.event.color ?? this.colorOf.get(it.category) ?? PALETTE[0];

    const [min, max] = this._extent();
    this._dataSpan = max - min;
    this._measureLabels();
    this._renderLegend();
    this.selected = new Set(this.items.filter((it) => this.selected.has(it.id)).map((it) => it.id));
    this._renderStory();
    this._invalidateLayout();
  }

  /**
   * Show the range [start, end]; accepts any parseDate input. A span outside
   * minSpan/maxSpan is clamped around the range's center.
   */
  zoomTo(start, end) {
    const from = parseDate(start)?.value;
    const to = parseDate(end)?.value;
    if (from == null || to == null) throw new Error('Chroniko: zoomTo needs both a start and an end');
    if (from >= to) throw new Error(`Chroniko: zoomTo start (${start}) must be before end (${end})`);
    const center = (from + to) / 2;
    const span = this._clampSpan(to - from);
    this._setView(center - span / 2, center + span / 2);
  }

  /** Zoom so every event is visible. */
  fit() {
    if (!this.items.length) return this._setView(0, 2000);
    const [min, max] = this._extent();
    const span = Math.max(max - min, 1);
    this._setView(min - span * 0.04, max + span * 0.12);
  }

  /** factor < 1 zooms in, > 1 zooms out. ratio is the anchor point across the width (0–1). */
  zoomBy(factor, ratio = 0.5) {
    const span = this.end - this.start;
    const anchor = this.start + span * ratio;
    const next = this._clampSpan(span * factor);
    this._setView(anchor - next * ratio, anchor - next * ratio + next);
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

  /** The view (in fractional years), selected ids and hidden categories, for saving or sharing. */
  getState() {
    return {
      start: this.start,
      end: this.end,
      selected: this.items.filter((it) => this.selected.has(it.id)).map((it) => it.id),
      hidden: [...this.hidden],
    };
  }

  /**
   * Restore a state from getState(). Every field is optional, so a partial
   * state changes only what it names. Unknown event ids are ignored.
   */
  setState(state = {}) {
    if (state.start != null && state.end != null) this.zoomTo(state.start, state.end);
    if (state.hidden) this._setHidden(state.hidden.map(String));
    if (state.selected) {
      const ids = new Set(state.selected.map(String));
      this._setSelection(this.items.filter((it) => ids.has(it.id)).map((it) => it.id));
    }
  }

  destroy() {
    cancelAnimationFrame(this._frame);
    clearTimeout(this._zoomTimer);
    clearTimeout(this._hintTimer);
    clearTimeout(this._hashTimer);
    if (this._onHashChange) window.removeEventListener('hashchange', this._onHashChange);
    this._resizeObserver.disconnect();
    document.fonts?.removeEventListener('loadingdone', this._onFontsLoaded);
    this.root.remove();
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
              <button type="button" data-action="zoom-in" aria-label="${esc(m.zoomIn)}">+</button>
              <button type="button" data-action="zoom-out" aria-label="${esc(m.zoomOut)}">−</button>
              <button type="button" data-action="fit">${esc(m.fit)}</button>
              ${this.options.dimToggle ? `<button type="button" data-action="dim" aria-pressed="true" aria-label="${esc(m.dimUnselected)}">◐</button>` : ''}
              ${this.options.textSizeToggle ? `<button type="button" data-action="text-size" aria-pressed="false" aria-label="${esc(m.largerText)}">Aa</button>` : ''}
            </div>
          </div>
          <div class="ck-viewport" tabindex="0" aria-label="${m.viewport(esc(ctrl))}">
            <div class="ck-grid"></div>
            <div class="ck-lanes"></div>
            <div class="ck-axis"></div>
            <div class="ck-hint" aria-hidden="true"></div>
          </div>
        </div>
        <section class="ck-story" aria-label="${esc(m.selectedEvents)}" hidden></section>
      </div>`;
    el.append(this.root);
    this.legendEl = this.root.querySelector('.ck-legend');
    this.viewport = this.root.querySelector('.ck-viewport');
    this.gridEl = this.root.querySelector('.ck-grid');
    this.lanesEl = this.root.querySelector('.ck-lanes');
    this.axisEl = this.root.querySelector('.ck-axis');
    this.storyEl = this.root.querySelector('.ck-story');
    this.hintEl = this.root.querySelector('.ck-hint');
    this.hintEl.innerHTML = m.hint(esc(ctrl));
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
        this._setView(start, start + span);
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
      if (remove) this.deselect(remove.dataset.id);
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
  }

  // Dimming applies only while something is selected; see ck-has-selection in _renderStory.
  _toggleDim(button) {
    button.setAttribute('aria-pressed', this.root.classList.toggle('ck-dim'));
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
    for (const el of this.lanesEl.querySelectorAll('.ck-event')) {
      const on = this.selected.has(el.dataset.id);
      el.classList.toggle('ck-selected', on);
      el.setAttribute('aria-pressed', on);
    }
    this._renderStory();
    this._stateChanged();
    this.options.onSelectionChange?.(this.getSelection());
  }

  _setView(start, end) {
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
    if (params.has('ck-sel')) state.selected = list('ck-sel');
    if (params.has('ck-hide')) state.hidden = list('ck-hide');
    this.setState(state);
  }

  _writeHash() {
    const { start, end, selected, hidden } = this.getState();
    const params = hashParams();
    // Enough decimals to keep the view to about a thousandth of its span.
    const digits = Math.min(6, Math.max(0, Math.ceil(3 - Math.log10(end - start))));
    params.set('ck-view', `${+start.toFixed(digits)},${+end.toFixed(digits)}`);
    for (const [key, values] of [['ck-sel', selected], ['ck-hide', hidden]]) {
      if (values.length) params.set(key, values.map(encodeURIComponent).join(','));
      else params.delete(key);
    }
    const hash = [...params].map(([k, v]) => (v == null ? k : `${k}=${v}`)).join('&');
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${hash}`);
  }

  _clampSpan(span) {
    const max = this.options.maxSpan ?? Math.max(this._dataSpan * 3, 100);
    return Math.min(Math.max(span, this.options.minSpan), max);
  }

  _scale() {
    return (this.viewport.clientWidth || 1) / (this.end - this.start);
  }

  _ratioAt(clientX) {
    const rect = this.viewport.getBoundingClientRect();
    return (clientX - rect.left) / rect.width;
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
  _measureLabels() {
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
    for (const it of this.items) {
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

  // Greedy lane packing over every visible-category event at the given scale:
  // each event goes into the first lane whose previous occupant (marker +
  // label) ends before this one starts. Packing the whole data set, not just
  // what is on screen, keeps each event in its lane while panning.
  _layout(scale) {
    const laneEnds = [];
    for (const it of this.items) {
      if (it.category && this.hidden.has(it.category)) {
        it.lane = -1;
        continue;
      }
      const isRange = it.to != null;
      const x1 = it.from * scale;
      const x2 = isRange ? it.to * scale : x1;
      const left = isRange ? x1 : x1 - DOT / 2;
      const labelOffset = isRange ? LABEL_PAD : DOT + LABEL_PAD;
      const right = Math.max(x2, left + labelOffset + it.labelWidth) + LANE_GAP;
      let lane = laneEnds.findIndex((end) => end <= left);
      if (lane < 0) lane = laneEnds.push(right) - 1;
      else laneEnds[lane] = right;
      it.lane = lane;
    }
    this._laneCount = laneEnds.length;
    this._layoutScale = scale;
  }

  _invalidateLayout() {
    this._layoutScale = null;
    this._scheduleRender();
  }

  _renderAxis(scale, x) {
    const step = TICK_STEPS.find((s) => s * scale >= MIN_TICK_GAP) ?? TICK_STEPS.at(-1);
    let ticks = '';
    let lines = '';
    for (let i = Math.ceil(this.start / step); i * step <= this.end; i++) {
      const v = i * step;
      const left = x(v).toFixed(1);
      ticks += `<span class="ck-tick" style="left:${left}px">${esc(tickLabel(v, step, this.m))}</span>`;
      lines += `<span class="ck-gridline" style="left:${left}px"></span>`;
    }
    this.axisEl.innerHTML = ticks;
    this.gridEl.innerHTML = lines;
  }

  _renderEvents(width, x) {
    // Rebuilding the buttons drops focus, so remember which event had it.
    const focused = this.lanesEl.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    // A revealed event pulses for FLASH_MS. Buttons are rebuilt on every render,
    // so a negative animation-delay resumes the pulse where it was.
    const rev = this._revealing;
    const flashAge = rev ? performance.now() - rev.at : Infinity;
    let html = '';
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

      const top = LANE_TOP + it.lane * LANE_HEIGHT;
      const on = this.selected.has(it.id);
      const flash = rev?.id === it.id && flashAge < FLASH_MS;
      const cls =
        `ck-event ${isRange ? 'ck-range' : 'ck-point'}${on ? ' ck-selected' : ''}` +
        `${this._hoverClass(it)}${flash ? ' ck-flash' : ''}`;
      const style =
        `--ck-color:${esc(it.color)};left:${left.toFixed(1)}px;top:${top}px` +
        (flash ? `;animation-delay:-${Math.round(flashAge)}ms` : '');
      const title = esc(it.event.title ?? '');
      const attrs = `type="button" class="${cls}" data-id="${esc(it.id)}" aria-pressed="${on}"
        title="${title} · ${esc(rangeText(it, this.m))}"`;
      html += isRange
        ? `<button ${attrs} style="${style};width:${Math.max(x2 - x1, 4).toFixed(1)}px">
             <span class="ck-label" style="left:${labelOffset.toFixed(1)}px">${title}</span></button>`
        : `<button ${attrs} style="${style}">
             <span class="ck-dot"></span><span class="ck-label">${title}</span></button>`;
    }
    const height = LANE_TOP * 2 + this._laneCount * LANE_HEIGHT;
    this.lanesEl.innerHTML = `<div class="ck-lanes-inner" style="height:${height}px">${html}</div>`;
    if (focused != null) {
      const el = [...this.lanesEl.querySelectorAll('.ck-event')].find((b) => b.dataset.id === focused);
      // An event panned out of view can't keep focus; keep it in the timeline.
      (el ?? this.viewport).focus({ preventScroll: true });
    }
    if (rev?.pending) this._finishReveal(rev);
  }

  // After reveal() has moved the view: scroll the event's lane into view inside
  // the timeline, bring the timeline on screen and focus the event.
  _finishReveal(rev) {
    rev.pending = false;
    const el = [...this.lanesEl.querySelectorAll('.ck-event')].find((b) => b.dataset.id === rev.id);
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
      // An end with coarser precision than the start (e.g. "1453" after
      // "1453-04-06") can sort before it; such an end gets no marker.
      if (item.end && item.end.value > item.from) entries.push({ item, at: item.end.value, isEnd: true });
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
    const date = esc(dateText(item.end, m));
    const duration = esc(durationText(item.start, item.end, m));
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
          <span>${esc(rangeText(item, this.m))}</span>
        </div>
        <h3 class="ck-title">${esc(e.title ?? '')}</h3>
        ${e.description ? `<p class="ck-description">${esc(e.description)}</p>` : ''}
        <div class="ck-card-actions">
          <button type="button" class="ck-locate" data-id="${esc(item.id)}">${esc(this.m.showOnTimeline)}</button>
          ${safeUrl ? `<a class="ck-link" href="${esc(safeUrl)}" target="_blank" rel="noopener">${esc(this.m.readMore)}</a>` : ''}
        </div>
      </li>`;
  }

  _hoverClass(item) {
    return this._hoverId === item.id ? ' ck-hover' : '';
  }

  // Categories stay the keys for colors, the URL hash and getState(); only the
  // text shown is translated.
  _categoryLabel(category) {
    return this.options.categoryLabels[category] ?? category;
  }
}

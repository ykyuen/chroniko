// The clock scale: dates are instants in epoch ms, for timelines measured in
// days, hours, minutes and seconds. Wall-clock fields always come from a zone
// object (see ../zone.js); this module never reads Date fields itself.
//
// A parsed time is { scale: 'clock', value, precision }: value is epoch ms and
// precision ('day', 'minute', 'second' or 'ms') is how precisely it was given.
// The scale tag lets formatDate() tell it apart from a historical date.

import LOCALES from '../locales/index.js';
import { local, utc } from '../zone.js';
import { durationWords } from './duration.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// YYYY-MM-DD, optionally followed by T (or a space) and HH:MM[:SS[.fraction]],
// then an optional Z or ±HH:MM offset. An offset needs a time.
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?)?$/i;

/**
 * Parse a clock time.
 * Accepts epoch ms, a Date, or an ISO string: "2026-10-28", "2026-10-28T10:30",
 * "2026-10-28T10:30:15.250Z", "2026-10-28T10:30+08:00". Strings with Z or an
 * offset are exact. Strings without one are read as wall-clock time in the
 * zone (local time by default), including date-only strings: unlike JS, which
 * reads "2026-10-28" as UTC midnight, this is local midnight.
 * Throws if the input can't be read or the time doesn't exist, e.g. 30 Feb.
 */
export function parseTime(input, zone = local) {
  if (input == null || input === '') return null;
  if (typeof input === 'number' || input instanceof Date) {
    const value = typeof input === 'number' ? input : input.getTime();
    if (!Number.isFinite(value)) throw new Error(`Chroniko: invalid time ${typeof input === 'number' ? input : 'Invalid Date'}`);
    return { scale: 'clock', value, precision: 'ms' };
  }
  const shown = typeof input === 'string' ? `"${input}"` : typeof input === 'object' ? JSON.stringify(input) : String(input);
  const m = typeof input === 'string' ? ISO.exec(input.trim()) : null;
  if (!m) throw new Error(`Chroniko: cannot parse time ${shown}`);

  const [year, month, day, hour, minute, second] = m.slice(1, 7).map((s) => (s == null ? undefined : Number(s)));
  const fraction = m[7];
  const fields = { year, month, day, hour: hour ?? 0, minute: minute ?? 0, second: second ?? 0, ms: fraction ? Number(fraction.slice(0, 3).padEnd(3, '0')) : 0 };
  const problem = timeProblem(fields);
  if (problem) throw new Error(`Chroniko: invalid time ${shown}: ${problem}`);

  const precision = fraction ? 'ms' : second != null ? 'second' : hour != null ? 'minute' : 'day';
  const offset = m[8];
  const value = offset ? utc.instant(fields) - offsetMs(offset) : zone.instant(fields);
  return { scale: 'clock', value, precision };
}

function timeProblem({ year, month, day, hour, minute, second }) {
  if (month < 1 || month > 12) return 'month must be 1–12';
  const days = daysInMonth(year, month);
  if (day < 1 || day > days) return `day must be 1–${days} in ${LOCALES.en.months[month - 1]}`;
  if (hour > 23) return 'hour must be 0–23';
  if (minute > 59) return 'minute must be 0–59';
  if (second > 59) return 'second must be 0–59';
  return null;
}

function daysInMonth(year, month) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function offsetMs(offset) {
  if (offset.toUpperCase() === 'Z') return 0;
  const [, sign, hh, mm] = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  return (sign === '-' ? -1 : 1) * (Number(hh) * HOUR + Number(mm) * MINUTE);
}

/**
 * A parseTime() result in the language of the UI messages m, e.g.
 * "28 Oct 2026, 10:30". The date is written by the locale's day(), as for
 * historical dates. Times use the 24-hour clock in every language, since
 * timelines of deploys and logs read best that way, with the language's
 * decimal mark before milliseconds.
 * Everything comes from zone.fields(), not Intl.DateTimeFormat, whose
 * formatters fix the time zone when they are created.
 */
export function timeText(d, m, zone = local) {
  const { year, month, day, hour, minute, second, ms } = zone.fields(d.value);
  const date = m.day(day, m.months[month - 1], m.year(year));
  if (d.precision === 'day') return date;
  const pad = (n) => String(n).padStart(2, '0');
  let time = `${pad(hour)}:${pad(minute)}`;
  if (d.precision !== 'minute') time += `:${pad(second)}`;
  if (d.precision === 'ms') time += `${decimalMark(m)}${String(ms).padStart(3, '0')}`;
  return m.dateTime(date, time);
}

function decimalMark(m) {
  return m.number.formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
}

const UNITS = ['year', 'month', 'day', 'hour', 'minute', 'second'];
// The smallest unit a duration shows for each precision.
const SMALLEST = { day: 'day', minute: 'minute', second: 'second', ms: 'second' };

/**
 * How long a range of two parseTime() results lasted, e.g. "2 hours,
 * 5 minutes", at the coarser precision of the two and in at most two
 * adjacent units. Years, months and days are counted on the calendar in the
 * zone, so "1 month" is a calendar month and "1 day" may be 23 or 25 hours
 * across a DST change. Hours and smaller are the time that actually passed,
 * so 01:00 to 04:00 on the night clocks go forward is 2 hours.
 * Returns "" if end is before start.
 */
export function timeDurationText(start, end, m, zone = local) {
  if (end.value < start.value) return '';
  const unit = UNITS[Math.min(UNITS.indexOf(SMALLEST[start.precision]), UNITS.indexOf(SMALLEST[end.precision]))];
  const s = zone.fields(start.value);
  const e = zone.fields(end.value);

  // start moved on by whole months, then days. A start day past the end of
  // the target month counts from its last day: 31 Jan + 1 month is 28 Feb.
  const shifted = (months, days = 0) => {
    const index = s.month - 1 + months;
    const year = s.year + Math.floor(index / 12);
    const month = (index % 12) + 1;
    return zone.instant({ ...s, year, month, day: Math.min(s.day, daysInMonth(year, month)) + days });
  };
  // The calendar difference in months is at most one too many.
  let months = (e.year - s.year) * 12 + e.month - s.month;
  if (months > 0 && shifted(months) > end.value) months -= 1;
  // At most one DST change lies within a month, so one day more than the
  // elapsed whole days is an upper bound.
  let days = Math.floor((end.value - shifted(months)) / DAY) + 1;
  while (days > 0 && shifted(months, days) > end.value) days -= 1;

  const rest = end.value - shifted(months, days);
  const parts = [
    ['year', Math.floor(months / 12)],
    ['month', months % 12],
    ['day', days],
    ['hour', Math.floor(rest / HOUR)],
    ['minute', Math.floor(rest / MINUTE) % 60],
    ['second', Math.floor(rest / 1000) % 60],
  ];
  return durationWords(parts.slice(0, UNITS.indexOf(unit) + 1), m);
}

// Tick steps, smallest first, as [unit, count]. Day steps count days of the
// month (1, 6, 11, … for 5 days) so they restart on the 1st of each month.
const TICK_STEPS = [
  ...[1, 5, 15, 30].map((n) => ['second', n]),
  ...[1, 5, 15, 30].map((n) => ['minute', n]),
  ...[1, 3, 6, 12].map((n) => ['hour', n]),
  ...[1, 2, 5, 10].map((n) => ['day', n]),
  ...[1, 3, 6].map((n) => ['month', n]),
  ...[1, 10, 100, 1000].flatMap((p) => [p, 2 * p, 5 * p]).map((n) => ['year', n]),
];
// Approximate unit lengths, only for choosing a step.
const UNIT_MS = { second: 1000, minute: MINUTE, hour: HOUR, day: DAY, month: 30.44 * DAY, year: 365.25 * DAY };

/**
 * Axis ticks for the view [start, end] (epoch ms) at pxPerUnit (px per ms),
 * using the smallest step that keeps labels at least minGap px apart, in the
 * zone (local time by default).
 * Day and longer steps fall on midnights in the zone, so a DST day is 23 or 25
 * hours wide. Shorter steps fall on round wall-clock times in the zone (on the
 * hour in zones with :30 offsets too) but are spaced by elapsed time, so an
 * hour step shows 01:00 twice on the night clocks go back.
 */
export function timeTicks(start, end, pxPerUnit, minGap, m, zone = local) {
  const [unit, n] = TICK_STEPS.find(([u, k]) => k * UNIT_MS[u] * pxPerUnit >= minGap) ?? TICK_STEPS.at(-1);
  const values = UNITS.indexOf(unit) <= UNITS.indexOf('day') ? calendarTicks(start, end, unit, n, zone) : wallClockTicks(start, end, unit, n, zone);
  return values.map((value) => ({ value, label: tickLabel(zone.fields(value), unit, m) }));
}

function calendarTicks(start, end, unit, n, zone) {
  const f = zone.fields(start);
  const ticks = [];
  for (let i = 0; ; i++) {
    const at = {
      year: { year: f.year + i },
      month: { year: f.year, month: f.month + i },
      day: { year: f.year, month: f.month, day: f.day + i },
    }[unit];
    const value = zone.instant(at);
    if (value > end) return ticks;
    if (value >= start && onStep(zone.fields(value), unit, n)) ticks.push(value);
  }
}

function onStep({ year, month, day }, unit, n) {
  if (unit === 'year') return year % n === 0;
  if (unit === 'month') return (month - 1) % n === 0;
  // A day tick needs a whole step before the next month starts, so the last
  // one in a month isn't crowded against the 1st (no 31st after the 26th).
  return day === 1 || ((day - 1) % n === 0 && day + n <= daysInMonth(year, month) + 1);
}

function wallClockTicks(start, end, unit, n, zone) {
  const size = n * UNIT_MS[unit];
  // The wall-clock time f rounded down to the step.
  const floor = (f) => {
    const g = { ...f, ms: 0, [unit]: Math.floor(f[unit] / n) * n };
    if (unit !== 'second') g.second = 0;
    if (unit === 'hour') g.minute = 0;
    return g;
  };
  const isRound = (f) => {
    const g = floor(f);
    return g[unit] === f[unit] && g.minute === f.minute && g.second === f.second && g.ms === f.ms;
  };
  // Step by elapsed time while that stays on round times; after an offset
  // change that breaks it (e.g. 3-hour steps across DST), go to the next
  // round time instead.
  const next = (t) => {
    const after = t + size;
    const f = zone.fields(after);
    if (isRound(f)) return after;
    const g = floor(f);
    const down = zone.instant(g);
    if (down > t) return down;
    const up = zone.instant({ ...g, [unit]: g[unit] + n });
    return up > t ? up : after;
  };
  let t = zone.instant(floor(zone.fields(start)));
  while (t < start) t = next(t);
  const ticks = [];
  for (; t <= end; t = next(t)) ticks.push(t);
  return ticks;
}

// The larger unit at its boundaries: the year on 1 January, the day and
// month at midnight, otherwise the time (with seconds for second steps).
function tickLabel(f, unit, m) {
  const pad = (k) => String(k).padStart(2, '0');
  const midnight = f.hour === 0 && f.minute === 0 && f.second === 0 && f.ms === 0;
  if (midnight || unit === 'day' || unit === 'month' || unit === 'year') {
    if (unit === 'year' || (f.month === 1 && f.day === 1)) return m.year(f.year);
    if (unit === 'month') return m.months[f.month - 1];
    return m.dayMonth(f.day, m.months[f.month - 1]);
  }
  const time = `${pad(f.hour)}:${pad(f.minute)}`;
  return unit === 'second' && f.second !== 0 ? `${time}:${pad(f.second)}` : time;
}

/**
 * The clock scale in a zone (see ../zone.js): offset-free strings are read,
 * and times, ticks and the axis label shown, in that zone. Values stay epoch
 * ms, so a timeline switches zones by swapping its scale for another zone's
 * without moving any event.
 */
export function clockScale(zone = local) {
  return {
    zone,
    parse: (input) => parseTime(input, zone),

    // Where a range ending on this time stops: a timed end is the instant
    // itself; a date-only end covers that whole day in the zone, like an
    // all-day event.
    rangeEnd(d) {
      if (d.precision !== 'day') return d.value;
      const { year, month, day } = zone.fields(d.value);
      return zone.instant({ year, month, day: day + 1 });
    },

    ticks: (start, end, pxPerUnit, minGap, m) => timeTicks(start, end, pxPerUnit, minGap, m, zone),

    // The zone's offset for the axis, e.g. "GMT+8", or "GMT-5 – GMT-4" for a
    // view across a DST change.
    zoneLabel(start, end) {
      const [a, b] = [zone.offsetLabel(start), zone.offsetLabel(end)];
      return a === b ? a : `${a} – ${b}`;
    },
    formatDate: (d, m) => timeText(d, m, zone),
    formatDuration: (start, end, m) => timeDurationText(start, end, m, zone),

    minSpan: 1000, // a second
    maxSpan: (dataSpan) => Math.max(dataSpan * 3, DAY),
    // fit() with no events shows today in the zone.
    get emptyView() {
      const { year, month, day } = zone.fields(Date.now());
      return [zone.instant({ year, month, day }), zone.instant({ year, month, day: day + 1 })];
    },
    minFitSpan: HOUR, // fit() never shows less than an hour
  };
}

/** The clock scale in local time. */
export default clockScale(local);

// The historical scale: dates are converted to fractional years ("values"),
// e.g. 1453-05-29 → ~1453.41. Negative years are BCE. Year zero is not
// skipped, so positions across the BCE/CE boundary are off by one year, which
// is invisible at historical scales.
//
// A scale is everything that depends on what the values mean: parsing,
// ticks, and how dates and durations are written. Functions that write text
// take the UI messages `m` (see messagesFor in chroniko.js).

import LOCALES from '../locales/index.js';

const UNIT = { year: 1, month: 1 / 12, day: 1 / 372 };
const TICK_STEPS = [1 / 12, 1 / 4, ...[1, 10, 100, 1000, 10000, 100000].flatMap((p) => [p, 2 * p, 5 * p])];

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

export function dateText(d, m) {
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
export function durationText(start, end, m) {
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

function tickLabel(value, step, m) {
  if (step >= 1) return m.year(Math.round(value));
  const year = Math.floor(value + 1e-9);
  const month = Math.round((value - year) * 12) % 12;
  return month === 0 ? m.year(year) : m.months[month];
}

export default {
  parse: parseDate,

  // Where a range ending on this date stops: the end of its last year, month or day.
  rangeEnd: (d) => d.value + UNIT[d.precision],

  // Axis ticks for the view [start, end] at pxPerUnit, using the smallest step
  // that keeps labels at least minGap px apart.
  ticks(start, end, pxPerUnit, minGap, m) {
    const step = TICK_STEPS.find((s) => s * pxPerUnit >= minGap) ?? TICK_STEPS.at(-1);
    const ticks = [];
    for (let i = Math.ceil(start / step); i * step <= end; i++) {
      const value = i * step;
      ticks.push({ value, label: tickLabel(value, step, m) });
    }
    return ticks;
  },

  formatDate: dateText,
  formatDuration: durationText,

  minSpan: 1 / 12, // a month
  maxSpan: (dataSpan) => Math.max(dataSpan * 3, 100),
  emptyView: [0, 2000], // shown by fit() when there are no events
  minFitSpan: 1, // fit() never shows less than a year
};

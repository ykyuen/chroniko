// The historical scale: dates as fractional years, from millennia down to days.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, formatDate, formatDuration, formatYear } from '../src/chroniko.js';
import historical from '../src/scales/historical.js';
import LOCALES from '../src/locales/index.js';

const en = { ...LOCALES.en };

test('parseDate reads years, months and days', () => {
  assert.deepEqual(parseDate('1453'), { year: 1453, month: null, day: null, precision: 'year', value: 1453 });
  assert.deepEqual(parseDate('1453-05'), { year: 1453, month: 5, day: null, precision: 'month', value: 1453 + 4 / 12 });
  assert.deepEqual(parseDate('1453-05-29'), { year: 1453, month: 5, day: 29, precision: 'day', value: 1453 + 4 / 12 + 28 / 372 });
  assert.deepEqual(parseDate('1453-5-9'), parseDate({ year: 1453, month: 5, day: 9 }));
  assert.equal(parseDate(' 1600 ').value, 1600);
});

test('parseDate reads negative years as BCE', () => {
  const d = parseDate('-44-03-15');
  assert.equal(d.year, -44);
  assert.equal(d.value, -44 + 2 / 12 + 14 / 372);
});

test('parseDate keeps fractional years from getState()', () => {
  assert.deepEqual(parseDate(1453.41), { year: 1453.41, month: null, day: null, precision: 'year', value: 1453.41 });
});

test('parseDate returns null for a missing date', () => {
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(undefined), null);
  assert.equal(parseDate(''), null);
});

test('parseDate accepts 29 February in any year', () => {
  assert.equal(parseDate('1453-02-29').day, 29);
});

test('parseDate throws on dates that are invalid or do not exist', () => {
  assert.throws(() => parseDate(Infinity), { message: 'Chroniko: invalid date Infinity' });
  assert.throws(() => parseDate(NaN), { message: 'Chroniko: invalid date NaN' });
  assert.throws(() => parseDate('May 1453'), { message: 'Chroniko: cannot parse date "May 1453"' });
  assert.throws(() => parseDate('1453-13'), { message: 'Chroniko: invalid date "1453-13": month must be 1–12' });
  assert.throws(() => parseDate('1453-04-31'), { message: 'Chroniko: invalid date "1453-04-31": day must be 1–30 in Apr' });
  assert.throws(() => parseDate({ year: 1453, day: 3 }), { message: /a day needs a month/ });
  assert.throws(() => parseDate({ year: 1.5 }), { message: /year must be a whole number/ });
});

test('formatDate and formatYear use the language', () => {
  assert.equal(formatDate(parseDate('1453-05-29')), '29 May 1453');
  assert.equal(formatDate(parseDate('1644-03')), 'Mar 1644');
  assert.equal(formatDate(parseDate('-221')), '221 BCE');
  assert.equal(formatDate(parseDate('1453-05-29'), 'zh-Hant'), '1453年5月29日');
  assert.equal(formatYear(-221), '221 BCE');
  assert.equal(formatYear(2000, 'ja'), '2000年');
});

test('formatDuration uses the coarser precision and at most two adjacent units', () => {
  const d = (a, b, language) => formatDuration(parseDate(a), parseDate(b), language);
  assert.equal(d('1337', '1453'), '116 years');
  assert.equal(d('1939-09', '1942-08'), '2 years, 11 months');
  assert.equal(d('1939-09-01', '1945-09-02'), '6 years'); // months are 0, so days aren't shown
  assert.equal(d('1939-09-01', '1945'), '6 years');
  assert.equal(d('2001-01-31', '2001-03-01'), '1 month, 1 day');
  assert.equal(d('1939-09-01', '1945-09-02', 'zh-Hant'), '6年');
  assert.equal(d('2000-01-01', '2001-01-01', 'pl'), '1 rok');
  assert.equal(d('2000', '2005', 'pl'), '5 lat');
});

test('formatDuration has no year zero', () => {
  assert.equal(formatDuration(parseDate('-27'), parseDate('14')), '40 years');
});

test('formatDuration of less than one unit, or a negative range', () => {
  const d = (a, b) => formatDuration(parseDate(a), parseDate(b));
  assert.equal(d('1453', '1453'), 'less than a year');
  assert.equal(d('1453-05', '1453-05'), 'less than a month');
  assert.equal(d('1453-05-29', '1453-05-29'), 'less than a day');
  assert.equal(d('1500', '1400'), '');
});

test('rangeEnd covers the whole of the last year, month or day', () => {
  assert.equal(historical.rangeEnd(parseDate('1945')), 1946);
  assert.equal(historical.rangeEnd(parseDate('1945-09')), 1945 + 8 / 12 + 1 / 12);
  assert.equal(historical.rangeEnd(parseDate('1945-09-02')), parseDate('1945-09-02').value + 1 / 372);
});

// Ticks for a view of [start, end] years drawn across width px.
const ticks = (start, end, width) => historical.ticks(start, end, width / (end - start), 90, en);

test('ticks pick the smallest step at least 90 px apart', () => {
  assert.deepEqual(
    ticks(1900, 2000, 1000).map((t) => t.label),
    ['1900', '1910', '1920', '1930', '1940', '1950', '1960', '1970', '1980', '1990', '2000'],
  );
});

test('ticks label quarters with month names and the year at January', () => {
  assert.deepEqual(
    ticks(2000, 2001, 1000).map((t) => [t.value, t.label]),
    [[2000, '2000'], [2000.25, 'Apr'], [2000.5, 'Jul'], [2000.75, 'Oct'], [2001, '2001']],
  );
});

test('ticks label BCE years', () => {
  assert.deepEqual(ticks(-500, 0, 500).map((t) => t.label), ['500 BCE', '400 BCE', '300 BCE', '200 BCE', '100 BCE', '0']);
});

test('ticks start at the first step inside the view', () => {
  const t = ticks(1903, 1997, 940);
  assert.equal(t[0].value, 1910);
  assert.equal(t.at(-1).value, 1990);
});

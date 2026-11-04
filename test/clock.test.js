// The clock scale: parsing, range ends and formatting. Strings without an
// offset are local time, so those tests run in several zones (see zone.test.js).

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseTime, formatDate, formatDuration } from '../src/chroniko.js';
import clock from '../src/scales/clock.js';

const HOUR = 3_600_000;
const utc = (s) => Date.parse(s);
const clockTime = (value, precision) => ({ scale: 'clock', value, precision });

const originalTZ = process.env.TZ;
const inZone = (zone) =>
  before(() => {
    process.env.TZ = zone;
  });
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe('exact inputs', () => {
  inZone('America/New_York');

  test('epoch ms and Dates are exact to the ms', () => {
    assert.deepEqual(parseTime(1793154600000), clockTime(1793154600000, 'ms'));
    assert.deepEqual(parseTime(new Date(1793154600000)), clockTime(1793154600000, 'ms'));
    assert.deepEqual(parseTime(0), clockTime(0, 'ms'));
  });

  test('strings with Z or an offset are exact, with the precision they are given in', () => {
    assert.deepEqual(parseTime('2026-10-28T10:30Z'), clockTime(utc('2026-10-28T10:30Z'), 'minute'));
    assert.deepEqual(parseTime('2026-10-28T10:30:15z'), clockTime(utc('2026-10-28T10:30:15Z'), 'second'));
    assert.deepEqual(parseTime('2026-10-28T10:30:15.25Z'), clockTime(utc('2026-10-28T10:30:15.250Z'), 'ms'));
    assert.deepEqual(parseTime('2026-10-28T10:30:15.123456Z'), clockTime(utc('2026-10-28T10:30:15.123Z'), 'ms'));
    assert.equal(parseTime('2026-10-28T10:30+08:00').value, utc('2026-10-28T02:30Z'));
    assert.equal(parseTime('2026-10-28 10:30-0330').value, utc('2026-10-28T14:00Z'));
    assert.equal(parseTime(' 2026-10-28T10:30Z ').value, utc('2026-10-28T10:30Z'));
  });

  test('years before 100 are not read as 1900–1999', () => {
    assert.equal(new Date(parseTime('0050-06-15T00:00Z').value).getUTCFullYear(), 50);
  });

  test('missing inputs are null', () => {
    assert.equal(parseTime(null), null);
    assert.equal(parseTime(undefined), null);
    assert.equal(parseTime(''), null);
  });

  test('invalid inputs and times that do not exist throw', () => {
    assert.throws(() => parseTime(NaN), { message: 'Chroniko: invalid time NaN' });
    assert.throws(() => parseTime(new Date('nope')), { message: 'Chroniko: invalid time Invalid Date' });
    assert.throws(() => parseTime('28 Oct 2026'), { message: 'Chroniko: cannot parse time "28 Oct 2026"' });
    assert.throws(() => parseTime('2026-10-28Z'), { message: /cannot parse time/ }); // an offset needs a time
    assert.throws(() => parseTime('2026-10'), { message: /cannot parse time/ });
    assert.throws(() => parseTime({ year: 2026 }), { message: 'Chroniko: cannot parse time {"year":2026}' });
    assert.throws(() => parseTime('2026-13-01'), { message: 'Chroniko: invalid time "2026-13-01": month must be 1–12' });
    assert.throws(() => parseTime('2026-02-29'), { message: 'Chroniko: invalid time "2026-02-29": day must be 1–28 in Feb' });
    assert.throws(() => parseTime('2026-10-28T24:00'), { message: /hour must be 0–23/ });
    assert.throws(() => parseTime('2026-10-28T10:60'), { message: /minute must be 0–59/ });
    assert.throws(() => parseTime('2026-10-28T10:30:60'), { message: /second must be 0–59/ });
  });

  test('29 February exists only in leap years', () => {
    assert.equal(parseTime('2028-02-29').precision, 'day');
    assert.equal(parseTime('2000-02-29').precision, 'day');
    assert.throws(() => parseTime('1900-02-29'), { message: /day must be 1–28/ });
  });

  test('a timed range end is the instant itself', () => {
    const end = parseTime('2026-10-28T10:30Z');
    assert.equal(clock.rangeEnd(end), end.value);
  });
});

const ZONES = {
  'America/New_York': '2026-10-28T04:00Z',
  'Asia/Kolkata': '2026-10-27T18:30Z',
  'Asia/Hong_Kong': '2026-10-27T16:00Z',
};

for (const [zone, midnight] of Object.entries(ZONES)) {
  describe(`local time in ${zone}`, () => {
    inZone(zone);

    test('a date-only string is local midnight, not UTC', () => {
      assert.deepEqual(parseTime('2026-10-28'), clockTime(utc(midnight), 'day'));
    });

    test('a time without an offset is local', () => {
      assert.equal(parseTime('2026-10-28T10:30').value, utc(midnight) + 10.5 * HOUR);
    });

    test('a date-only range end covers the whole day', () => {
      assert.equal(clock.rangeEnd(parseTime('2026-10-28')), parseTime('2026-10-29').value);
    });

    test('formatDate writes local time at the given precision', () => {
      assert.equal(formatDate(parseTime('2026-10-28')), '28 Oct 2026');
      assert.equal(formatDate(parseTime('2026-10-28T09:05')), '28 Oct 2026, 09:05');
      assert.equal(formatDate(parseTime('2026-10-28T23:05:07')), '28 Oct 2026, 23:05:07');
      assert.equal(formatDate(parseTime('2026-10-28T23:05:07.5')), '28 Oct 2026, 23:05:07.500');
    });
  });
}

describe('DST in America/New_York', () => {
  inZone('America/New_York');

  test('a date-only range end on a DST day covers 23 or 25 hours', () => {
    const length = (s) => (clock.rangeEnd(parseTime(s)) - parseTime(s).value) / HOUR;
    assert.equal(length('2026-03-08'), 23);
    assert.equal(length('2026-11-01'), 25);
  });

  test('a local time skipped by DST moves forward', () => {
    assert.equal(parseTime('2026-03-08T02:30').value, utc('2026-03-08T07:30Z'));
  });
});

describe('formatDate in other languages', () => {
  inZone('Asia/Hong_Kong');

  test('uses the locale for the date and Intl for the time', () => {
    assert.equal(formatDate(parseTime('2026-10-28T09:05'), 'zh-Hant'), '2026年10月28日 09:05');
    assert.equal(formatDate(parseTime('2026-10-28T09:05'), 'fr'), formatDate(parseTime('2026-10-28'), 'fr') + ' à 09:05');
    assert.equal(formatDate(parseTime('2026-10-28T09:05:07.5'), 'de'), formatDate(parseTime('2026-10-28'), 'de') + ', 09:05:07,500');
  });

  test('historical dates are unchanged', () => {
    assert.equal(formatDate({ year: 1453, month: 5, day: 29, precision: 'day', value: 1453.4 }), '29 May 1453');
  });
});

const duration = (a, b, language) => formatDuration(parseTime(a), parseTime(b), language);

describe('formatDuration', () => {
  inZone('Asia/Hong_Kong');

  test('uses the coarser precision and at most two adjacent units', () => {
    assert.equal(duration('2026-10-28T10:00', '2026-10-28T12:05'), '2 hours, 5 minutes');
    assert.equal(duration('2026-10-28T10:00:00', '2026-10-28T10:04:12'), '4 minutes, 12 seconds');
    assert.equal(duration('2026-10-28T10:00:00', '2026-10-28T10:04'), '4 minutes');
    assert.equal(duration('2026-10-28T10:00', '2026-10-29T13:00'), '1 day, 3 hours');
    assert.equal(duration('2026-10-28T10:00', '2026-10-29T10:30'), '1 day'); // hours are 0, so minutes aren't shown
    assert.equal(duration('2026-10-28', '2026-10-29T10:30'), '1 day');
    assert.equal(duration('2025-08-28', '2026-10-30'), '1 year, 2 months');
    assert.equal(duration(1793154600000, 1793154600000 + 2_500), '2 seconds');
  });

  test('counts calendar months, from the last day of a shorter month', () => {
    assert.equal(duration('2026-01-31', '2026-02-28'), '1 month');
    assert.equal(duration('2026-01-31', '2026-03-01'), '1 month, 1 day');
    assert.equal(duration('2026-01-31T10:00', '2026-02-28T09:00'), '27 days, 23 hours');
    assert.equal(duration('2025-12-15', '2026-01-14'), '30 days');
  });

  test('less than one unit, or a negative range', () => {
    assert.equal(duration('2026-10-28', '2026-10-28'), 'less than a day');
    assert.equal(duration('2026-10-28T10:00', '2026-10-28T10:00'), 'less than a minute');
    assert.equal(duration(0, 999), 'less than a second');
    assert.equal(duration('2026-10-28T10:00', '2026-10-28T09:00'), '');
  });

  test('uses the language', () => {
    assert.equal(duration('2026-10-28T10:00', '2026-10-28T12:05', 'zh-Hant'), '2小時5分鐘');
    assert.equal(duration('2026-10-28T10:00', '2026-10-28T15:00', 'pl'), '5 godzin');
    assert.equal(duration('2026-10-28T10:00', '2026-10-28T11:00', 'fr'), '1 heure');
  });

  test('throws on a historical date and a clock time together', () => {
    assert.throws(() => formatDuration(parseDate('1453'), parseTime('2026-10-28')), { message: /two parseDate\(\) results or two parseTime\(\) results/ });
  });
});

describe('formatDuration across DST in America/New_York', () => {
  inZone('America/New_York');

  test('hours are the time that passed', () => {
    assert.equal(duration('2026-03-08T01:00', '2026-03-08T04:00'), '2 hours');
    assert.equal(duration('2026-11-01T00:00', '2026-11-01T03:00'), '4 hours');
  });

  test('days follow the calendar', () => {
    assert.equal(duration('2026-03-07T12:00', '2026-03-08T12:00'), '1 day');
    assert.equal(duration('2026-03-08', '2026-03-09'), '1 day');
    assert.equal(duration('2026-02-15T12:00', '2026-03-15T11:00'), '27 days, 23 hours');
  });
});

describe('zoneLabel', () => {
  inZone('America/New_York');

  test('names the offset, or both offsets across a DST change', () => {
    assert.equal(clock.zoneLabel(parseTime('2026-01-10').value, parseTime('2026-01-11').value), 'GMT-5');
    assert.equal(clock.zoneLabel(parseTime('2026-03-07').value, parseTime('2026-03-09').value), 'GMT-5 – GMT-4');
  });
});

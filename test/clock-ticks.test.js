// Axis ticks on the clock scale, in several time zones (see zone.test.js).

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime } from '../src/chroniko.js';
import { timeTicks } from '../src/scales/clock.js';
import LOCALES from '../src/locales/index.js';

const HOUR = 3_600_000;
const en = { ...LOCALES.en };

// Ticks for a view from a to b (parseTime inputs) drawn across width px.
const ticks = (a, b, width, m = en) => {
  const start = parseTime(a).value;
  const end = parseTime(b).value;
  return timeTicks(start, end, width / (end - start), 90, m);
};
const labels = (...args) => ticks(...args).map((t) => t.label);
const gaps = (t) => t.slice(1).map((x, i) => (x.value - t[i].value) / HOUR);

const originalTZ = process.env.TZ;
const inZone = (zone) =>
  before(() => {
    process.env.TZ = zone;
  });
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

for (const zone of ['America/New_York', 'Asia/Kolkata', 'Asia/Hong_Kong']) {
  describe(`ticks in ${zone}`, () => {
    inZone(zone);

    test('pick the smallest step at least 90 px apart', () => {
      assert.deepEqual(labels('2026-10-28', '2026-10-29', 1000), ['28 Oct', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '29 Oct']);
      assert.deepEqual(labels('2026-10-28T10:00', '2026-10-28T10:10', 1000), ['10:00', '10:01', '10:02', '10:03', '10:04', '10:05', '10:06', '10:07', '10:08', '10:09', '10:10']);
      assert.deepEqual(labels('2026-01-01', '2027-01-01', 1000), ['2026', 'Apr', 'Jul', 'Oct', '2027']);
      assert.deepEqual(labels('2000-01-01', '2100-01-01', 1000), ['2000', '2010', '2020', '2030', '2040', '2050', '2060', '2070', '2080', '2090', '2100']);
    });

    test('fall on round local times, also in zones with :30 offsets', () => {
      const hourly = ticks('2026-10-28T07:10', '2026-10-28T13:50', 1000);
      assert.deepEqual(hourly.map((t) => t.label), ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']);
      for (const { value } of hourly) assert.equal(new Date(value).getMinutes(), 0);
      assert.deepEqual(labels('2026-10-28T10:00:00', '2026-10-28T10:01:00', 1000), ['10:00', '10:00:15', '10:00:30', '10:00:45', '10:01']);
    });

    test('start at the first step inside the view', () => {
      assert.deepEqual(labels('2026-10-28T10:07', '2026-10-28T16:59', 1000), ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
    });

    test('day steps restart on the 1st of each month', () => {
      assert.deepEqual(labels('2026-10-01', '2026-11-01', 1000), ['1 Oct', '6 Oct', '11 Oct', '16 Oct', '21 Oct', '26 Oct', '1 Nov']);
      assert.deepEqual(labels('2026-10-01', '2026-11-01', 400), ['1 Oct', '11 Oct', '21 Oct', '1 Nov']);
      assert.deepEqual(labels('2026-02-01', '2026-03-01', 1000), ['1 Feb', '6 Feb', '11 Feb', '16 Feb', '21 Feb', '1 Mar']);
    });

    test('show the larger unit where it changes', () => {
      assert.deepEqual(labels('2026-12-31T20:00', '2027-01-01T04:00', 1000), ['20:00', '21:00', '22:00', '23:00', '2027', '01:00', '02:00', '03:00', '04:00']);
      assert.deepEqual(labels('2026-12-29', '2027-01-03', 1000), ['29 Dec', '12:00', '30 Dec', '12:00', '31 Dec', '12:00', '2027', '12:00', '2 Jan', '12:00', '3 Jan']);
    });

    test('use the language', () => {
      const m = { ...LOCALES.en, ...LOCALES['zh-Hant'] };
      assert.deepEqual(labels('2026-12-30', '2027-01-02', 400, m), ['12月30日', '12月31日', '2027年', '1月2日']);
    });
  });
}

describe('ticks across DST in America/New_York', () => {
  inZone('America/New_York');

  test('hour steps are spaced by elapsed time', () => {
    const forward = ticks('2026-03-08', '2026-03-08T06:00', 600);
    assert.deepEqual(forward.map((t) => t.label), ['8 Mar', '01:00', '03:00', '04:00', '05:00', '06:00']);
    assert.deepEqual(gaps(forward), [1, 1, 1, 1, 1]);
    const back = ticks('2026-11-01', '2026-11-01T06:00', 700); // 7 hours pass
    assert.deepEqual(back.map((t) => t.label), ['1 Nov', '01:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00']);
    assert.deepEqual(gaps(back), [1, 1, 1, 1, 1, 1, 1]);
  });

  test('longer steps stay on round local times', () => {
    const forward = ticks('2026-03-08', '2026-03-09', 1000);
    assert.deepEqual(forward.map((t) => t.label), ['8 Mar', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '9 Mar']);
    assert.deepEqual(gaps(forward), [2, 3, 3, 3, 3, 3, 3, 3]);
    const back = ticks('2026-11-01', '2026-11-02', 1000);
    assert.deepEqual(back.map((t) => t.label), ['1 Nov', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '2 Nov']);
    assert.deepEqual(gaps(back), [4, 3, 3, 3, 3, 3, 3, 3]);
  });

  test('day steps fall on local midnight, so DST days are 23 or 25 hours wide', () => {
    assert.deepEqual(gaps(ticks('2026-03-01', '2026-03-15', 1400)), [24, 24, 24, 24, 24, 24, 24, 23, 24, 24, 24, 24, 24, 24]);
    assert.deepEqual(gaps(ticks('2026-10-25', '2026-11-08', 1400)), [24, 24, 24, 24, 24, 24, 24, 25, 24, 24, 24, 24, 24, 24]);
  });
});

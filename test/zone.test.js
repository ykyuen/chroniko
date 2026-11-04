// The local zone helper, run in several time zones. Node picks up changes to
// process.env.TZ at runtime, so one test run covers them all. New York has
// DST, Kolkata a +05:30 offset, and Hong Kong (where development happens)
// neither, so DST bugs would never show up there alone.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { local } from '../src/zone.js';

const HOUR = 3_600_000;
const utc = (s) => Date.parse(s);

const ZONES = {
  'America/New_York': {
    wall: { year: 2026, month: 3, day: 8, hour: 3, minute: 30, second: 0, ms: 0 }, // EDT, just after the change
    labels: ['GMT-5', 'GMT-4'], // January, July
    dayLengths: [23, 25], // 8 March and 1 November 2026
  },
  'Asia/Kolkata': {
    wall: { year: 2026, month: 3, day: 8, hour: 13, minute: 0, second: 0, ms: 0 },
    labels: ['GMT+5:30', 'GMT+5:30'],
    dayLengths: [24, 24],
  },
  'Asia/Hong_Kong': {
    wall: { year: 2026, month: 3, day: 8, hour: 15, minute: 30, second: 0, ms: 0 },
    labels: ['GMT+8', 'GMT+8'],
    dayLengths: [24, 24],
  },
};

const originalTZ = process.env.TZ;
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

for (const [zone, expected] of Object.entries(ZONES)) {
  describe(zone, () => {
    before(() => {
      process.env.TZ = zone;
    });

    test('fields and instant convert both ways', () => {
      const t = utc('2026-03-08T07:30:00Z');
      assert.deepEqual(local.fields(t), expected.wall);
      assert.equal(local.instant(expected.wall), t);
    });

    test('instant defaults missing fields to the start of the period', () => {
      assert.deepEqual(local.fields(local.instant({ year: 2026 })), { year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0, ms: 0 });
      assert.equal(local.instant({ year: 2026, month: 7 }), local.instant({ year: 2026, month: 7, day: 1, hour: 0 }));
    });

    test('a day step follows the calendar across DST changes', () => {
      const length = (month, day) =>
        (local.instant({ year: 2026, month, day: day + 1 }) - local.instant({ year: 2026, month, day })) / HOUR;
      assert.deepEqual([length(3, 8), length(11, 1)], expected.dayLengths);
    });

    test('out-of-range fields roll over', () => {
      assert.equal(local.instant({ year: 2026, month: 12, day: 32 }), local.instant({ year: 2027, month: 1, day: 1 }));
      assert.equal(local.instant({ year: 2026, month: 13 }), local.instant({ year: 2027 }));
      assert.equal(local.instant({ year: 2026, month: 3, day: 1, hour: -1 }), local.instant({ year: 2026, month: 2, day: 28, hour: 23 }));
    });

    test('years 0–99 are not read as 1900–1999', () => {
      assert.equal(local.fields(local.instant({ year: 50, month: 6, day: 15 })).year, 50);
    });

    test('offsetLabel names the offset at that instant', () => {
      assert.deepEqual([local.offsetLabel(utc('2026-01-15T12:00:00Z')), local.offsetLabel(utc('2026-07-15T12:00:00Z'))], expected.labels);
    });
  });
}

describe('America/New_York DST changes', () => {
  before(() => {
    process.env.TZ = 'America/New_York';
  });

  test('a time that does not exist moves forward', () => {
    // 02:30 on 8 March 2026 is skipped; it becomes 03:30 EDT.
    assert.equal(local.instant({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }), utc('2026-03-08T07:30:00Z'));
  });

  test('a time that occurs twice uses the earlier instant', () => {
    // 01:30 on 1 November 2026 happens in EDT and again in EST; EDT comes first.
    assert.equal(local.instant({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }), utc('2026-11-01T05:30:00Z'));
  });
});

describe('UTC', () => {
  before(() => {
    process.env.TZ = 'UTC';
  });

  test('offsetLabel is plain GMT', () => {
    assert.equal(local.offsetLabel(utc('2026-07-15T12:00:00Z')), 'GMT');
  });
});

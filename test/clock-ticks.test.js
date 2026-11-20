// Axis ticks on the clock scale, in several time zones (see zone.test.js).
// Each zone runs twice: as the local zone, on a machine set to it, and as an
// IANA zone on a machine in Pacific/Chatham (+12:45, +13:45 in summer), whose
// odd offset would show up in any tick that read the machine's zone.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, timeTicks } from '../src/scales/clock.js';
import { local, utc, zoneNamed } from '../src/zone.js';
import LOCALES from '../src/locales/index.js';

const HOUR = 3_600_000;
const en = { ...LOCALES.en };
const ELSEWHERE = 'Pacific/Chatham';

// Ticks in a zone for a view from a to b (parseTime inputs, read in that
// zone) drawn across width px.
const ticksIn = (zone) => (a, b, width, m = en) => {
  const start = parseTime(a, zone).value;
  const end = parseTime(b, zone).value;
  return timeTicks(start, end, width / (end - start), 90, m, zone);
};
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

// describe() for a zone both ways: body(zone) gets the zone object to use.
const bothWays = (name, title, body) => {
  describe(`${title} in ${name}`, () => {
    inZone(name);
    body(local);
  });
  describe(`${title} in ${name}, as an IANA zone on a machine in ${ELSEWHERE}`, () => {
    inZone(ELSEWHERE);
    body(zoneNamed(name));
  });
};

for (const name of ['America/New_York', 'Asia/Kolkata', 'Asia/Hong_Kong']) {
  bothWays(name, 'ticks', (zone) => {
    const ticks = ticksIn(zone);
    const labels = (...args) => ticks(...args).map((t) => t.label);

    test('pick the smallest step at least 90 px apart', () => {
      assert.deepEqual(labels('2026-10-28', '2026-10-29', 1000), ['28 Oct', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '29 Oct']);
      assert.deepEqual(labels('2026-10-28T10:00', '2026-10-28T10:10', 1000), ['10:00', '10:01', '10:02', '10:03', '10:04', '10:05', '10:06', '10:07', '10:08', '10:09', '10:10']);
      assert.deepEqual(labels('2026-01-01', '2027-01-01', 1000), ['2026', 'Apr', 'Jul', 'Oct', '2027']);
      assert.deepEqual(labels('2000-01-01', '2100-01-01', 1000), ['2000', '2010', '2020', '2030', '2040', '2050', '2060', '2070', '2080', '2090', '2100']);
    });

    test('fall on round local times, also in zones with :30 offsets', () => {
      const hourly = ticks('2026-10-28T07:10', '2026-10-28T13:50', 1000);
      assert.deepEqual(hourly.map((t) => t.label), ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']);
      for (const { value } of hourly) assert.equal(zone.fields(value).minute, 0);
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

bothWays('America/New_York', 'ticks across DST', (zone) => {
  const ticks = ticksIn(zone);

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

// Southern Hemisphere: clocks go back in April and forward in October.
bothWays('Australia/Adelaide', 'ticks across DST', (zone) => {
  const ticks = ticksIn(zone);

  test('hour steps are spaced by elapsed time', () => {
    const back = ticks('2026-04-05', '2026-04-05T06:00', 700); // 7 hours pass
    assert.deepEqual(back.map((t) => t.label), ['5 Apr', '01:00', '02:00', '02:00', '03:00', '04:00', '05:00', '06:00']);
    assert.deepEqual(gaps(back), [1, 1, 1, 1, 1, 1, 1]);
    const forward = ticks('2026-10-04', '2026-10-04T06:00', 500);
    assert.deepEqual(forward.map((t) => t.label), ['4 Oct', '01:00', '03:00', '04:00', '05:00', '06:00']);
    assert.deepEqual(gaps(forward), [1, 1, 1, 1, 1]);
  });

  test('longer steps stay on round local times', () => {
    assert.deepEqual(gaps(ticks('2026-04-05', '2026-04-06', 1000)), [4, 3, 3, 3, 3, 3, 3, 3]);
    assert.deepEqual(gaps(ticks('2026-10-04', '2026-10-05', 1000)), [2, 3, 3, 3, 3, 3, 3, 3]);
  });

  test('day steps fall on local midnight, so DST days are 25 or 23 hours wide', () => {
    assert.deepEqual(gaps(ticks('2026-03-29', '2026-04-12', 1400)), [24, 24, 24, 24, 24, 24, 24, 25, 24, 24, 24, 24, 24, 24]);
    assert.deepEqual(gaps(ticks('2026-09-27', '2026-10-11', 1400)), [24, 24, 24, 24, 24, 24, 24, 23, 24, 24, 24, 24, 24, 24]);
  });
});

// Lord Howe Island moves its clocks by half an hour: back from 02:00 to 01:30
// on 5 April 2026, forward from 02:00 to 02:30 on 4 October.
bothWays('Australia/Lord_Howe', 'ticks across a half-hour DST change', (zone) => {
  const ticks = ticksIn(zone);

  test('hour steps stay on the hour', () => {
    const back = ticks('2026-04-05', '2026-04-05T06:00', 650);
    assert.deepEqual(back.map((t) => t.label), ['5 Apr', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00']);
    assert.deepEqual(gaps(back), [1, 1.5, 1, 1, 1, 1]);
    // 02:00 doesn't exist; it isn't replaced by an 02:30 tick.
    const forward = ticks('2026-10-04', '2026-10-04T06:00', 550);
    assert.deepEqual(forward.map((t) => t.label), ['4 Oct', '01:00', '03:00', '04:00', '05:00', '06:00']);
    assert.deepEqual(gaps(forward), [1, 1.5, 1, 1, 1]);
    assert.deepEqual(ticks('2026-10-04T02:30', '2026-10-04T06:30', 400).map((t) => t.label), ['03:00', '04:00', '05:00', '06:00']);
  });

  test('quarter-hour steps skip the half hour that does not exist', () => {
    const forward = ticks('2026-10-04T01:00', '2026-10-04T04:00', 1000);
    assert.deepEqual(forward.map((t) => t.label), ['01:00', '01:15', '01:30', '01:45', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00']);
    assert.deepEqual(gaps(forward), Array(10).fill(0.25));
  });

  test('longer steps stay on round local times', () => {
    assert.deepEqual(gaps(ticks('2026-04-05', '2026-04-06', 1000)), [3.5, 3, 3, 3, 3, 3, 3, 3]);
    assert.deepEqual(gaps(ticks('2026-10-04', '2026-10-05', 1000)), [2.5, 3, 3, 3, 3, 3, 3, 3]);
  });
});

// The done-when check for 0.8.0: in every test zone, an IANA zone gives the
// same ticks as the local zone on a machine set to that zone. Views of 1
// minute to 30 years, around each offset change in 2026 (found with Date)
// and at a few ordinary times.
describe('IANA ticks match local ticks in that zone', () => {
  const MINUTE = 60_000;
  const DAY = 24 * HOUR;
  const zones = ['America/New_York', 'Europe/London', 'Asia/Kolkata', 'Australia/Adelaide', 'Australia/Sydney', 'Australia/Lord_Howe', 'America/Santiago', 'Asia/Hong_Kong'];
  const spans = [MINUTE, 10 * MINUTE, HOUR, 6 * HOUR, DAY, 4 * DAY, 31 * DAY, 365 * DAY, 30 * 365 * DAY];
  const ordinary = ['2026-01-01T00:00:00Z', '2026-06-15T12:34:56Z', '2026-12-31T23:00:00Z'].map((s) => Date.parse(s));
  const localOffset = (t) => -new Date(t).getTimezoneOffset();

  // The first minute of each new offset in 2026, as in zone.test.js.
  const changes = () => {
    const found = [];
    for (let lo = Date.parse('2026-01-01T12:00:00Z'), day = 0; day < 365; day++, lo += DAY) {
      if (localOffset(lo) === localOffset(lo + DAY)) continue;
      let [a, b] = [lo, lo + DAY];
      while (b - a > MINUTE) {
        const mid = a + Math.floor((b - a) / 2 / MINUTE) * MINUTE;
        if (localOffset(mid) === localOffset(a)) a = mid;
        else b = mid;
      }
      found.push(b);
    }
    return found;
  };

  for (const name of zones) {
    test(name, () => {
      process.env.TZ = name;
      const zone = zoneNamed(name);
      const centres = [...changes(), ...ordinary];
      for (const centre of centres) {
        for (const span of spans) {
          const start = centre - Math.round(span / 3);
          const end = start + span;
          const pxPerMs = 1000 / span;
          assert.deepEqual(
            timeTicks(start, end, pxPerMs, 90, en, zone),
            timeTicks(start, end, pxPerMs, 90, en, local),
            `ticks from ${new Date(start).toISOString()} to ${new Date(end).toISOString()}`,
          );
        }
      }
    });
  }
});

// The same views in the UTC zone, on a machine in New York: New York's DST
// changes must not show up at all.
describe('ticks in the UTC zone, on a machine in America/New_York', () => {
  inZone('America/New_York');

  const utcTicks = (a, b, width) => {
    const [start, end] = [Date.parse(a), Date.parse(b)];
    return timeTicks(start, end, width / (end - start), 90, en, utc);
  };

  test('hour steps are evenly spaced on the nights New York changes clocks', () => {
    const forward = utcTicks('2026-03-08T05:00Z', '2026-03-08T11:00Z', 600);
    assert.deepEqual(forward.map((t) => t.label), ['05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00']);
    assert.deepEqual(gaps(forward), [1, 1, 1, 1, 1, 1]);
    const back = utcTicks('2026-11-01T04:00Z', '2026-11-01T10:00Z', 600);
    assert.deepEqual(back.map((t) => t.label), ['04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00']);
    assert.deepEqual(gaps(back), [1, 1, 1, 1, 1, 1]);
  });

  test('longer steps fall on round UTC times', () => {
    const day = utcTicks('2026-03-08T00:00Z', '2026-03-09T00:00Z', 1000);
    assert.deepEqual(day.map((t) => t.label), ['8 Mar', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '9 Mar']);
    assert.deepEqual(gaps(day), [3, 3, 3, 3, 3, 3, 3, 3]);
  });

  test('day steps fall on UTC midnight and are all 24 hours', () => {
    const days = utcTicks('2026-03-01T00:00Z', '2026-03-15T00:00Z', 1400);
    assert.equal(days[0].value, Date.parse('2026-03-01T00:00Z'));
    assert.deepEqual(gaps(days), Array(14).fill(24));
    assert.deepEqual(gaps(utcTicks('2026-10-25T00:00Z', '2026-11-08T00:00Z', 1400)), Array(14).fill(24));
  });
});

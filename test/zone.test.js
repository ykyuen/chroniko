// The local zone helper, run in several time zones. Node picks up changes to
// process.env.TZ at runtime, so one test run covers them all. New York has
// DST, Kolkata a +05:30 offset, and Hong Kong (where development happens)
// neither, so DST bugs would never show up there alone.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { local, utc as utcZone, zoneNamed } from '../src/zone.js';

const HOUR = 3_600_000;
const DAY_MS = 24 * HOUR;
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

// The UTC zone must give the same answers whatever the viewer's own zone is.
for (const zone of Object.keys(ZONES)) {
  describe(`the UTC zone, on a machine in ${zone}`, () => {
    before(() => {
      process.env.TZ = zone;
    });

    test('fields and instant convert both ways', () => {
      const wall = { year: 2026, month: 3, day: 8, hour: 7, minute: 30, second: 0, ms: 0 };
      assert.deepEqual(utcZone.fields(utc('2026-03-08T07:30:00Z')), wall);
      assert.equal(utcZone.instant(wall), utc('2026-03-08T07:30:00Z'));
    });

    test('instant defaults missing fields to the start of the period', () => {
      assert.equal(utcZone.instant({ year: 2026 }), utc('2026-01-01T00:00:00Z'));
      assert.equal(utcZone.instant({ year: 2026, month: 7 }), utc('2026-07-01T00:00:00Z'));
    });

    test('every day is 24 hours, also on local DST days', () => {
      const length = (month, day) =>
        (utcZone.instant({ year: 2026, month, day: day + 1 }) - utcZone.instant({ year: 2026, month, day })) / HOUR;
      assert.deepEqual([length(3, 8), length(11, 1)], [24, 24]);
    });

    test('times skipped or repeated in New York exist once', () => {
      assert.equal(utcZone.instant({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }), utc('2026-03-08T02:30:00Z'));
      assert.equal(utcZone.instant({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }), utc('2026-11-01T01:30:00Z'));
    });

    test('out-of-range fields roll over', () => {
      assert.equal(utcZone.instant({ year: 2026, month: 12, day: 32 }), utcZone.instant({ year: 2027, month: 1, day: 1 }));
      assert.equal(utcZone.instant({ year: 2026, month: 3, day: 1, hour: -1 }), utc('2026-02-28T23:00:00Z'));
    });

    test('years 0–99 are not read as 1900–1999', () => {
      assert.equal(utcZone.fields(utcZone.instant({ year: 50, month: 6, day: 15 })).year, 50);
    });

    test('offsetLabel is UTC all year', () => {
      assert.deepEqual([utcZone.offsetLabel(utc('2026-01-15T12:00:00Z')), utcZone.offsetLabel(utc('2026-07-15T12:00:00Z'))], ['UTC', 'UTC']);
    });
  });
}

// IANA zones, read through Intl, must not depend on the machine's own zone:
// these run on a machine in Hong Kong, so New York's DST comes from Intl.
const IANA = {
  ...ZONES,
  'Europe/London': {
    wall: { year: 2026, month: 3, day: 8, hour: 7, minute: 30, second: 0, ms: 0 },
    labels: ['GMT', 'GMT+1'],
    dayLengths: [24, 24], // its changes are on 29 March and 25 October
  },
  'Australia/Adelaide': {
    // Southern Hemisphere: summer time in January, ending on 5 April 2026.
    wall: { year: 2026, month: 3, day: 8, hour: 18, minute: 0, second: 0, ms: 0 },
    labels: ['GMT+10:30', 'GMT+9:30'],
    dayLengths: [24, 24],
  },
};

describe('IANA zones', () => {
  before(() => {
    process.env.TZ = 'Asia/Hong_Kong';
  });

  for (const [name, expected] of Object.entries(IANA)) {
    describe(name, () => {
      const zone = zoneNamed(name);

      test('fields and instant convert both ways', () => {
        const t = utc('2026-03-08T07:30:00Z');
        assert.deepEqual(zone.fields(t), expected.wall);
        assert.equal(zone.instant(expected.wall), t);
        assert.deepEqual(zone.fields(t + 123), { ...expected.wall, ms: 123 });
      });

      test('a day step follows the calendar across DST changes', () => {
        const length = (month, day) =>
          (zone.instant({ year: 2026, month, day: day + 1 }) - zone.instant({ year: 2026, month, day })) / HOUR;
        assert.deepEqual([length(3, 8), length(11, 1)], expected.dayLengths);
      });

      test('out-of-range fields roll over', () => {
        assert.equal(zone.instant({ year: 2026, month: 12, day: 32 }), zone.instant({ year: 2027, month: 1, day: 1 }));
        assert.equal(zone.instant({ year: 2026, month: 13 }), zone.instant({ year: 2027 }));
        assert.equal(zone.instant({ year: 2026, month: 3, day: 1, hour: -1 }), zone.instant({ year: 2026, month: 2, day: 28, hour: 23 }));
      });

      test('years 0–99 and before year 1 are not misread', () => {
        assert.equal(zone.fields(zone.instant({ year: 50, month: 6, day: 15 })).year, 50);
        assert.deepEqual(zone.fields(zone.instant({ year: -100, month: 6, day: 15, hour: 12 })), { year: -100, month: 6, day: 15, hour: 12, minute: 0, second: 0, ms: 0 });
      });

      test('offsetLabel names the offset at that instant', () => {
        assert.deepEqual([zone.offsetLabel(utc('2026-01-15T12:00:00Z')), zone.offsetLabel(utc('2026-07-15T12:00:00Z'))], expected.labels);
      });
    });
  }

  test('a time that does not exist moves forward', () => {
    const newYork = zoneNamed('America/New_York');
    assert.equal(newYork.instant({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }), utc('2026-03-08T07:30:00Z'));
    // Adelaide's clocks go from 02:00 to 03:00 on 4 October 2026.
    assert.equal(zoneNamed('Australia/Adelaide').instant({ year: 2026, month: 10, day: 4, hour: 2, minute: 30 }), utc('2026-10-03T17:00:00Z'));
  });

  test('a time that occurs twice uses the earlier instant', () => {
    const newYork = zoneNamed('America/New_York');
    assert.equal(newYork.instant({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }), utc('2026-11-01T05:30:00Z'));
    // Adelaide's 02:00–03:00 on 5 April 2026 happens at +10:30, then at +9:30.
    assert.equal(zoneNamed('Australia/Adelaide').instant({ year: 2026, month: 4, day: 5, hour: 2, minute: 30 }), utc('2026-04-04T16:00:00Z'));
  });

  test('Lord Howe Island moves its clocks by half an hour', () => {
    const zone = zoneNamed('Australia/Lord_Howe');
    assert.deepEqual([zone.offsetLabel(utc('2026-01-15T12:00:00Z')), zone.offsetLabel(utc('2026-07-15T12:00:00Z'))], ['GMT+11', 'GMT+10:30']);
    const length = (zone.instant({ year: 2026, month: 4, day: 6 }) - zone.instant({ year: 2026, month: 4, day: 5 })) / 60_000;
    assert.equal(length, 24.5 * 60);
  });
});

// The done-when check for the zone helper: an IANA zone gives the same
// answers as the local zone on a machine set to that zone. Conversions can
// only differ near an offset change, so the check is dense there: every 5
// minutes for 3 hours either side of each change in 2026, as instants and as
// wall-clock times, which covers the skipped and repeated times. The rest of
// the year gets a sparse sample, every 7 h 13 min so it lands on all sorts of
// minutes. The changes are found with Date (the local zone), not the zone
// under test.
describe('IANA zones match local time in that zone', () => {
  const MINUTE = 60_000;
  const sweep = {
    'America/New_York': 2,
    'Europe/London': 2,
    'Asia/Kolkata': 0,
    'Australia/Adelaide': 2,
    'Australia/Lord_Howe': 2,
    'America/Santiago': 2,
    'Asia/Hong_Kong': 0,
  };
  const from = utc('2026-01-01T12:00:00Z');
  const localOffset = (t) => -new Date(t).getTimezoneOffset();

  // The first minute of each new offset in 2026: a daily scan at noon UTC,
  // then a binary search within the day where the offset differs.
  const changes = () => {
    const found = [];
    for (let day = 0; day < 365; day++) {
      let lo = from + day * DAY_MS;
      let hi = lo + DAY_MS;
      if (localOffset(lo) === localOffset(hi)) continue;
      while (hi - lo > MINUTE) {
        const mid = lo + Math.floor((hi - lo) / 2 / MINUTE) * MINUTE;
        if (localOffset(mid) === localOffset(lo)) lo = mid;
        else hi = mid;
      }
      found.push(hi);
    }
    return found;
  };

  const sameAt = (zone, t) => {
    assert.deepEqual(zone.fields(t), local.fields(t), `fields at ${new Date(t).toISOString()}`);
    assert.equal(zone.offsetLabel(t), local.offsetLabel(t), `offsetLabel at ${new Date(t).toISOString()}`);
  };
  const sameInstant = (zone, wall) => {
    assert.equal(zone.instant(wall), local.instant(wall), `instant of ${JSON.stringify(wall)}`);
  };

  for (const [name, count] of Object.entries(sweep)) {
    test(name, () => {
      process.env.TZ = name;
      const zone = zoneNamed(name);
      const found = changes();
      assert.equal(found.length, count, `offset changes found in 2026: ${found.map((t) => new Date(t).toISOString())}`);

      for (const change of found) {
        const start = change - 3 * HOUR;
        const wall = local.fields(start);
        for (let k = 0; k <= 72; k++) {
          sameAt(zone, start + k * 5 * MINUTE);
          sameInstant(zone, { ...wall, second: 0, ms: 0, minute: wall.minute - (wall.minute % 5) + k * 5 });
        }
      }
      for (let k = 0; k * 433 * MINUTE < 365 * DAY_MS; k++) {
        sameAt(zone, from + k * 433 * MINUTE);
        sameInstant(zone, { year: 2026, month: 1, day: 1, minute: k * 433 });
      }
    });
  }
});

describe('zoneNamed', () => {
  test('finds local and UTC', () => {
    assert.equal(zoneNamed('local'), local);
    assert.equal(zoneNamed('UTC'), utcZone);
  });

  test('gives the UTC zone for names Intl reads as UTC', () => {
    for (const name of ['utc', 'Etc/UTC', 'GMT', 'Etc/GMT']) assert.equal(zoneNamed(name), utcZone);
  });

  test('finds IANA zones, the same object each time', () => {
    const tokyo = zoneNamed('Asia/Tokyo');
    assert.equal(tokyo.name, 'Asia/Tokyo');
    assert.equal(zoneNamed('Asia/Tokyo'), tokyo);
  });

  test("fixes the capitalisation, but keeps the developer's alias", () => {
    assert.equal(zoneNamed('asia/tokyo').name, 'Asia/Tokyo');
    assert.equal(zoneNamed('Asia/Kolkata').name, 'Asia/Kolkata');
    assert.equal(zoneNamed('US/Eastern').name, 'US/Eastern');
    // Aliases of one zone share Intl's id.
    assert.equal(zoneNamed('US/Eastern').id, zoneNamed('America/New_York').id);
  });

  test("IANA zones have Intl's name, the same all year, in the language asked for", () => {
    const [winter, summer] = [utc('2026-01-15T12:00:00Z'), utc('2026-07-15T12:00:00Z')];
    assert.equal(zoneNamed('Asia/Tokyo').displayName('en', winter), 'Japan Standard Time');
    assert.deepEqual([winter, summer].map((t) => zoneNamed('America/New_York').displayName('en', t)), ['Eastern Time', 'Eastern Time']);
    assert.equal(zoneNamed('Asia/Tokyo').displayName('ja', winter), '日本標準時');
    assert.equal(zoneNamed('Asia/Tokyo').displayName('zh-Hant', winter), '日本標準時間');
  });

  test('displayName is null where Intl has only an offset', () => {
    for (const name of ['Etc/GMT+9', '+09:00']) {
      for (const language of ['en', 'fr', 'ja']) assert.equal(zoneNamed(name).displayName(language, utc('2026-01-15T12:00:00Z')), null);
    }
  });

  test('throws for names Intl does not know, and for non-strings', () => {
    for (const name of ['Mars/Olympus_Mons', 'Local', '', null, undefined, 8]) {
      assert.throws(() => zoneNamed(name), /timeZone must be 'local', 'UTC' or an IANA time zone such as 'Asia\/Tokyo'/);
    }
  });
});

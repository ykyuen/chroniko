// Time zone helpers for the clock scale. This is the only module that reads
// or sets Date fields (getHours(), setDate() and so on); the clock scale and
// the renderer go through a zone object instead. Each zone has a name and the
// same three methods: the viewer's local zone, UTC, and any IANA zone such as
// 'Asia/Tokyo'.
//
// Instants are epoch ms. Wall-clock fields are
// { year, month, day, hour, minute, second, ms }, with month 1–12.

/** The viewer's own time zone, as the browser (or TZ in Node) reports it. */
export const local = {
  name: 'local',

  /** Wall-clock fields of an instant in this zone. */
  fields(ms) {
    const d = new Date(ms);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
      ms: d.getMilliseconds(),
    };
  },

  /**
   * The instant of a wall-clock time in this zone. Missing fields default to
   * the start of the period (month 1, day 1, 00:00). Fields out of range
   * roll over, so { day: day + 1 } is the next day's same wall-clock time,
   * which is 23 or 25 hours later across a DST change.
   * At a DST change, a time that doesn't exist moves forward (02:30 becomes
   * 03:30), and a time that occurs twice uses the earlier instant.
   */
  instant({ year, month = 1, day = 1, hour = 0, minute = 0, second = 0, ms = 0 }) {
    // Not new Date(year, …), which reads years 0–99 as 1900–1999.
    const d = new Date(0);
    d.setFullYear(year, month - 1, day);
    d.setHours(hour, minute, second, ms);
    return d.getTime();
  },

  /** The zone's UTC offset at an instant, e.g. "GMT+8", "GMT-4", "GMT+5:30", "GMT". */
  offsetLabel(ms) {
    return gmtLabel(-new Date(ms).getTimezoneOffset());
  },
};

// "GMT+8", "GMT-4", "GMT+5:30" or "GMT" for an offset in minutes, rounded to
// whole minutes (offsets before standard time had seconds too).
function gmtLabel(offsetMinutes) {
  const offset = Math.round(offsetMinutes);
  if (offset === 0) return 'GMT';
  const abs = Math.abs(offset);
  const minutes = abs % 60;
  return `GMT${offset < 0 ? '-' : '+'}${Math.floor(abs / 60)}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

/** Coordinated Universal Time: no offset and no DST, wherever the viewer is. */
export const utc = {
  name: 'UTC',

  fields(ms) {
    const d = new Date(ms);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      ms: d.getUTCMilliseconds(),
    };
  },

  /** As local.instant(); with no DST, every wall-clock time exists exactly once. */
  instant({ year, month = 1, day = 1, hour = 0, minute = 0, second = 0, ms = 0 }) {
    // Not Date.UTC(year, …), which reads years 0–99 as 1900–1999.
    const d = new Date(0);
    d.setUTCFullYear(year, month - 1, day);
    d.setUTCHours(hour, minute, second, ms);
    return d.getTime();
  },

  offsetLabel() {
    return 'UTC';
  },
};

const DAY = 86_400_000;

/**
 * A zone from the IANA database, e.g. 'Asia/Tokyo', read through Intl. The
 * zone's offset at an instant is what Intl shows there minus the instant;
 * wall-clock fields are then UTC fields shifted by that offset.
 * name is what the zone is called everywhere else (state, URL, callbacks);
 * id is what Intl resolved it to, the same for aliases of one zone.
 */
function ianaZone(name, id) {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: id,
    hourCycle: 'h23',
    era: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  // The offset in ms at an instant: positive east of Greenwich.
  const offset = (ms) => {
    const f = {};
    for (const { type, value } of format.formatToParts(ms)) f[type] = value;
    const year = f.era === 'BC' || f.era === 'B' ? 1 - Number(f.year) : Number(f.year);
    const shown = utc.instant({
      year,
      month: Number(f.month),
      day: Number(f.day),
      hour: Number(f.hour),
      minute: Number(f.minute),
      second: Number(f.second),
    });
    return shown - (ms - (((ms % 1000) + 1000) % 1000));
  };

  return {
    name,
    id,

    fields(ms) {
      return utc.fields(ms + offset(ms));
    },

    /**
     * As local.instant(). The wall-clock time read as UTC is shifted by the
     * offsets in force a day either side; at most one of those is wrong, at
     * a DST change. A time that both give back occurs twice, and the earlier
     * one is used; a time neither gives back was skipped, and moves forward
     * by reading it with the offset before the change.
     */
    instant(wall) {
      const shown = utc.instant(wall);
      const before = offset(shown - DAY);
      const after = offset(shown + DAY);
      if (before === after && offset(shown - before) === before) return shown - before;
      const fits = [before, after].filter((o) => offset(shown - o) === o).map((o) => shown - o);
      return fits.length ? Math.min(...fits) : shown - before;
    },

    offsetLabel(ms) {
      return gmtLabel(offset(ms) / 60_000);
    },
  };
}

const ZONES = new Map([['local', local], ['UTC', utc]]);

/**
 * The zone with this name: 'local', 'UTC', or an IANA name such as
 * 'Asia/Tokyo', checked by Intl, which also takes aliases ('US/Eastern') and
 * any capitalisation. Names Intl reads as UTC ('Etc/UTC', 'GMT') give the UTC
 * zone. Otherwise the zone keeps the name it was given, with Intl's
 * capitalisation where Intl doesn't swap it for another alias: engines don't
 * agree on which alias is canonical (Node and Chrome turn 'Asia/Kolkata'
 * into 'Asia/Calcutta'), so the name the developer chose is the one shown.
 * Throws for a name Intl doesn't know.
 */
export function zoneNamed(name) {
  const known = ZONES.get(name);
  if (known) return known;
  let id;
  if (typeof name === 'string' && name !== '') {
    try {
      id = new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone;
    } catch {
      // RangeError: not a zone Intl knows.
    }
  }
  if (!id) {
    throw new Error(`Chroniko: timeZone must be 'local', 'UTC' or an IANA time zone such as 'Asia/Tokyo', got ${JSON.stringify(name)}`);
  }
  const zone = id === 'UTC' ? utc : ianaZone(id.toLowerCase() === name.toLowerCase() ? id : name, id);
  ZONES.set(name, zone);
  return zone;
}

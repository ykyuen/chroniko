// Time zone helpers for the clock scale. This is the only module that reads
// or sets Date fields (getHours(), setDate() and so on); the clock scale and
// the renderer go through a zone object instead. Each zone has a name and the
// same three methods, so 0.8.0 can add IANA zones without changing anything
// else.
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
    const offset = -Math.round(new Date(ms).getTimezoneOffset());
    if (offset === 0) return 'GMT';
    const abs = Math.abs(offset);
    const minutes = abs % 60;
    return `GMT${offset < 0 ? '-' : '+'}${Math.floor(abs / 60)}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
  },
};

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

const ZONES = { local, UTC: utc };

/**
 * The zone with this name: 'local' or 'UTC'. Throws for anything else, since
 * IANA names such as 'Asia/Tokyo' aren't supported yet.
 */
export function zoneNamed(name) {
  if (typeof name === 'string' && Object.hasOwn(ZONES, name)) return ZONES[name];
  throw new Error(`Chroniko: timeZone must be 'local' or 'UTC', got ${JSON.stringify(name)}. IANA time zones such as 'Asia/Tokyo' are planned for a later version.`);
}

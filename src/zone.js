// Time zone helpers for the clock scale. This is the only module that reads
// or sets Date fields (getHours(), setDate() and so on); the clock scale and
// the renderer go through a zone object instead. 0.6.0 adds a UTC zone and
// 0.8.0 IANA zones with the same three methods, so nothing else has to change.
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

// English. This is the reference locale: every key is defined here, and a key
// another locale leaves out falls back to this one.
//
// Functions receive values that are already escaped for HTML. endOf() gets the
// title wrapped in <strong>, so it can be placed anywhere in the sentence.
// In units, "#" is replaced by the number, formatted for the language; the
// keys are Intl.PluralRules categories (zero, one, two, few, many, other).

export default {
  // Toolbar and timeline
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit',
  dimUnselected: 'Dim unselected events',
  largerText: 'Larger text',
  // The timeZones toggle shows the zone in use: localTime, or "UTC" as is.
  // switchTimeZone() is its tooltip and accessible label, and gets plain
  // text (not escaped). It must contain the shown zone, best at the start, so
  // speech input can find the button by what it shows.
  localTime: 'Local time',
  switchTimeZone: (current, next) => `${current} (time zone). Switch to ${next}`,
  categories: 'Categories',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) => `Timeline. Drag or use arrow keys to pan; press + and −, ${ctrl}+scroll or pinch to zoom.`,
  hint: (ctrl) => `${ctrl} + scroll to zoom, or click the timeline first`,

  // Story
  selectedEvents: 'Selected events',
  clearAll: 'Clear all',
  placeholder: 'Click an event to add it here.',
  showOnTimeline: 'Show on timeline',
  readMore: 'Read more ↗',
  tags: 'Tags',
  remove: (title) => `Remove ${title} from selection`,
  endOf: (title) => `End of ${title}`,
  lasted: (duration) => `lasted ${duration}`,
  endsAria: (title, date, duration) => `${title} ends ${date}${duration ? `, after ${duration}` : ''}. Go to event`,

  // Dates. year() gets a whole year, negative for BCE; month() and day() get
  // the month name and the already formatted year. dayMonth() labels day
  // ticks on the clock scale, and dateTime() joins a date and a 24-hour time.
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  year: (y) => (y < 0 ? `${-y} BCE` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day} ${month} ${year}`,
  dayMonth: (day, month) => `${day} ${month}`,
  dateTime: (date, time) => `${date}, ${time}`,

  // Durations, e.g. "2 years, 11 months"
  units: {
    year: { one: '# year', other: '# years' },
    month: { one: '# month', other: '# months' },
    day: { one: '# day', other: '# days' },
    hour: { one: '# hour', other: '# hours' },
    minute: { one: '# minute', other: '# minutes' },
    second: { one: '# second', other: '# seconds' },
  },
  unitJoin: ', ',
  lessThan: {
    year: 'less than a year',
    month: 'less than a month',
    day: 'less than a day',
    hour: 'less than an hour',
    minute: 'less than a minute',
    second: 'less than a second',
  },
};

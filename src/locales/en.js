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
  largerText: 'Larger text',
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
  remove: (title) => `Remove ${title} from selection`,
  endOf: (title) => `End of ${title}`,
  lasted: (duration) => `lasted ${duration}`,
  endsAria: (title, date, duration) => `${title} ends ${date}${duration ? `, after ${duration}` : ''}. Go to event`,

  // Dates. year() gets a whole year, negative for BCE; month() and day() get
  // the month name and the already formatted year.
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  year: (y) => (y < 0 ? `${-y} BCE` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day} ${month} ${year}`,

  // Durations, e.g. "2 years, 11 months"
  units: {
    year: { one: '# year', other: '# years' },
    month: { one: '# month', other: '# months' },
    day: { one: '# day', other: '# days' },
  },
  unitJoin: ', ',
  lessThan: { year: 'less than a year', month: 'less than a month', day: 'less than a day' },
};

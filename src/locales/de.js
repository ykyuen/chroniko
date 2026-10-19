// German. See en.js for what each key is. German keyboards label Ctrl "Strg".

export default {
  zoomIn: 'Vergrößern',
  zoomOut: 'Verkleinern',
  fit: 'Einpassen',
  dimUnselected: 'Nicht ausgewählte abblenden',
  largerText: 'Größere Schrift',
  categories: 'Kategorien',
  ctrlKey: 'Strg',
  viewport: (ctrl) =>
    `Zeitleiste. Zum Verschieben ziehen oder die Pfeiltasten verwenden; zum Zoomen + und −, ${ctrl}+Mausrad oder zwei Finger verwenden.`,
  hint: (ctrl) => `${ctrl} + Mausrad zum Zoomen, oder zuerst auf die Zeitleiste klicken`,

  selectedEvents: 'Ausgewählte Ereignisse',
  clearAll: 'Alle entfernen',
  placeholder: 'Klicken Sie auf ein Ereignis, um es hier hinzuzufügen.',
  showOnTimeline: 'Auf der Zeitleiste anzeigen',
  readMore: 'Mehr erfahren ↗',
  tags: 'Schlagwörter',
  remove: (title) => `${title} aus der Auswahl entfernen`,
  endOf: (title) => `Ende: ${title}`,
  lasted: (duration) => `Dauer: ${duration}`,
  endsAria: (title, date, duration) => `Ende von ${title}: ${date}${duration ? `, Dauer ${duration}` : ''}. Zum Ereignis`,

  months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  year: (y) => (y < 0 ? `${-y} v. Chr.` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day}. ${month} ${year}`,

  units: {
    year: { one: '# Jahr', other: '# Jahre' },
    month: { one: '# Monat', other: '# Monate' },
    day: { one: '# Tag', other: '# Tage' },
  },
  unitJoin: ', ',
  lessThan: { year: 'weniger als ein Jahr', month: 'weniger als ein Monat', day: 'weniger als ein Tag' },
};

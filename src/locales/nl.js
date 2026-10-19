// Dutch. See en.js for what each key is. "jaar" stays singular after a number
// ("3 jaar"), as Dutch does.

export default {
  zoomIn: 'Inzoomen',
  zoomOut: 'Uitzoomen',
  fit: 'Passend maken',
  dimUnselected: 'Niet-geselecteerde dimmen',
  largerText: 'Grotere tekst',
  categories: 'Categorieën',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) =>
    `Tijdlijn. Sleep of gebruik de pijltjestoetsen om te verschuiven; druk op + en −, ${ctrl}+scrollen of knijp om te zoomen.`,
  hint: (ctrl) => `${ctrl} + scrollen om te zoomen, of klik eerst op de tijdlijn`,

  selectedEvents: 'Geselecteerde gebeurtenissen',
  clearAll: 'Alles wissen',
  placeholder: 'Klik op een gebeurtenis om die hier toe te voegen.',
  showOnTimeline: 'Tonen op tijdlijn',
  readMore: 'Meer lezen ↗',
  tags: 'Tags',
  remove: (title) => `${title} uit selectie verwijderen`,
  endOf: (title) => `Einde: ${title}`,
  lasted: (duration) => `duur: ${duration}`,
  endsAria: (title, date, duration) => `Einde van ${title}: ${date}${duration ? `, duur ${duration}` : ''}. Ga naar gebeurtenis`,

  months: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
  year: (y) => (y < 0 ? `${-y} v.Chr.` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day} ${month} ${year}`,

  units: {
    year: { one: '# jaar', other: '# jaar' },
    month: { one: '# maand', other: '# maanden' },
    day: { one: '# dag', other: '# dagen' },
  },
  unitJoin: ' en ',
  lessThan: { year: 'minder dan een jaar', month: 'minder dan een maand', day: 'minder dan een dag' },
};

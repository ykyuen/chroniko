// Italian. See en.js for what each key is.

export default {
  zoomIn: 'Ingrandisci',
  zoomOut: 'Riduci',
  fit: 'Adatta',
  dimUnselected: 'Attenua i non selezionati',
  largerText: 'Testo più grande',
  categories: 'Categorie',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) =>
    `Linea del tempo. Trascina o usa i tasti freccia per spostarti; premi + e −, ${ctrl}+rotellina o pizzica per lo zoom.`,
  hint: (ctrl) => `${ctrl} + rotellina per lo zoom, oppure fai prima clic sulla linea del tempo`,

  selectedEvents: 'Eventi selezionati',
  clearAll: 'Cancella tutto',
  placeholder: 'Fai clic su un evento per aggiungerlo qui.',
  showOnTimeline: 'Mostra sulla linea del tempo',
  readMore: 'Scopri di più ↗',
  remove: (title) => `Rimuovi ${title} dalla selezione`,
  endOf: (title) => `Fine: ${title}`,
  lasted: (duration) => `durata: ${duration}`,
  endsAria: (title, date, duration) => `Fine di ${title}: ${date}${duration ? `, durata ${duration}` : ''}. Vai all’evento`,

  months: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  year: (y) => (y < 0 ? `${-y} a.C.` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day} ${month} ${year}`,

  units: {
    year: { one: '# anno', other: '# anni' },
    month: { one: '# mese', other: '# mesi' },
    day: { one: '# giorno', other: '# giorni' },
  },
  unitJoin: ' e ',
  lessThan: { year: 'meno di un anno', month: 'meno di un mese', day: 'meno di un giorno' },
};

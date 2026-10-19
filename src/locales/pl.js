// Polish. See en.js for what each key is. Durations use all four plural forms:
// 1 rok, 2 lata, 5 lat, 1,5 roku. Short month names avoid the case change
// between "marzec" and "19 marca".

export default {
  zoomIn: 'Powiększ',
  zoomOut: 'Pomniejsz',
  fit: 'Dopasuj',
  dimUnselected: 'Przyciemnij niezaznaczone',
  largerText: 'Większy tekst',
  categories: 'Kategorie',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) =>
    `Oś czasu. Przeciągnij lub użyj klawiszy strzałek, aby przesuwać; naciśnij + i −, ${ctrl}+kółko myszy lub zsuń palce, aby zmienić powiększenie.`,
  hint: (ctrl) => `${ctrl} + kółko myszy, aby zmienić powiększenie, lub najpierw kliknij oś czasu`,

  selectedEvents: 'Wybrane wydarzenia',
  clearAll: 'Wyczyść wszystko',
  placeholder: 'Kliknij wydarzenie, aby dodać je tutaj.',
  showOnTimeline: 'Pokaż na osi czasu',
  readMore: 'Więcej ↗',
  tags: 'Tagi',
  remove: (title) => `Usuń ${title} z wyboru`,
  endOf: (title) => `Koniec: ${title}`,
  lasted: (duration) => `czas trwania: ${duration}`,
  endsAria: (title, date, duration) =>
    `Koniec: ${title}, ${date}${duration ? `, czas trwania ${duration}` : ''}. Przejdź do wydarzenia`,

  months: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
  year: (y) => (y < 0 ? `${-y} p.n.e.` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day} ${month} ${year}`,

  units: {
    year: { one: '# rok', few: '# lata', many: '# lat', other: '# roku' },
    month: { one: '# miesiąc', few: '# miesiące', many: '# miesięcy', other: '# miesiąca' },
    day: { one: '# dzień', few: '# dni', many: '# dni', other: '# dnia' },
  },
  unitJoin: ', ',
  lessThan: { year: 'mniej niż rok', month: 'mniej niż miesiąc', day: 'mniej niż dzień' },
};

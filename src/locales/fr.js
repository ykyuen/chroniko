// French. See en.js for what each key is. The spaces before ":" and ";" and
// inside « » are no-break spaces (U+00A0), as French typography requires.

export default {
  zoomIn: 'Zoom avant',
  zoomOut: 'Zoom arrière',
  fit: 'Ajuster',
  dimUnselected: 'Atténuer les non sélectionnés',
  largerText: 'Texte plus grand',
  categories: 'Catégories',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) =>
    `Frise chronologique. Faites glisser ou utilisez les flèches pour vous déplacer ; appuyez sur + et −, ${ctrl}+molette ou pincez pour zoomer.`,
  hint: (ctrl) => `${ctrl} + molette pour zoomer, ou cliquez d’abord sur la frise`,

  selectedEvents: 'Événements sélectionnés',
  clearAll: 'Tout effacer',
  placeholder: 'Cliquez sur un événement pour l’ajouter ici.',
  showOnTimeline: 'Afficher sur la frise',
  readMore: 'En savoir plus ↗',
  tags: 'Étiquettes',
  remove: (title) => `Retirer ${title} de la sélection`,
  endOf: (title) => `Fin : ${title}`,
  lasted: (duration) => `durée : ${duration}`,
  endsAria: (title, date, duration) =>
    `Fin de « ${title} » : ${date}${duration ? `, durée ${duration}` : ''}. Aller à l’événement`,

  months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  year: (y) => (y < 0 ? `${-y} av. J.-C.` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day === 1 ? '1er' : day} ${month} ${year}`,

  units: {
    year: { one: '# an', other: '# ans' },
    month: { one: '# mois', other: '# mois' },
    day: { one: '# jour', other: '# jours' },
  },
  unitJoin: ' et ',
  lessThan: { year: 'moins d’un an', month: 'moins d’un mois', day: 'moins d’un jour' },
};

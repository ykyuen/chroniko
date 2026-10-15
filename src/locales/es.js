// Spanish. See en.js for what each key is.

export default {
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  fit: 'Ajustar',
  largerText: 'Texto más grande',
  categories: 'Categorías',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) =>
    `Línea de tiempo. Arrastra o usa las flechas para desplazarte; pulsa + y −, ${ctrl}+rueda o pellizca para hacer zoom.`,
  hint: (ctrl) => `${ctrl} + rueda para hacer zoom, o haz clic primero en la línea de tiempo`,

  selectedEvents: 'Eventos seleccionados',
  clearAll: 'Borrar todo',
  placeholder: 'Haz clic en un evento para añadirlo aquí.',
  showOnTimeline: 'Mostrar en la línea de tiempo',
  readMore: 'Más información ↗',
  remove: (title) => `Quitar ${title} de la selección`,
  endOf: (title) => `Fin: ${title}`,
  lasted: (duration) => `duración: ${duration}`,
  endsAria: (title, date, duration) => `Fin de ${title}: ${date}${duration ? `, duración ${duration}` : ''}. Ir al evento`,

  months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  year: (y) => (y < 0 ? `${-y} a. C.` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day} ${month} ${year}`,

  units: {
    year: { one: '# año', other: '# años' },
    month: { one: '# mes', other: '# meses' },
    day: { one: '# día', other: '# días' },
  },
  unitJoin: ' y ',
  lessThan: { year: 'menos de un año', month: 'menos de un mes', day: 'menos de un día' },
};

// Portuguese, worded to read naturally in both Portugal and Brazil. See en.js
// for what each key is.

export default {
  zoomIn: 'Ampliar',
  zoomOut: 'Reduzir',
  fit: 'Ajustar',
  dimUnselected: 'Escurecer os não selecionados',
  largerText: 'Texto maior',
  categories: 'Categorias',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) =>
    `Linha do tempo. Arraste ou use as setas para deslocar; use + e −, ${ctrl}+roda ou o gesto de pinça para ampliar ou reduzir.`,
  hint: (ctrl) => `${ctrl} + roda para ampliar ou reduzir, ou clique primeiro na linha do tempo`,

  selectedEvents: 'Eventos selecionados',
  clearAll: 'Limpar tudo',
  placeholder: 'Clique num evento para adicioná-lo aqui.',
  showOnTimeline: 'Mostrar na linha do tempo',
  readMore: 'Saiba mais ↗',
  remove: (title) => `Remover ${title} da seleção`,
  endOf: (title) => `Fim: ${title}`,
  lasted: (duration) => `duração: ${duration}`,
  endsAria: (title, date, duration) => `Fim de ${title}: ${date}${duration ? `, duração ${duration}` : ''}. Ir para o evento`,

  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  year: (y) => (y < 0 ? `${-y} a.C.` : String(y)),
  month: (month, year) => `${month} ${year}`,
  day: (day, month, year) => `${day} ${month} ${year}`,

  units: {
    year: { one: '# ano', other: '# anos' },
    month: { one: '# mês', other: '# meses' },
    day: { one: '# dia', other: '# dias' },
  },
  unitJoin: ' e ',
  lessThan: { year: 'menos de um ano', month: 'menos de um mês', day: 'menos de um dia' },
};

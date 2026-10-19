// Cantonese, written colloquially in traditional characters. See en.js for
// what each key is.

export default {
  zoomIn: '放大',
  zoomOut: '縮細',
  fit: '睇晒',
  dimUnselected: '淡化未揀嘅',
  largerText: '大啲字',
  categories: '類別',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) => `時間軸。拖或者用方向鍵左右移；撳 + 同 −、${ctrl} + 碌滾輪或者用兩隻手指縮放。`,
  hint: (ctrl) => `${ctrl} + 碌滾輪就可以縮放，或者先撳一下時間軸`,

  selectedEvents: '揀咗嘅事件',
  clearAll: '清晒',
  placeholder: '撳一下事件就會加入呢度。',
  showOnTimeline: '喺時間軸度睇',
  readMore: '睇多啲 ↗',
  remove: (title) => `移走「${title}」`,
  endOf: (title) => `${title}完結`,
  lasted: (duration) => `維持咗${duration}`,
  endsAria: (title, date, duration) => `${title}喺${date}完結${duration ? `，維持咗${duration}` : ''}。去返個事件`,

  months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  year: (y) => (y < 0 ? `公元前${-y}年` : `${y}年`),
  month: (month, year) => `${year}${month}`,
  day: (day, month, year) => `${year}${month}${day}日`,

  units: {
    year: { other: '#年' },
    month: { other: '#個月' },
    day: { other: '#日' },
  },
  unitJoin: '',
  lessThan: { year: '唔夠一年', month: '唔夠一個月', day: '唔夠一日' },
};

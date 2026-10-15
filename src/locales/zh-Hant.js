// Traditional Chinese (written standard). See en.js for what each key is.

export default {
  zoomIn: '放大',
  zoomOut: '縮小',
  fit: '全覽',
  largerText: '放大文字',
  categories: '類別',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) => `時間軸。拖曳或使用方向鍵平移；按 + 和 −、${ctrl} + 滾輪或雙指縮放。`,
  hint: (ctrl) => `${ctrl} + 滾輪縮放，或先點擊時間軸`,

  selectedEvents: '已選事件',
  clearAll: '全部清除',
  placeholder: '點擊事件以加入此處。',
  showOnTimeline: '在時間軸上顯示',
  readMore: '了解更多 ↗',
  remove: (title) => `從已選事件中移除「${title}」`,
  endOf: (title) => `${title}結束`,
  lasted: (duration) => `歷時${duration}`,
  endsAria: (title, date, duration) => `${title}於${date}結束${duration ? `，歷時${duration}` : ''}。前往事件`,

  months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  year: (y) => (y < 0 ? `公元前${-y}年` : `${y}年`),
  month: (month, year) => `${year}${month}`,
  day: (day, month, year) => `${year}${month}${day}日`,

  units: {
    year: { other: '#年' },
    month: { other: '#個月' },
    day: { other: '#天' },
  },
  unitJoin: '',
  lessThan: { year: '不足一年', month: '不足一個月', day: '不足一天' },
};

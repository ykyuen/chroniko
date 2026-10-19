// Simplified Chinese. See en.js for what each key is.

export default {
  zoomIn: '放大',
  zoomOut: '缩小',
  fit: '全览',
  dimUnselected: '淡化未选事件',
  largerText: '放大文字',
  categories: '类别',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) => `时间轴。拖动或使用方向键平移；按 + 和 −、${ctrl} + 滚轮或双指缩放。`,
  hint: (ctrl) => `${ctrl} + 滚轮缩放，或先点击时间轴`,

  selectedEvents: '已选事件',
  clearAll: '全部清除',
  placeholder: '点击事件以添加到此处。',
  showOnTimeline: '在时间轴上显示',
  readMore: '了解更多 ↗',
  tags: '标签',
  remove: (title) => `从已选事件中移除“${title}”`,
  endOf: (title) => `${title}结束`,
  lasted: (duration) => `历时${duration}`,
  endsAria: (title, date, duration) => `${title}于${date}结束${duration ? `，历时${duration}` : ''}。前往事件`,

  months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  year: (y) => (y < 0 ? `公元前${-y}年` : `${y}年`),
  month: (month, year) => `${year}${month}`,
  day: (day, month, year) => `${year}${month}${day}日`,

  units: {
    year: { other: '#年' },
    month: { other: '#个月' },
    day: { other: '#天' },
  },
  unitJoin: '',
  lessThan: { year: '不足一年', month: '不足一个月', day: '不足一天' },
};

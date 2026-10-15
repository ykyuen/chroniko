// Japanese. See en.js for what each key is.

export default {
  zoomIn: '拡大',
  zoomOut: '縮小',
  fit: '全体表示',
  largerText: '文字を大きく',
  categories: 'カテゴリ',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) =>
    `タイムライン。ドラッグまたは矢印キーで移動し、+ と −、${ctrl} + スクロール、またはピンチで拡大・縮小します。`,
  hint: (ctrl) => `${ctrl} + スクロールで拡大・縮小、または先にタイムラインをクリック`,

  selectedEvents: '選択した出来事',
  clearAll: 'すべて解除',
  placeholder: '出来事をクリックするとここに追加されます。',
  showOnTimeline: 'タイムラインで表示',
  readMore: '詳しく見る ↗',
  remove: (title) => `「${title}」を選択から外す`,
  endOf: (title) => `${title}の終わり`,
  lasted: (duration) => `期間：${duration}`,
  endsAria: (title, date, duration) => `${title}は${date}に終了${duration ? `（期間：${duration}）` : ''}。出来事へ移動`,

  months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  year: (y) => (y < 0 ? `紀元前${-y}年` : `${y}年`),
  month: (month, year) => `${year}${month}`,
  day: (day, month, year) => `${year}${month}${day}日`,

  units: {
    year: { other: '#年' },
    month: { other: '#か月' },
    day: { other: '#日' },
  },
  unitJoin: '',
  lessThan: { year: '1年未満', month: '1か月未満', day: '1日未満' },
};

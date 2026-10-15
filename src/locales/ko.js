// Korean. See en.js for what each key is.

export default {
  zoomIn: '확대',
  zoomOut: '축소',
  fit: '전체 보기',
  largerText: '글자 크게',
  categories: '분류',
  ctrlKey: 'Ctrl',
  viewport: (ctrl) => `타임라인. 드래그하거나 화살표 키로 이동하고, + 와 −, ${ctrl}+스크롤 또는 핀치로 확대/축소합니다.`,
  hint: (ctrl) => `${ctrl} + 스크롤로 확대/축소하거나 먼저 타임라인을 클릭하세요`,

  selectedEvents: '선택한 사건',
  clearAll: '모두 지우기',
  placeholder: '사건을 클릭하면 여기에 추가됩니다.',
  showOnTimeline: '타임라인에서 보기',
  readMore: '더 보기 ↗',
  remove: (title) => `선택에서 ${title} 제거`,
  endOf: (title) => `${title} 종료`,
  lasted: (duration) => `기간: ${duration}`,
  endsAria: (title, date, duration) => `${title} 종료: ${date}${duration ? `, 기간 ${duration}` : ''}. 사건으로 이동`,

  months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  year: (y) => (y < 0 ? `기원전 ${-y}년` : `${y}년`),
  month: (month, year) => `${year} ${month}`,
  day: (day, month, year) => `${year} ${month} ${day}일`,

  units: {
    year: { other: '#년' },
    month: { other: '#개월' },
    day: { other: '#일' },
  },
  unitJoin: ' ',
  lessThan: { year: '1년 미만', month: '1개월 미만', day: '1일 미만' },
};

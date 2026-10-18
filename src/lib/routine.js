// 루틴 룰 엔진 — 설정(기상·취침) + 설문 → 시간별 혈당 관리 하루 계획 (순수 함수)
// 룰 근거: 식사 간격 4~6h, 식후 30분/2h 혈당 측정, 식후 산책, 저녁→취침 3h, 수면 7h 이상
const MINUTES_PER_DAY = 1440;

export function timeToMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!m) return null;
  const value = Number(m[1]) * 60 + Number(m[2]);
  return value >= 0 && value < MINUTES_PER_DAY ? value : null;
}

export function minutesToTime(minutes) {
  const normalized = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// 설정 → { schedule: [{ time, type, title, desc }], warnings: [] }
// settings: { wakeTime, bedTime } (필수) — 식사 시간은 미지정 시 룰 기본값으로 자동 계산
export function buildRoutine(settings, surveyAnswers) {
  const s = settings || {};
  const survey = surveyAnswers || {}; // 설문 로드 전 null 방어
  const wake = timeToMinutes(s.wakeTime) ?? 420; // 07:00
  let bed = timeToMinutes(s.bedTime) ?? 1380; // 23:00
  if (bed <= wake) bed += MINUTES_PER_DAY; // 자정 넘김 취침

  // 식사 기본값 — 아침 기상+30분, 점심 아침+5.5h, 저녁 취침 3h 전 (30분 단위 반올림)
  const round30 = (m) => Math.round(m / 30) * 30;
  const breakfast = timeToMinutes(s.breakfast) ?? round30(wake + 30);
  const lunch = timeToMinutes(s.lunch) ?? Math.max(breakfast + 240, round30(breakfast + 330));
  const dinner = timeToMinutes(s.dinner) ?? Math.max(lunch + 240, round30(bed - 180));

  const activity = survey.activity || '보통';
  const walkMinutes = activity === '높음' || activity === '매우높음' ? 30 : 20;
  const measureOffsets = survey.carbSensitivity === '높음' ? [30, 60, 120] : [30, 120];

  const schedule = [];
  const push = (minutes, type, title, desc) =>
    schedule.push({ minutes, time: minutesToTime(minutes), type, title, desc });

  push(wake, 'wake', '기상', '물 1잔으로 하루 시작');

  const addMeal = (minutes, label) => {
    push(minutes, 'meal', `${label} 식사`, '채소·단백질을 먼저, 탄수화물은 마지막에');
    for (const offset of measureOffsets) {
      push(
        minutes + offset,
        'glucose',
        `${label} 식후 ${offset}분 혈당 측정`,
        offset === 30 ? '스파이크 확인' : '식후 혈당 기록'
      );
    }
    const walkAt = minutes + 60;
    if (walkAt + walkMinutes < (label === '저녁' ? bed : MINUTES_PER_DAY * 2)) {
      push(walkAt, 'exercise', `식후 산책 ${walkMinutes}분`, '식후 혈당 상승 완화');
    }
  };

  addMeal(breakfast, '아침');
  addMeal(lunch, '점심');

  // 간식 — 점심·저녁 간격이 5시간을 넘으면 중간에 저GI 간식 배치
  if (dinner - lunch > 300) {
    push(lunch + Math.round((dinner - lunch) / 2 / 30) * 30, 'snack', '간식', '견과·그릭요거트 등 저GI 간식 (과식 방지)');
  }

  addMeal(dinner, '저녁');

  push(bed, 'sleep', '취침', `수면 ${Math.floor((bed - wake) / 60)}시간 목표`);

  schedule.sort((a, b) => a.minutes - b.minutes);

  const warnings = [];
  if (bed - wake < 420) warnings.push('수면을 7시간 이상으로 늘려야 함.');
  if (dinner + 180 > bed) warnings.push('저녁 식사를 취침 3시간 전까지 앞기거나 취침을 늦춰야 함.');
  if (lunch - breakfast < 240 || dinner - lunch < 240) warnings.push('식사 간격을 4시간 이상 벌려야 함.');
  if (breakfast - wake > 90) warnings.push('기상 후 1시간 반 이내에 아침 식사를 해야 함.');

  return { schedule, warnings };
}

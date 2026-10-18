const ACTIVITY_FACTORS = {
  '낮음': 1.2,
  '보통': 1.375,
  '높음': 1.55,
  '매우높음': 1.725,
};

export function bmiOf({ height, weight }) {
  const h = Number(height) / 100;
  const w = Number(weight);
  if (!h || !w) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}

export function bmiLabel(bmi) {
  if (bmi == null) return '정보 없음';
  if (bmi < 18.5) return '저체중';
  if (bmi < 23) return '정상';
  if (bmi < 25) return '과체중';
  return '비만';
}

export function bmr({ gender, age, height, weight }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(gender === '남' ? base + 5 : base - 161);
}

const SENSITIVITY_LEVELS = ['낮음', '보통', '높음'];

// 설문에서 "탄수화물 민감도" 질문 제거에 따른 유도 함수 —
// 식사 후 반응(혈당 스파이크 전형 증상)을 기본으로, BMI·운동 빈도·수면으로 ±단계 보정
// (인슐린 감수성과 연관된 생활 신호만 사용, 근거 약한 나이·성별은 제외)
export function deriveCarbSensitivity(answers) {
  const a = answers || {};
  let level =
    a.mealReactions === '나른함/졸림' || a.mealReactions === '어지러움' ? 2 : 1;
  const bmi = bmiOf({ height: a.height, weight: a.weight });
  if (bmi != null && bmi >= 25) level += 1;
  if (a.exercise === '거의 안 함') level += 1;
  else if (a.exercise === '주 5회 이상') level -= 1;
  if (Number(a.sleep) > 0 && Number(a.sleep) < 6) level += 1;
  return SENSITIVITY_LEVELS[Math.min(2, Math.max(0, level))];
}

export function analyze(answers) {
  const a = answers || {};
  const baseBmr = bmr({
    gender: a.gender,
    age: Number(a.age) || 0,
    height: Number(a.height) || 0,
    weight: Number(a.weight) || 0,
  });

  const tdee = Math.round(baseBmr * (ACTIVITY_FACTORS[a.activity] || 1.375));

  let targetCalories = tdee;
  if (a.weightGoal === '감량') targetCalories = tdee - 500;
  else if (a.weightGoal === '증량') targetCalories = tdee + 300;

  const carbTarget = Math.round((targetCalories * 0.45) / 4);

  const sugarSignals = [];
  const sensitivityLevel = a.carbSensitivity || deriveCarbSensitivity(a);
  if (sensitivityLevel === '높음') {
    sugarSignals.push({
      type: 'sensitivity',
      text: '탄수화물 민감도가 높으니 식사 후 혈당 상승에 주의해야 함.',
    });
  }
  if (a.stress === '높음') {
    sugarSignals.push({
      type: 'stress',
      text: '스트레스 관리로 혈당 변동을 줄여야 함.',
    });
  }
  if (Number(a.sleep) > 0 && Number(a.sleep) < 6) {
    sugarSignals.push({
      type: 'sleep',
      text: '수면을 6시간 이상으로 늘려야 함.',
    });
  }
  if (a.familyHistory === true) {
    sugarSignals.push({
      type: 'family',
      text: '가족력이 있으니 정기적인 혈당 체크를 해야 함.',
    });
  }

  return {
    bmr: baseBmr,
    tdee,
    targetCalories,
    carbTarget,
    sugarSignals,
    bmi: bmiOf({ height: Number(a.height), weight: Number(a.weight) }),
    bmiLabel: bmiLabel(bmiOf({ height: Number(a.height), weight: Number(a.weight) })),
  };
}

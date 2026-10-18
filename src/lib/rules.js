// 룰 기반 혈당 예측 엔진 — 시그니처 유지한 채 내부만 AI API로 교체 가능 (Plan.md 5장)
import { getFood } from './fooddb';

const SENSITIVITY_FACTORS = { '낮음': 0.15, '보통': 0.25, '높음': 0.4 };
const MEAL_FACTORS = { '아침': 1.1, '점심': 1.0, '저녁': 0.95, '간식': 1.05 };
const BASE_GLUCOSE = 95; // 공복 혈당 추정값

function normalizeItem(item) {
  if (typeof item === 'string') return { foodId: item, servings: 1 };
  return {
    foodId: item.foodId || null,
    servings: item.servings ?? 1,
    name: item.name,
    carbs: item.carbs,
    giFactor: item.giFactor ?? 0.8, // AI 추정 항목 기본 계수
  };
}

export function predictGlucose(items, surveyAnswers, mealTime) {
  const sensitivity = SENSITIVITY_FACTORS[(surveyAnswers || {}).carbSensitivity] || 0.25;
  const mealFactor = MEAL_FACTORS[mealTime] || 1.0;

  const risePerItem = (items || []).map((raw) => {
    const { foodId, servings, name, carbs: directCarbs, giFactor } = normalizeItem(raw);

    // AI 추정 항목 — fooddb 조회 없이 모델이 제공한 carbs로 계산
    if (!foodId) {
      const delta = directCarbs
        ? Math.round(directCarbs * servings * sensitivity * giFactor * mealFactor)
        : 0;
      return { name: name || '알 수 없는 음식', delta };
    }

    const food = getFood(foodId);
    if (!food) return { name: '알 수 없는 음식', delta: 0 };
    const delta = Math.round(food.carbs * servings * sensitivity * food.giFactor * mealFactor);
    return { name: food.name, delta };
  });

  const totalRise = risePerItem.reduce((sum, item) => sum + item.delta, 0);

  return { peakMgDl: BASE_GLUCOSE + totalRise, risePerItem, base: BASE_GLUCOSE };
}

// 혈당 수준 분류 — StatusBadge·문구 표준화 기준 (정상 <140 / 주의 140~199 / 경고 ≥200)
export function glucoseLevel(mgDl) {
  if (mgDl == null) return 'ok';
  if (mgDl >= 200) return 'danger';
  if (mgDl >= 140) return 'warn';
  return 'ok';
}

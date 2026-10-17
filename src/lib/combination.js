// 혈당 스파이크 완화 조합 추천 — 룰 기반 순수 함수 (AI 없이 즉시 동작, 실패 리스크 0)
// 전략: ① 가장 많이 오르는 음식 양 절반 → 재계산 ② 영향 낮은 음식 먼저 ③ 영향 낮은 음식 추가 추천
import { FOODS } from './fooddb';
import { predictGlucose } from './rules';

const CUT_THRESHOLD = 15; // mg/dL — 이 이상 오르는 항목을 양 조절 대상으로

function halveItem(item) {
  if (typeof item === 'string') return { foodId: item, servings: 0.5 };
  return { ...item, servings: (item.servings ?? 1) / 2 };
}

// items: [{ foodId, servings }] 또는 [{ name, carbs, servings }] (AI 추정 포함)
export function suggestCombination(items, surveyAnswers, mealTime) {
  if (!items || items.length === 0) return null;

  const base = predictGlucose(items, surveyAnswers, mealTime);

  const ranked = base.risePerItem
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => b.delta - a.delta);

  // ① 양 조절 — 스파이크 1등 항목 절반
  const top = ranked[0];
  const cut = top.delta >= CUT_THRESHOLD ? top : null;
  const after = cut
    ? predictGlucose(
        items.map((it, i) => (i === cut.index ? halveItem(it) : it)),
        surveyAnswers,
        mealTime
      )
    : base;

  // ② 먹는 순서 — 혈당 영향 낮은 음식부터
  const orderFirst = [...ranked].reverse().slice(0, 2).map((r) => r.name);

  // ③ 추가 추천 — DB 전체에서 1인분 기준 영향이 가장 낮은 음식 2개 (이미 담긴 것 제외)
  const existing = new Set(base.risePerItem.map((r) => r.name));
  const additions = FOODS.filter((f) => !existing.has(f.name))
    .map((f) => ({
      name: f.name,
      delta: predictGlucose([{ foodId: f.id, servings: 1 }], surveyAnswers, mealTime).risePerItem[0]
        .delta,
    }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 2)
    .map((x) => x.name);

  return {
    beforePeak: base.peakMgDl,
    afterPeak: after.peakMgDl,
    cut: cut ? { name: cut.name, delta: cut.delta } : null,
    orderFirst,
    additions,
  };
}

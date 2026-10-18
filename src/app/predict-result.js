// 에이전트 B 작업 영역 — 예측 결과: 최고 혈당 + 배지 + 차트 + 분석 결과 + 조합/기록 (M1)
// params 없이 직접 진입하면 안내 후 홈으로 유도 (크래시 방지)
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import StatusBadge from '../components/StatusBadge';
import BloodSugarChart from '../components/BloodSugarChart';
import AnimatedSection from '../components/AnimatedSection';
import { predictGlucose, glucoseLevel } from '../lib/rules';
import { suggestCombination } from '../lib/combination';
import { get, set, KEYS } from '../lib/storage';

const CHART_LABELS = ['식전', '30분', '1시간', '2시간', '3시간'];

// 혈당 구간별 분석 결과 — 액션은 "~해야 함" 문체 (문체 가이드 7장)
const ANALYSIS_BY_LEVEL = {
  ok: [
    '지금 식단 구성을 유지해도 혈당에 큰 영향이 없을 것으로 예상돼요.',
    '채소와 단백질을 먼저 먹는 순서를 지켜야 함.',
    '식후 가벼운 산책을 유지해야 함.',
  ],
  warn: [
    '식후 혈당 상승이 큰 편이에요. 구성을 점검할 타이밍이에요.',
    '흰쌀·빵·단 음료를 통곡물로 대체해야 함.',
    '식사 시 채소와 단백질을 먼저 섭취해야 함.',
    '식후 30분 산책을 습관화해야 함.',
  ],
  danger: [
    '혈당 급상승이 예상돼요. 구성 조정이 필요해요.',
    '고GI 탄수화물 양을 절반 이하로 줄여야 함.',
    '당 음료 대신 물이나 무당 음료를 선택해야 함.',
    '식후 산책으로 상승을 완화해야 함.',
  ],
};

// 합계 — 인분 반영 kcal·탄수화물 (스냅샷 저장용)
function sumTotals(list) {
  let kcal = 0;
  let carbs = 0;
  (list || []).forEach((it) => {
    kcal += (it.kcal || 0) * (it.servings ?? 1);
    carbs += (it.carbs || 0) * (it.servings ?? 1);
  });
  return { kcal: Math.round(kcal), carbs: Math.round(carbs) };
}

export default function PredictResultScreen() {
  const params = useLocalSearchParams();
  const [items, setItems] = useState(null);
  const [mealTime, setMealTime] = useState('점심');
  const [answers, setAnswers] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [showCombination, setShowCombination] = useState(false);
  const [combination, setCombination] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const raw = Array.isArray(params.items) ? params.items[0] : params.items;
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn('예측 params 파싱 실패:', e);
      }
      if (!mounted) return;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setInvalid(true);
        return;
      }
      setItems(parsed);
      const time = params.mealTime || '점심';
      setMealTime(time);
      const a = await get(KEYS.SURVEY_ANSWERS);
      if (!mounted) return;
      setAnswers(a);
      setCombination(suggestCombination(parsed, a, time));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const prediction = items ? predictGlucose(items, answers, mealTime) : null;
  const level = prediction ? glucoseLevel(prediction.peakMgDl) : 'ok';

  // 단순 상승 곡선 — 식전 → 1시간 최고 → 완만한 하락
  const chartValues = prediction
    ? [
        prediction.base,
        prediction.base + Math.round((prediction.peakMgDl - prediction.base) * 0.45),
        prediction.peakMgDl,
        prediction.base + Math.round((prediction.peakMgDl - prediction.base) * 0.85),
        prediction.base + Math.round((prediction.peakMgDl - prediction.base) * 0.6),
      ]
    : [];

  // 기록 저장 — 저장 시점 화면의 모든 내용을 snapshot으로 보존 (내 기록 상세가 동일하게 재생)
  const saveLog = async () => {
    const logs = (await get(KEYS.FOOD_LOGS)) || [];
    logs.push({
      date: new Date().toISOString().slice(0, 10),
      mealTime,
      items: items || [],
      snapshot: {
        totals: sumTotals(items),
        prediction: {
          peakMgDl: prediction.peakMgDl,
          base: prediction.base,
          risePerItem: prediction.risePerItem,
        },
        chart: { labels: CHART_LABELS, values: chartValues },
        analysis: { level, lines: ANALYSIS_BY_LEVEL[level] },
        combination,
        recipes: null,
        advice: null,
      },
    });
    const ok = await set(KEYS.FOOD_LOGS, logs);
    if (ok) setSaved(true);
  };

  const goHome = () => router.replace('/(tabs)');

  if (invalid) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            예측 데이터가 없어요
          </ThemedText>
          <ThemedText variant="body" style={styles.cardBody}>
            홈에서 음식을 선택해 예측을 시작해 주세요.
          </ThemedText>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={goHome}
            accessibilityRole="button"
          >
            <ThemedText variant="headline" style={styles.primaryButtonText}>
              홈으로 이동
            </ThemedText>
          </Pressable>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="subhead" style={styles.lead}>
        선택한 음식 {items ? items.length : 0}개 · {mealTime} 기준
      </ThemedText>

      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            상승량 변화
          </ThemedText>
          {prediction ? (
            <>
              <View style={styles.peakRow}>
                <ThemedText variant="hero" style={styles.peakText}>
                  {prediction.peakMgDl}
                  <ThemedText variant="subhead" style={styles.peakSub}>
                    {'  '}mg/dL
                  </ThemedText>
                </ThemedText>
                <StatusBadge level={level} />
              </View>
              <BloodSugarChart labels={CHART_LABELS} values={chartValues} />
              <ThemedText variant="caption" style={styles.chartNote}>
                최고 {prediction.peakMgDl} mg/dL · 공복 {prediction.base} 기준 추정
              </ThemedText>
            </>
          ) : (
            <ThemedText variant="body" style={styles.cardBody}>
              예측을 계산하고 있어요...
            </ThemedText>
          )}
        </Card>
      </AnimatedSection>

      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            분석 결과
          </ThemedText>
          {ANALYSIS_BY_LEVEL[level].map((line, i) => (
            <ThemedText key={`${level}-${i}`} variant="body" style={styles.itemText}>
              · {line}
            </ThemedText>
          ))}
        </Card>
      </AnimatedSection>

      {!showCombination && combination && (
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => setShowCombination(true)}
          accessibilityRole="button"
        >
          <Ionicons name="bulb" size={16} color={colors.primary} />
          <ThemedText variant="subhead" style={styles.secondaryButtonText}>
            맞춤 식단 추천 보기
          </ThemedText>
        </Pressable>
      )}

      {showCombination && combination && (
        <AnimatedSection>
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              혈당 관리 먹는 순서 가이드
            </ThemedText>
            {combination.cut && (
              <ThemedText variant="body" style={styles.itemText}>
                · {combination.cut.name}의 양을 절반으로 — 예상 최고 {combination.beforePeak} →{' '}
                {combination.afterPeak} mg/dL
              </ThemedText>
            )}
            {combination.orderFirst.length > 0 && (
              <ThemedText variant="body" style={styles.itemText}>
                · 먼저 드시면 좋은 음식: {combination.orderFirst.join(' → ')}
              </ThemedText>
            )}
            {combination.additions.length > 0 && (
              <ThemedText variant="body" style={styles.itemText}>
                · 추가 추천: {combination.additions.join(', ')} (혈당 영향 낮음)
              </ThemedText>
            )}
          </Card>
        </AnimatedSection>
      )}

      {saved && (
        <AnimatedSection>
          <Card style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <ThemedText variant="subhead" style={styles.successText}>
              오늘의 식단에 기록했어요
            </ThemedText>
          </Card>
        </AnimatedSection>
      )}

      {prediction && (
        <AnimatedSection>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={saveLog}
            accessibilityRole="button"
          >
            <ThemedText variant="headline" style={styles.primaryButtonText}>
              이 식단 기록하기
            </ThemedText>
          </Pressable>
        </AnimatedSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lead: { color: colors.sub },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  peakText: { color: colors.text },
  peakSub: { color: colors.sub },
  chartNote: { color: colors.sub, marginTop: spacing.sm },
  itemText: { color: colors.sub, lineHeight: 22 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '600' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  primaryButtonText: { color: colors.onTint },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
  },
  successText: { color: colors.text, flex: 1 },
});

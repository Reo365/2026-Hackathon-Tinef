// 에이전트 B 작업 영역 — 혈당 예측하기: 시간 타일 + 음식 검색 + 선택 관리 + 예측 (M1)
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import TimeTiles from '../components/TimeTiles';
import FoodRow, { deltaColor } from '../components/FoodRow';
import AnimatedSection from '../components/AnimatedSection';
import { searchFoods } from '../lib/fooddb';
import { searchFoods as searchMfds } from '../lib/nutrition';
import { predictGlucose } from '../lib/rules';
import { get, KEYS } from '../lib/storage';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 식약처 결과와 내장 DB 결과의 중복 제거용 — 공백 무시 이름 비교
const squashName = (s) => String(s || '').replace(/\s+/g, '');

export default function PredictScreen() {
  const [mealTime, setMealTime] = useState('점심');
  const [query, setQuery] = useState('');
  const [answers, setAnswers] = useState(null);
  const [selected, setSelected] = useState([]);
  // 식약처(공공데이터포털) 검색 결과 — 내장 37종 밖의 음식 (nutrition.js가 번역·정렬·캐시 처리)
  const [remoteResults, setRemoteResults] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    get(KEYS.SURVEY_ANSWERS).then((a) => {
      if (mounted) setAnswers(a);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const queryTrimmed = query.trim();

  // 식약처 검색 — 입력 멈춤 0.35초 후 1회 호출 (캐시 적중 시 즉시)
  // setState는 디바운스 콜백 안에서만 — 이펙트 본문의 동기 setState(cascading render) 방지
  useEffect(() => {
    if (!queryTrimmed) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setRemoteLoading(true);
      const items = await searchMfds(queryTrimmed, { limit: 10 });
      if (!cancelled) {
        setRemoteResults(items);
        setRemoteLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [queryTrimmed]);

  const today = new Date();
  const dateLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${WEEKDAYS[today.getDay()]})`;

  // 검색 결과 — 내장 DB(37종) 먼저, 식약처 DB 결과 이어붙임. 이미 선택한 것은 제외
  const localResults = searchFoods(queryTrimmed).filter((f) => !selected.some((s) => s.key === f.id));
  const localNames = new Set(localResults.map((f) => squashName(f.name)));
  const localRows = localResults
    .slice(0, queryTrimmed ? 10 : 6)
    .map((f) => ({ ...f, key: f.id, isMfds: false }));
  const remoteRows = queryTrimmed
    ? remoteResults
        .filter(
          (r) =>
            !localNames.has(squashName(r.name)) &&
            !selected.some((s) => s.key === `mfds:${r.foodCd}`)
        )
        .map((r) => ({ ...r, key: `mfds:${r.foodCd}`, isMfds: true }))
    : [];
  const rows = [...localRows, ...remoteRows];

  const addFood = (food) => {
    setSelected((prev) => [
      ...prev,
      food.isMfds
        ? {
            key: `mfds:${food.foodCd}`,
            name: food.name,
            displayName: food.displayName,
            serving: `${food.serving}`,
            servings: 1,
            kcal: food.kcal,
            carbs: food.carbs,
            giFactor: food.giFactor,
          }
        : {
            key: food.id,
            foodId: food.id,
            name: food.name,
            serving: food.serving,
            servings: 1,
            kcal: food.kcal,
            carbs: food.carbs,
            giFactor: food.giFactor,
          },
    ]);
  };

  const changeServings = (key, step) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.key === key
          ? { ...s, servings: Math.max(0.5, Math.round((s.servings + step) * 2) / 2) }
          : s
      )
    );
  };

  const removeFood = (key) => {
    setSelected((prev) => prev.filter((s) => s.key !== key));
  };

  // 항목별 상승량 실시간 계산 — 선택 즉시 반영 (식약처 항목은 name/carbs 경로)
  const itemDeltas = selected.map((s) => ({
    ...s,
    delta: predictGlucose(
      [
        s.foodId
          ? { foodId: s.foodId, servings: s.servings }
          : { name: s.name, carbs: s.carbs, giFactor: s.giFactor, servings: s.servings },
      ],
      answers,
      mealTime
    ).risePerItem[0].delta,
  }));
  const totalDelta = itemDeltas.reduce((sum, s) => sum + s.delta, 0);

  const predict = () => {
    router.push({
      pathname: '/predict-result',
      params: { items: JSON.stringify(selected), mealTime },
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="subhead" style={styles.lead}>
        오늘 먹은 음식으로{'\n'}식후 혈당 변화를 예측해요
      </ThemedText>

      <Card>
        <ThemedText variant="caption" style={styles.dateLabel}>
          {dateLabel}
        </ThemedText>
        <ThemedText variant="headline" style={styles.cardTitle}>
          식사 시간
        </ThemedText>
        <TimeTiles value={mealTime} onChange={setMealTime} />
      </Card>

      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          음식 검색 또는 직접 입력
        </ThemedText>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.sub} />
          <TextInput
            style={styles.input}
            placeholder="음식 이름을 검색하세요"
            placeholderTextColor={colors.sub}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="음식 검색"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="검색어 지우기">
              <Ionicons name="close-circle" size={16} color={colors.sub} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.resultList}>
          {rows.length > 0 ? (
            rows.map((food) => {
              const rowDelta = predictGlucose(
                [
                  food.isMfds
                    ? { name: food.name, carbs: food.carbs, giFactor: food.giFactor, servings: 1 }
                    : { foodId: food.id, servings: 1 },
                ],
                answers,
                mealTime
              ).risePerItem[0].delta;
              return (
                <FoodRow
                  key={food.key}
                  name={food.displayName || food.name}
                  serving={food.isMfds ? `${food.serving} · ${food.sourceLabel || '식약처'}` : food.serving}
                  delta={rowDelta}
                  onPress={() => addFood(food)}
                  actionLabel={`${food.name} 선택`}
                />
              );
            })
          ) : (
            <ThemedText variant="subhead" style={styles.emptyText}>
              {remoteLoading
                ? '식약처 DB에서 검색 중이에요…'
                : '검색 결과가 없어요. 다른 키워드로 검색해 보세요.'}
            </ThemedText>
          )}
        </View>
      </Card>

      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            선택한 음식 {selected.length}개
          </ThemedText>
          {selected.length === 0 ? (
            <ThemedText variant="subhead" style={styles.emptyText}>
              위 목록에서 음식을 선택하세요.
            </ThemedText>
          ) : (
            <>
              {itemDeltas.map((s) => (
                <View key={s.key} style={styles.selectedRow}>
                  <View style={styles.selectedLeft}>
                    <ThemedText variant="body" style={styles.selectedName}>
                      {s.displayName || s.name} × {s.servings}인분
                    </ThemedText>
                    <ThemedText variant="caption" style={[styles.itemDelta, { color: deltaColor(s.delta) }]}>
                      +{s.delta} mg/dL
                    </ThemedText>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable
                      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                      onPress={() => changeServings(s.key, -0.5)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name} 0.5인분 줄이기`}
                    >
                      <Ionicons name="remove" size={14} color={colors.text} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                      onPress={() => changeServings(s.key, 0.5)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name} 0.5인분 늘리기`}
                    >
                      <Ionicons name="add" size={14} color={colors.text} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                      onPress={() => removeFood(s.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name} 삭제`}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
              <ThemedText variant="body" style={styles.totalText}>
                합계 상승 +{totalDelta} mg/dL
              </ThemedText>
            </>
          )}
        </Card>
      </AnimatedSection>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          selected.length === 0 && styles.disabledButton,
          pressed && styles.pressed,
        ]}
        onPress={predict}
        disabled={selected.length === 0}
        accessibilityRole="button"
      >
        <ThemedText variant="headline" style={styles.primaryButtonText}>
          예측하기
        </ThemedText>
      </Pressable>

      <Card style={styles.tipCard}>
        <View style={styles.tipRow}>
          <ThemedText variant="subhead" style={styles.tipText}>
            식사 순서를 채소 → 단백질 → 탄수화물로 바꾸면 혈당 상승이 완만해져요!
          </ThemedText>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lead: { color: colors.sub, lineHeight: 22 },
  dateLabel: { marginBottom: spacing.sm },
  cardTitle: { marginBottom: spacing.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: { flex: 1, color: colors.text, fontSize: type.body.fontSize, paddingVertical: 0 },
  resultList: { gap: spacing.xs },
  emptyText: { color: colors.sub, paddingVertical: spacing.sm },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  selectedLeft: { flex: 1 },
  selectedName: { color: colors.text },
  itemDelta: { fontWeight: '600' },
  stepper: { flexDirection: 'row', gap: spacing.xs },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalText: { color: colors.text, fontWeight: '700', marginTop: spacing.sm },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
    opacity: 1,
  },
  pressed: { opacity: 0.7 },
  disabledButton: { opacity: 0.4 },
  primaryButtonText: { color: colors.onTint },
  tipCard: { backgroundColor: colors.primarySoft },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: { flex: 1, color: colors.text },
});

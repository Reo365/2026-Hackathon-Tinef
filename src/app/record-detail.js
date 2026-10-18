// 에이전트 B 작업 영역 — 기록 상세: 목록에서 넘어온 기록 1건의 저장 정보 표시
// 저장 시점 화면의 모든 내용이 snapshot에 보존되어 동일한 디자인·내용으로 재생된다
// params 없이 직접 진입하면 안내 후 뒤로 유도 (크래시 방지)
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import StatusBadge from '../components/StatusBadge';
import BloodSugarChart from '../components/BloodSugarChart';
import { predictGlucose, glucoseLevel } from '../lib/rules';
import { get, KEYS } from '../lib/storage';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CHART_LABELS = ['식전', '30분', '1시간', '2시간', '3시간'];

// 'YYYY-MM-DD' → 'M월 D일 (요일)'
function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export default function RecordDetailScreen() {
  const params = useLocalSearchParams();
  const [log, setLog] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [invalid, setInvalid] = useState(false);
  // 데이터 화면과 동일한 더보기 패턴 — 5개 초과 목록 접기/펼치기
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [risesExpanded, setRisesExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const raw = Array.isArray(params.log) ? params.log[0] : params.log;
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn('기록 상세 params 파싱 실패:', e);
      }
      if (!mounted) return;
      if (!parsed || typeof parsed !== 'object') {
        setInvalid(true);
        return;
      }
      setLog(parsed);
      setAnswers(await get(KEYS.SURVEY_ANSWERS));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 스냅샷 — 저장 시점 화면 전체 (구버전 기록은 없을 수 있음)
  const snap = log && log.snapshot && typeof log.snapshot === 'object' ? log.snapshot : null;
  const items = log && Array.isArray(log.items) ? log.items : [];

  // 합계 — 스냅샷 우선, 없으면 저장 항목에서 산출
  const totals =
    snap?.totals ||
    (() => {
      let kcal = 0;
      let carbs = 0;
      items.forEach((it) => {
        kcal += (it.kcal || 0) * (it.servings ?? 1);
        carbs += (it.carbs || 0) * (it.servings ?? 1);
      });
      return { kcal: Math.round(kcal), carbs: Math.round(carbs) };
    })();

  // 혈당 영향 — 저장 시점 값 그대로. 스냅샷 없는 구버전 기록만 동일 룰로 재계산
  const prediction =
    snap?.prediction ||
    (items.length > 0 ? predictGlucose(items, answers, log.mealTime) : null);
  const chart =
    snap?.chart ||
    (prediction
      ? {
          labels: CHART_LABELS,
          values: [
            prediction.base,
            prediction.base + Math.round((prediction.peakMgDl - prediction.base) * 0.45),
            prediction.peakMgDl,
            prediction.base + Math.round((prediction.peakMgDl - prediction.base) * 0.85),
            prediction.base + Math.round((prediction.peakMgDl - prediction.base) * 0.6),
          ],
        }
      : null);
  const level = prediction ? glucoseLevel(prediction.peakMgDl) : 'ok';

  const goBack = () => router.back();

  if (invalid) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            기록을 찾을 수 없어요
          </ThemedText>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={goBack}
            accessibilityRole="button"
          >
            <ThemedText variant="headline" style={styles.primaryButtonText}>
              목록으로 돌아가기
            </ThemedText>
          </Pressable>
        </Card>
      </ScrollView>
    );
  }

  if (!log) {
    // params 파싱 전 첫 렌더 — null 접근 크래시 방지용 로딩 상태
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <ThemedText variant="body" style={styles.itemText}>
            기록을 불러오고 있어요...
          </ThemedText>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="subhead" style={styles.lead}>
        {formatDate(log.date)} · {log.mealTime || '식사'} 기준
      </ThemedText>

      {/* 식단 내역 — 저장 시점 '이번 식사 성분'/'선택한 음식'과 동일 디자인 */}
      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          식단 내역
        </ThemedText>
        {items.length === 0 ? (
          <ThemedText variant="body" style={styles.itemText}>
            저장된 항목이 없어요.
          </ThemedText>
        ) : (
          <>
            {(itemsExpanded ? items : items.slice(0, 5)).map((it, i) => (
              <View key={`${it.name}-${i}`} style={styles.itemRow}>
                <ThemedText variant="body" style={styles.itemName}>
                  · {it.name} × {it.servings ?? 1}인분
                </ThemedText>
                <ThemedText variant="caption" style={styles.itemText}>
                  약 {Math.round((it.kcal || 0) * (it.servings ?? 1))} kcal · 탄수화물 약{' '}
                  {Math.round((it.carbs || 0) * (it.servings ?? 1))}g
                </ThemedText>
              </View>
            ))}
            {items.length > 5 && (
              <Pressable
                style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
                onPress={() => setItemsExpanded(!itemsExpanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: itemsExpanded }}
              >
                <Ionicons
                  name={itemsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primaryDeep}
                />
                <ThemedText variant="subhead" style={styles.moreText}>
                  {itemsExpanded ? '접기' : `더보기 (외 ${items.length - 5}개)`}
                </ThemedText>
              </Pressable>
            )}
            <ThemedText variant="body" style={styles.totalText}>
              합계 약 {totals.kcal} kcal · 탄수화물 약 {totals.carbs}g
            </ThemedText>
          </>
        )}
      </Card>

      {/* 식후 혈당 예측 — 저장 시점 차트·최고값·항목별 상승 그대로 */}
      {prediction && (
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            식후 혈당 예측
          </ThemedText>
          <View style={styles.peakRow}>
            <ThemedText variant="hero" style={styles.peakText}>
              {prediction.peakMgDl}
              <ThemedText variant="subhead" style={styles.peakSub}>
                {'  '}mg/dL
              </ThemedText>
            </ThemedText>
            <StatusBadge level={level} />
          </View>
          {chart && <BloodSugarChart labels={chart.labels} values={chart.values} />}
          <ThemedText variant="caption" style={styles.itemText}>
            최고 {prediction.peakMgDl} mg/dL · 공복 {prediction.base} 기준
          </ThemedText>
          {(risesExpanded ? prediction.risePerItem : prediction.risePerItem.slice(0, 5)).map((r) => (
            <ThemedText key={r.name} variant="body" style={styles.itemText}>
              · {r.name}: +{r.delta} mg/dL
            </ThemedText>
          ))}
          {prediction.risePerItem.length > 5 && (
            <Pressable
              style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
              onPress={() => setRisesExpanded(!risesExpanded)}
              accessibilityRole="button"
              accessibilityState={{ expanded: risesExpanded }}
            >
              <Ionicons
                name={risesExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.primaryDeep}
              />
              <ThemedText variant="subhead" style={styles.moreText}>
                {risesExpanded
                  ? '접기'
                  : `더보기 (외 ${prediction.risePerItem.length - 5}개)`}
              </ThemedText>
            </Pressable>
          )}
        </Card>
      )}

      {/* 분석 결과 — 예측 흐름에서 저장된 구간별 문구 그대로 */}
      {snap?.analysis?.lines && (
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            분석 결과
          </ThemedText>
          {snap.analysis.lines.map((line, i) => (
            <ThemedText key={`${line}-${i}`} variant="body" style={styles.itemText}>
              · {line}
            </ThemedText>
          ))}
        </Card>
      )}

      {/* 먹는 순서 가이드 — 저장 시점 조합 그대로 */}
      {snap?.combination && (
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            혈당 관리 먹는 순서 가이드
          </ThemedText>
          {snap.combination.cut && (
            <ThemedText variant="body" style={styles.itemText}>
              · {snap.combination.cut.name}의 양을 절반으로 — 예상 최고 {snap.combination.beforePeak} →{' '}
              {snap.combination.afterPeak} mg/dL
            </ThemedText>
          )}
          {snap.combination.orderFirst?.length > 0 && (
            <ThemedText variant="body" style={styles.itemText}>
              · 먼저 드시면 좋은 음식: {snap.combination.orderFirst.join(' → ')}
            </ThemedText>
          )}
          {snap.combination.additions?.length > 0 && (
            <ThemedText variant="body" style={styles.itemText}>
              · 추가 추천: {snap.combination.additions.join(', ')} (혈당 영향 낮음)
            </ThemedText>
          )}
        </Card>
      )}

      {/* 추천 레시피 — 재료 사진 기록에만 저장됨 */}
      {snap?.recipes?.length > 0 && (
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            추천 레시피
          </ThemedText>
          {snap.recipes.map((recipe, i) => (
            <View key={`${recipe.title}-${i}`} style={styles.recipeBlock}>
              <ThemedText variant="headline" style={styles.recipeTitle}>
                {i + 1}. {recipe.title}
              </ThemedText>
              {recipe.ingredients?.length > 0 && (
                <ThemedText variant="subhead" style={styles.itemText}>
                  재료: {recipe.ingredients.join(', ')}
                </ThemedText>
              )}
              {recipe.desc ? (
                <ThemedText variant="body" style={styles.itemText}>
                  {recipe.desc}
                </ThemedText>
              ) : null}
              {recipe.how ? (
                <ThemedText variant="subhead" style={styles.itemText}>
                  만드는 법: {recipe.how}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      {/* AI 조언 — 저장 시점 문구 그대로 */}
      {snap?.advice ? (
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            AI 혈당 관리 조언
          </ThemedText>
          <ThemedText variant="body" style={styles.cardBody}>
            {snap.advice}
          </ThemedText>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lead: { color: colors.sub },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  itemRow: { marginBottom: spacing.xs },
  itemName: { color: colors.text },
  itemText: { color: colors.sub },
  totalText: { color: colors.text, fontWeight: '700', marginTop: spacing.sm },
  recipeBlock: { gap: spacing.xs, marginTop: spacing.sm },
  recipeTitle: { color: colors.text },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  moreText: { color: colors.primaryDeep, fontWeight: '600' },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  peakText: { color: colors.text },
  peakSub: { color: colors.sub },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  primaryButtonText: { color: colors.onTint },
});

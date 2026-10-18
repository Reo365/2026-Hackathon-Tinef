// 에이전트 B 작업 영역 — 내 기록: FOOD_LOGS 저장 목록(최신순) → 탭하면 상세 화면
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import Card from '../../components/Card';
import ThemedText from '../../components/ThemedText';
import Placeholder from '../../components/Placeholder';
import { get, KEYS } from '../../lib/storage';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 'YYYY-MM-DD' → 'M월 D일 (요일)'
function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// 합계 — 저장된 항목의 kcal·탄수화물 (인분 반영)
function summarize(items) {
  let kcal = 0;
  let carbs = 0;
  (items || []).forEach((it) => {
    kcal += (it.kcal || 0) * (it.servings ?? 1);
    carbs += (it.carbs || 0) * (it.servings ?? 1);
  });
  return { kcal: Math.round(kcal), carbs: Math.round(carbs) };
}

export default function RecordsScreen() {
  const [logs, setLogs] = useState(null); // null = 조회 중

  // 탭 포커스마다 재조회 — 식단 분석·예측에서 저장 후 복귀 시 즉시 반영
  useFocusEffect(
    useCallback(() => {
      get(KEYS.FOOD_LOGS).then((v) => setLogs(Array.isArray(v) ? v : []));
    }, [])
  );

  if (logs === null || logs.length === 0) {
    return (
      <Placeholder
        icon="stats-chart-outline"
        title="내 기록"
        description={
          logs === null
            ? '기록을 불러오고 있어요'
            : '식단 분석이나 혈당 예측에서 기록을 저장하면 여기에 표시돼요'
        }
      />
    );
  }

  // 저장은 push(시간순) → 역순으로 최신 먼저 표시
  const entries = logs.map((log, index) => ({ log, index })).reverse();

  const openDetail = (log) => {
    router.push({ pathname: '/record-detail', params: { log: JSON.stringify(log) } });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {entries.map(({ log, index }) => {
        const items = Array.isArray(log.items) ? log.items : [];
        const names = items.map((it) => it?.name).filter(Boolean);
        const { kcal, carbs } = summarize(items);
        return (
          <Pressable
            key={`${log.date}-${index}`}
            onPress={() => openDetail(log)}
            accessibilityRole="button"
            accessibilityLabel={`${formatDate(log.date)} ${log.mealTime || ''} 기록 상세 보기`}
          >
            <Card>
              <View style={styles.rowTop}>
                <ThemedText variant="headline" style={styles.date}>
                  {formatDate(log.date)}
                </ThemedText>
                {log.mealTime ? (
                  <ThemedText variant="caption" style={styles.mealBadge}>
                    {log.mealTime}
                  </ThemedText>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={colors.sub} />
              </View>
              <ThemedText variant="body" style={styles.summary} numberOfLines={1}>
                {names.length > 0 ? names.join(', ') : '저장된 항목이 없어요'}
              </ThemedText>
              <ThemedText variant="caption" style={styles.totals}>
                약 {kcal} kcal · 탄수화물 약 {carbs}g
              </ThemedText>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: { flex: 1, color: colors.text },
  mealBadge: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  summary: { color: colors.sub, marginTop: spacing.xs },
  totals: { color: colors.sub, marginTop: spacing.xs },
});

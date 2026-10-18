// 홈 — 설문 기반 개인화 대시보드 (A)
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../../theme';
import Card from '../../components/Card';
import ThemedText from '../../components/ThemedText';
import { get, KEYS } from '../../lib/storage';
import { analyze } from '../../lib/analysis';
import { glucoseLevel, predictGlucose } from '../../lib/rules';

const SHORTCUTS = [
  { icon: 'water', label: '혈당 예측', href: '/predict' },
  { icon: 'restaurant', label: '식단 분석', href: '/food-log' },
  { icon: 'time-outline', label: '루틴 계획', href: '/schedule' },
];

const LEVEL_TEXT = { ok: '정상 범위', warn: '주의 구간', danger: '경고 구간' };

export default function HomeScreen() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  // 오늘 마지막 식사 기록 기준 예상 혈당 — 기록이 없으면 null (수치 미표시)
  const [forecast, setForecast] = useState(null);

  // 탭 포커스마다 재조회 — 식단 기록 후 복귀 시 즉시 반영
  const loadHome = useCallback(async () => {
    const [answers, logs] = await Promise.all([get(KEYS.SURVEY_ANSWERS), get(KEYS.FOOD_LOGS)]);
    if (answers) setResult(analyze(answers));

    const today = new Date().toISOString().slice(0, 10);
    const todays = (logs || []).filter(
      (log) => log.date === today && Array.isArray(log.items) && log.items.length > 0
    );
    if (!answers || todays.length === 0) {
      setForecast(null);
      return;
    }
    const latest = todays[todays.length - 1];
    const prediction = predictGlucose(latest.items, answers, latest.mealTime);
    setForecast({
      peak: prediction.peakMgDl,
      mealTime: latest.mealTime,
      level: glucoseLevel(prediction.peakMgDl),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="largeTitle">오늘도 건강하게</ThemedText>

      {/* 앱의 핵심 가치(예상 혈당) — 오늘 마지막 식사 기록 기준 predictGlucose, 기록 전에는 수치 미표시 */}
      <Card style={styles.hero}>
        <ThemedText variant="subhead" style={styles.onTintSoft}>
          예상 혈당
        </ThemedText>
        <ThemedText variant="hero">
          {forecast ? forecast.peak : '—'}{' '}
          <ThemedText variant="headline" style={styles.onTintSoft}>
            mg/dL
          </ThemedText>
        </ThemedText>
        <ThemedText variant="caption" style={styles.onTintSoft}>
          {forecast
            ? `${forecast.mealTime} 기준 예상 · ${LEVEL_TEXT[forecast.level]}`
            : '식단을 기록하면 오늘 식사 기준 예상 혈당이 표시돼요'}
        </ThemedText>
      </Card>

      {/* 바로가기 3개 — 다른 카드와 동일한 전체 폭, 3등분 균등 배치
          Link asChild 사용 금지: Slot이 자식의 함수형 style을 객체 병합하며 유실시켜
          flex/중앙 정렬/프레스 효과가 모두 사라짐 → router.push + Pressable 사용 */}
      <View style={styles.shortcutGroup}>
        {SHORTCUTS.map((item) => (
          <Pressable
            key={item.href}
            style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
          >
            <View style={styles.shortcutIcon}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
            </View>
            <ThemedText variant="headline" style={styles.shortcutLabel}>
              {item.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {result && result.sugarSignals.length > 0 && (
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            혈당 주의 시그널
          </ThemedText>
          {result.sugarSignals.map((signal) => (
            <View key={signal.type} style={styles.signalRow}>
              <Ionicons name="warning" size={16} color={colors.warning} />
              <ThemedText variant="subhead" style={styles.signalText}>
                {signal.text}
              </ThemedText>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // 섹션 간격 lg — 행/그룹/섹션 계층 구분 (16-Everything 방지)
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
  hero: { backgroundColor: colors.primary, boxShadow: shadows.raised },
  onTintSoft: { color: colors.onTintSoft },
  shortcutGroup: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.sm,
    boxShadow: shadows.card,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  shortcutPressed: { backgroundColor: colors.primarySoft },
  shortcutLabel: { color: colors.text, textAlign: 'center' },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { marginBottom: spacing.sm },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  signalText: { flex: 1 },
});

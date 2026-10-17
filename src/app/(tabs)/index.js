// 홈 — 설문 기반 개인화 대시보드 (A)
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../../theme';
import Card from '../../components/Card';
import ThemedText from '../../components/ThemedText';
import { get, KEYS } from '../../lib/storage';
import { analyze } from '../../lib/analysis';

const SHORTCUTS = [
  { icon: 'water', label: '혈당 예측', href: '/predict' },
  { icon: 'restaurant', label: '식단 기록', href: '/food-log' },
  { icon: 'pie-chart', label: '식단 분석', href: '/food-analysis' },
  { icon: 'fitness', label: '운동 기록', href: '/exercise-log' },
];

export default function HomeScreen() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let mounted = true;
    get(KEYS.SURVEY_ANSWERS).then((answers) => {
      if (mounted && answers) setResult(analyze(answers));
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="largeTitle">오늘도 건강하게</ThemedText>

      {/* 앱의 핵심 가치(예상 혈당)를 최상단에 — TODO: BloodSugarChart 연결 */}
      <Card style={styles.hero}>
        <ThemedText variant="subhead" style={styles.onTintSoft}>
          예상 혈당
        </ThemedText>
        <ThemedText variant="hero">
          94{' '}
          <ThemedText variant="headline" style={styles.onTintSoft}>
            mg/dL
          </ThemedText>
        </ThemedText>
        <ThemedText variant="caption" style={styles.onTintSoft}>
          식단 기록 후 실제 예측값이 표시됩니다
        </ThemedText>
      </Card>

      {/* 2열 그리드 — gap 포함 균등 분할을 위한 예외값(48.5%) */}
      <View style={styles.grid}>
        {SHORTCUTS.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable
              style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
              accessibilityRole="button"
            >
              <View style={styles.shortcutIcon}>
                <Ionicons name={item.icon} size={22} color={colors.primary} />
              </View>
              <ThemedText variant="headline">{item.label}</ThemedText>
            </Pressable>
          </Link>
        ))}
      </View>

      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          오늘의 목표
        </ThemedText>
        {result ? (
          <ThemedText variant="body" style={styles.cardBody}>
            목표 칼로리 {result.targetCalories} kcal · 탄수화물 {result.carbTarget} g
          </ThemedText>
        ) : (
          <ThemedText variant="body" style={styles.cardBody}>
            설문을 완료하면 맞춤 목표가 표시됩니다.
          </ThemedText>
        )}
      </Card>

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

      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          맞춤 식단 추천
        </ThemedText>
        {/* TODO: rules.js 연결 */}
        <ThemedText variant="body" style={styles.cardBody}>
          현미밥 + 닭가슴살 + 브로콜리 — 혈당 부담이 낮은 구성이에요.
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // 섹션 간격 lg — 행/그룹/섹션 계층 구분 (16-Everything 방지)
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
  hero: { backgroundColor: colors.primary, boxShadow: shadows.raised },
  onTintSoft: { color: colors.onTintSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcut: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    boxShadow: shadows.card,
  },
  shortcutPressed: { backgroundColor: colors.primarySoft },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  signalText: { flex: 1 },
});

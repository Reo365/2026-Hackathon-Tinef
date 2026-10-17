// 홈 — 설문 기반 개인화 대시보드 (A)
import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, font } from '../../../theme';
import { get, KEYS } from '../../lib/storage';
import { analyze } from '../../lib/analysis';

const SHORTCUTS = [
  { emoji: '🩸', label: '혈당 예측', href: '/predict' },
  { emoji: '🍽️', label: '식단 기록', href: '/food-log' },
  { emoji: '📊', label: '식단 분석', href: '/food-analysis' },
  { emoji: '🏃', label: '운동 기록', href: '/exercise-log' },
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
      <Text style={styles.greeting}>오늘도 건강하게 👋</Text>

      {/* TODO: BloodSugarChart 연결 */}
      <View style={[styles.card, styles.hero]}>
        <Text style={styles.heroLabel}>예상 혈당</Text>
        <Text style={styles.heroValue}>
          94 <Text style={styles.heroUnit}>mg/dL</Text>
        </Text>
        <Text style={styles.heroSub}>식단 기록 후 실제 예측값이 표시됩니다</Text>
      </View>

      <View style={styles.grid}>
        {SHORTCUTS.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable style={styles.shortcut}>
              <Text style={styles.shortcutEmoji}>{item.emoji}</Text>
              <Text style={styles.shortcutLabel}>{item.label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘의 목표</Text>
        {result ? (
          <Text style={styles.cardBody}>
            목표 칼로리 {result.targetCalories} kcal · 탄수화물 {result.carbTarget} g
          </Text>
        ) : (
          <Text style={styles.cardBody}>설문을 완료하면 맞춤 목표가 표시됩니다.</Text>
        )}
      </View>

      {result && result.sugarSignals.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>혈당 주의 시그널</Text>
          {result.sugarSignals.map((signal) => (
            <Text key={signal.type} style={styles.signalText}>
              ⚠️ {signal.text}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>맞춤 식단 추천</Text>
        {/* TODO: rules.js 연결 */}
        <Text style={styles.cardBody}>
          현미밥 + 닭가슴살 + 브로콜리 — 혈당 부담이 낮은 구성이에요.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  greeting: { color: colors.text, fontSize: font.title, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  hero: { backgroundColor: colors.primary },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: font.sub },
  heroValue: { color: colors.card, fontSize: 40, fontWeight: '700', marginVertical: spacing.xs },
  heroUnit: { fontSize: font.body, fontWeight: '400' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.small },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcut: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  shortcutEmoji: { fontSize: 32, marginBottom: spacing.sm },
  shortcutLabel: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  cardTitle: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: spacing.sm },
  cardBody: { color: colors.sub, fontSize: font.body, lineHeight: 22 },
  signalText: { color: colors.sub, fontSize: font.sub, lineHeight: 20, marginTop: spacing.xs },
});

// 맞춤 건강 분석 — 설문 완료 직후 표시되는 개인 리포트 (계산값 + AI 특성 분석)
// AI 실패 시 룰 기반 시그널로 폴백
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import Skeleton from '../components/Skeleton';
import AnimatedSection from '../components/AnimatedSection';
import { analyze } from '../lib/analysis';
import { analyzeProfile } from '../lib/ai';
import { get, KEYS } from '../lib/storage';

export default function AnalysisResultScreen() {
  const [result, setResult] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileFailed, setProfileFailed] = useState(false);

  const loadProfile = async (answers, analysis) => {
    setProfileLoading(true);
    setProfileFailed(false);
    const p = await analyzeProfile(answers, analysis);
    setProfile(p);
    setProfileFailed(!p);
    setProfileLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const answers = await get(KEYS.SURVEY_ANSWERS);
      if (!mounted) return;
      if (!answers) {
        router.replace('/onboarding');
        return;
      }
      const analysis = analyze(answers);
      setResult({ answers, ...analysis });
      loadProfile(answers, analysis);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const start = () => router.replace('/(tabs)');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="largeTitle">맞춤 건강 분석</ThemedText>
      <ThemedText variant="body" style={styles.lead}>
        설문 데이터를 분석해 맞춤 결과를 정리했어요.
      </ThemedText>

      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            신체 지표
          </ThemedText>
          {result ? (
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <ThemedText variant="subhead">BMI</ThemedText>
                <ThemedText variant="title" style={styles.metricValue}>
                  {result.bmi ?? '-'}
                </ThemedText>
                <ThemedText variant="caption">{result.bmiLabel}</ThemedText>
              </View>
              <View style={styles.metric}>
                <ThemedText variant="subhead">기초대사량</ThemedText>
                <ThemedText variant="title" style={styles.metricValue}>
                  {result.bmr}
                </ThemedText>
                <ThemedText variant="caption">kcal</ThemedText>
              </View>
              <View style={styles.metric}>
                <ThemedText variant="subhead">하루 소비</ThemedText>
                <ThemedText variant="title" style={styles.metricValue}>
                  {result.tdee}
                </ThemedText>
                <ThemedText variant="caption">kcal</ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.skeletonStack}>
              <Skeleton width="100%" height={44} />
            </View>
          )}
        </Card>
      </AnimatedSection>

      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            오늘의 목표
          </ThemedText>
          {result ? (
            <ThemedText variant="body" style={styles.cardBody}>
              목표 칼로리 {result.targetCalories} kcal · 탄수화물 {result.carbTarget} g
              {'\n'}체중 목표 {result.answers.weightGoal} ({result.answers.goalPeriod})
            </ThemedText>
          ) : (
            <Skeleton width="80%" height={14} />
          )}
        </Card>
      </AnimatedSection>

      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            혈당 주의 시그널
          </ThemedText>
          {result && result.sugarSignals.length > 0 ? (
            result.sugarSignals.map((signal) => (
              <View key={signal.type} style={styles.signalRow}>
                <Ionicons name="warning" size={16} color={colors.warning} />
                <ThemedText variant="subhead" style={styles.signalText}>
                  {signal.text}
                </ThemedText>
              </View>
            ))
          ) : result ? (
            <ThemedText variant="body" style={styles.cardBody}>
              특별히 주의할 시그널이 없어요. 지금 습관을 유지해 보세요.
            </ThemedText>
          ) : (
            <Skeleton width="85%" height={14} />
          )}
        </Card>
      </AnimatedSection>

      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            AI 맞춤 분석
          </ThemedText>
          {profileLoading ? (
            <View style={styles.skeletonStack}>
              <Skeleton width="100%" height={14} />
              <Skeleton width="90%" height={14} />
              <Skeleton width="60%" height={14} />
            </View>
          ) : profile ? (
            <>
              {profile.summary ? (
                <ThemedText variant="body" style={styles.cardBody}>
                  {profile.summary}
                </ThemedText>
              ) : null}
              {profile.strengths.map((s, i) => (
                <View key={`s-${i}`} style={styles.signalRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <ThemedText variant="subhead" style={styles.signalText}>
                    {s}
                  </ThemedText>
                </View>
              ))}
              {profile.warnings.map((w, i) => (
                <View key={`w-${i}`} style={styles.signalRow}>
                  <Ionicons name="warning" size={16} color={colors.warning} />
                  <ThemedText variant="subhead" style={styles.signalText}>
                    {w}
                  </ThemedText>
                </View>
              ))}
            </>
          ) : (
            <>
              {/* AI 실패 폴백 — 룰 기반 시그널 요약 */}
              <ThemedText variant="body" style={styles.cardBody}>
                {result
                  ? result.sugarSignals.length > 0
                    ? `주의 시그널 ${result.sugarSignals.length}개가 있어요. 위 시그널을 확인해 주세요.`
                    : '설문 기반으로 보아 혈당 관리에 유리한 상태예요. 기록을 시작해 보세요.'
                  : '분석을 준비하고 있어요.'}
              </ThemedText>
              {profileFailed && (
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                  onPress={() => loadProfile(result?.answers, result)}
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                  <ThemedText variant="subhead" style={styles.secondaryButtonText}>
                    AI 분석 다시 시도
                  </ThemedText>
                </Pressable>
              )}
            </>
          )}
        </Card>
      </AnimatedSection>

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
        onPress={start}
        disabled={profileLoading}
        accessibilityRole="button"
      >
        <ThemedText variant="headline" style={styles.primaryButtonText}>
          홈에서 시작하기
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lead: { color: colors.sub, marginTop: -spacing.md },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  metricRow: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, alignItems: 'center', gap: spacing.xs },
  metricValue: { color: colors.text },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  signalText: { flex: 1 },
  skeletonStack: { gap: spacing.sm },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
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
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  buttonPressed: { opacity: 0.7 },
  primaryButtonText: { color: colors.onTint },
  secondaryButtonText: { color: colors.primary, fontWeight: '600' },
});

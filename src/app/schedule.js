// 스케줄 계획 — 기상·취침/내 계획 설정 + AI 혈당 관리 가이드 (시간별 조언)
// 타임라인에는 사용자가 입력한 계획만 표시되고, 가이드 카드에 식사·혈당 상승·저강 타이밍 조언이 표시됨
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import Skeleton from '../components/Skeleton';
import AnimatedSection from '../components/AnimatedSection';
import TimePickerField from '../components/TimePickerField';
import { generateRoutinePlan } from '../lib/ai';
import { get, set, KEYS } from '../lib/storage';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ScheduleScreen() {
  const [settings, setSettings] = useState({
    wakeTime: null,
    bedTime: null,
    customPlans: [],
    advice: null,
  });
  const [answers, setAnswers] = useState(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planTime, setPlanTime] = useState('');
  const [planError, setPlanError] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceFailed, setAdviceFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [stored, a] = await Promise.all([get(KEYS.ROUTINE_SETTINGS), get(KEYS.SURVEY_ANSWERS)]);
      if (!mounted) return;
      if (stored) {
        setSettings({
          wakeTime: stored.wakeTime || null,
          bedTime: stored.bedTime || null,
          customPlans: Array.isArray(stored.customPlans) ? stored.customPlans : [],
          advice: stored.advice || null,
        });
      }
      setAnswers(a);
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = async (next) => {
    await set(KEYS.ROUTINE_SETTINGS, next);
  };

  const updateSettings = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    persist(next);
  };

  const addCustomPlan = () => {
    const title = planTitle.trim();
    const time = planTime.trim();
    if (!title || !TIME_RE.test(time)) {
      setPlanError('계획명과 시간(HH:MM 형식)을 모두 입력해 주세요.');
      return;
    }
    setPlanError(null);
    setPlanTitle('');
    setPlanTime('');
    updateSettings('customPlans', [
      ...settings.customPlans,
      { id: String(Date.now()), title, time },
    ]);
  };

  const removeCustomPlan = (id) => {
    updateSettings('customPlans', settings.customPlans.filter((p) => p.id !== id));
  };

  const generateAdvice = async () => {
    setAdviceLoading(true);
    setAdviceFailed(false);
    // 복구된 generateRoutinePlan — 전체 스케줄을 가이드 행(시간 + 제목/설명)으로 표시
    const result = await generateRoutinePlan({
      // 미설정 시 룰 기본값으로 전달
      wakeTime: settings.wakeTime || '07:00',
      bedTime: settings.bedTime || '23:00',
      customPlans: settings.customPlans,
      surveyAnswers: answers,
    });
    setAdviceLoading(false);
    if (result) {
      updateSettings('advice', {
        items: result.schedule.map((s) => ({
          time: s.time,
          text: `${s.title}${s.desc ? ' — ' + s.desc : ''}`,
        })),
        createdAt: new Date().toISOString(),
      });
    } else {
      setAdviceFailed(true);
    }
  };

  const sortedPlans = [...settings.customPlans].sort((a, b) => a.time.localeCompare(b.time));
  const adviceItems = settings.advice?.items || [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="subhead" style={styles.lead}>
        기상·취침과 내 계획을 정하면 AI가 혈당 스파이크 없이 하루를 보낼 수 있는 가이드를 만들어 드려요
      </ThemedText>

      <Card>
        <TimePickerField
          label="기상 시간"
          value={settings.wakeTime}
          onChange={(v) => updateSettings('wakeTime', v)}
        />
        <TimePickerField
          label="취침 시간"
          value={settings.bedTime}
          onChange={(v) => updateSettings('bedTime', v)}
        />
      </Card>

      {/* 내 계획 — 사용자가 입력한 계획만 스케줄 형식으로 표시 */}
      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            내 계획
          </ThemedText>
          {sortedPlans.length === 0 ? (
            <ThemedText variant="subhead" style={styles.emptyText}>
              아래 입력란에 계획을 추가해 주세요.
            </ThemedText>
          ) : (
            sortedPlans.map((p) => (
              <View key={p.id} style={styles.customRow}>
                <ThemedText variant="subhead" style={styles.customTime}>
                  {p.time}
                </ThemedText>
                <ThemedText variant="body" style={styles.customTitle}>
                  {p.title}
                </ThemedText>
                <Pressable
                  onPress={() => removeCustomPlan(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.title} 계획 삭제`}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.timeInput}
              placeholder="14:30"
              placeholderTextColor={colors.sub}
              value={planTime}
              onChangeText={setPlanTime}
              accessibilityLabel="계획 시간"
            />
            <TextInput
              style={styles.titleInput}
              placeholder="계획명 (예: 약 복용)"
              placeholderTextColor={colors.sub}
              value={planTitle}
              onChangeText={setPlanTitle}
              accessibilityLabel="계획 이름"
            />
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              onPress={addCustomPlan}
              accessibilityRole="button"
              accessibilityLabel="계획 추가"
            >
              <Ionicons name="add" size={16} color={colors.onTint} />
            </Pressable>
          </View>
          {planError && (
            <ThemedText variant="caption" style={styles.errorText}>
              {planError}
            </ThemedText>
          )}
        </Card>
      </AnimatedSection>

      {/* 혈당 관리 가이드 — AI 생성 시간별 조언 (총평 대체) */}
      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            혈당 관리 가이드
          </ThemedText>
          {adviceLoading ? (
            <View style={styles.skeletonStack}>
              <Skeleton width="100%" height={14} />
              <Skeleton width="88%" height={14} />
              <Skeleton width="70%" height={14} />
            </View>
          ) : adviceItems.length > 0 ? (
            <>
              {adviceItems.map((a, i) => (
                <View key={`${a.time}-${i}`} style={styles.adviceRow}>
                  <ThemedText variant="subhead" style={styles.adviceTime}>
                    {a.time}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.adviceText}>
                    {a.text}
                  </ThemedText>
                </View>
              ))}
              <Pressable
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
                onPress={generateAdvice}
                accessibilityRole="button"
                accessibilityLabel="가이드 다시 만들기"
              >
                <Ionicons name="refresh" size={14} color={colors.primary} />
                <ThemedText variant="caption" style={styles.textButtonText}>
                  가이드 다시 만들기
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText variant="body" style={styles.cardBody}>
                {adviceFailed
                  ? '가이드 생성에 실패했어요. 다시 시도해 주세요.'
                  : 'AI가 계획에 맞춰 식사·혈당 상승·운동 타이밍을 만들어 드릴게요.'}
              </ThemedText>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={generateAdvice}
                disabled={!loaded || adviceLoading}
                accessibilityRole="button"
              >
                <Ionicons name="sparkles" size={16} color={colors.onTint} />
                <ThemedText variant="headline" style={styles.primaryButtonText}>
                  {adviceFailed ? '다시 시도' : 'AI 가이드 만들기'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </Card>
      </AnimatedSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lead: { color: colors.sub, lineHeight: 22 },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  customTime: { color: colors.primary, fontWeight: '700', width: 46 },
  customTitle: { color: colors.text, flex: 1 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  timeInput: {
    width: 76,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: type.body.fontSize,
  },
  titleInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: type.body.fontSize,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: colors.danger, marginTop: spacing.xs },
  emptyText: { color: colors.sub },
  adviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  adviceTime: { color: colors.primary, fontWeight: '700', width: 46 },
  adviceText: { color: colors.sub, flex: 1, lineHeight: 22 },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  textButtonText: { color: colors.primary, fontWeight: '600' },
  skeletonStack: { gap: spacing.sm },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  primaryButtonText: { color: colors.onTint },
});

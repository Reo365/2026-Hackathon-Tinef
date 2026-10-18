// 루틴 계획 — 기상·취침 설정 + 사용자 직접 계획 추가 → AI 맞춤 하루 시간표
// 기본 룰 타임라인(lib/routine.js)은 즉시 미리보기용, "AI로 루틴 만들기"가 개인화 시간표를 생성·저장
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import Skeleton from '../components/Skeleton';
import AnimatedSection from '../components/AnimatedSection';
import { buildRoutine, timeToMinutes } from '../lib/routine';
import { generateRoutinePlan } from '../lib/ai';
import TimePickerField from '../components/TimePickerField';
import { get, set, KEYS } from '../lib/storage';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const TYPE_META = {
  wake: { icon: 'sunny-outline', color: colors.accent },
  meal: { icon: 'restaurant', color: colors.primary },
  glucose: { icon: 'water', color: colors.warning },
  exercise: { icon: 'fitness', color: colors.success },
  snack: { icon: 'fast-food-outline', color: colors.accent },
  sleep: { icon: 'bed-outline', color: colors.accent },
  custom: { icon: 'calendar-outline', color: colors.text },
};

export default function ScheduleScreen() {
  const [settings, setSettings] = useState({
    wakeTime: null,
    bedTime: null,
    customPlans: [],
    aiPlan: null,
  });
  const [answers, setAnswers] = useState(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planTime, setPlanTime] = useState('');
  const [planError, setPlanError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [saved, setSaved] = useState(false);
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
          aiPlan: stored.aiPlan || null,
        });
      }
      setAnswers(a);
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 기본 룰 타임라인 — 즉시 미리보기 + AI 프롬프트 참고용
  const routine = buildRoutine({ wakeTime: settings.wakeTime, bedTime: settings.bedTime }, answers);

  const persist = async (next) => {
    const ok = await set(KEYS.ROUTINE_SETTINGS, next);
    if (ok) setSaved(true);
  };

  const updateSettings = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
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

  const generateAI = async () => {
    setAiLoading(true);
    setAiFailed(false);
    const plan = await generateRoutinePlan({
      // 미설정 시 룰 기본값(07:00/23:00)으로 AI에 전달
      wakeTime: settings.wakeTime || '07:00',
      bedTime: settings.bedTime || '23:00',
      customPlans: settings.customPlans,
      surveyAnswers: answers,
      baseline: routine.schedule,
    });
    setAiLoading(false);
    if (plan) {
      const next = {
        ...settings,
        aiPlan: { ...plan, createdAt: new Date().toISOString() },
      };
      setSettings(next);
      persist(next);
    } else {
      setAiFailed(true);
    }
  };

  const displaySchedule = settings.aiPlan ? settings.aiPlan.schedule : routine.schedule;
  const comment = settings.aiPlan ? settings.aiPlan.comment : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ThemedText variant="subhead" style={styles.lead}>
        기상·취침과 내 계획을 정하면 AI가 혈당 관리에 맞춘 하루 루틴을 만들어 드려요
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
        <ThemedText variant="caption" style={styles.hint}>
          식사 시간은 룰로 자동 계산돼요 (아침 기상+30분 · 점심 · 저녁 취침 3시간 전)
        </ThemedText>
      </Card>

      {/* 사용자 직접 계획 추가 */}
      <AnimatedSection>
        <Card>
          <ThemedText variant="headline" style={styles.cardTitle}>
            내 계획 추가
          </ThemedText>
          {settings.customPlans.map((p) => (
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
          ))}
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

      {saved && (
        <AnimatedSection>
          <Card style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <ThemedText variant="subhead" style={styles.successText}>
              루틴을 저장했어요
            </ThemedText>
          </Card>
        </AnimatedSection>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (aiLoading || !loaded) && styles.disabledButton,
          pressed && styles.pressed,
        ]}
        onPress={generateAI}
        disabled={aiLoading || !loaded}
        accessibilityRole="button"
      >
        <Ionicons name="sparkles" size={16} color={colors.onTint} />
        <ThemedText variant="headline" style={styles.primaryButtonText}>
          {aiLoading ? '루틴 생성 중...' : settings.aiPlan ? 'AI 루틴 다시 만들기' : 'AI로 루틴 만들기'}
        </ThemedText>
      </Pressable>

      {/* 타임라인 — AI 생성 계획 우선, 없으면 룰 기본안 */}
      <AnimatedSection>
        <Card>
          <View style={styles.cardHeaderRow}>
            <ThemedText variant="headline" style={styles.cardTitle}>
              {aiLoading ? 'AI 맞춤 루틴' : settings.aiPlan ? 'AI 맞춤 루틴' : '기본 루틴 (룰 기준)'}
            </ThemedText>
            {settings.aiPlan && !aiLoading && (
              <ThemedText variant="caption">AI 생성</ThemedText>
            )}
          </View>
          {aiLoading ? (
            <View style={styles.skeletonStack}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={`sk-${i}`} style={styles.timelineRow}>
                  <Skeleton width={46} height={14} />
                  <Skeleton width={20} height={16} />
                  <View style={styles.skeletonFlex}>
                    <Skeleton width="70%" height={14} />
                    <Skeleton width="45%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            displaySchedule.map((item, i) => {
              const meta = TYPE_META[item.type] || TYPE_META.custom;
              return (
                <View key={`${item.time}-${item.type}-${i}`} style={styles.timelineRow}>
                  <ThemedText variant="subhead" style={styles.timelineTime}>
                    {item.time}
                  </ThemedText>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                  <View style={styles.timelineBody}>
                    <ThemedText variant="body" style={styles.timelineTitle}>
                      {item.title}
                    </ThemedText>
                    {item.desc ? <ThemedText variant="caption">{item.desc}</ThemedText> : null}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </AnimatedSection>

      {aiFailed && !aiLoading && (
        <AnimatedSection>
          <Card>
            <ThemedText variant="body" style={styles.cardBody}>
              루틴 생성에 실패했어요. 잠시 후 다시 시도해 주세요.
            </ThemedText>
            <ThemedText variant="caption" style={styles.hint}>
              그동안은 위 기본 루틴을 참고할 수 있어요.
            </ThemedText>
          </Card>
        </AnimatedSection>
      )}

      {comment && !aiLoading && (
        <AnimatedSection>
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              AI 루틴 총평
            </ThemedText>
            <ThemedText variant="body" style={styles.cardBody}>
              {comment}
            </ThemedText>
          </Card>
        </AnimatedSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lead: { color: colors.sub, lineHeight: 22 },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipBlock: { marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  chipText: { color: colors.sub },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  hint: { color: colors.sub, marginTop: spacing.sm },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  customTime: { color: colors.primary, fontWeight: '700', width: 46 },
  customTitle: { color: colors.text, flex: 1 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
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
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  timelineTime: { color: colors.text, fontWeight: '700', width: 46 },
  timelineBody: { flex: 1 },
  timelineTitle: { color: colors.text },
  skeletonStack: { gap: spacing.sm },
  skeletonFlex: { flex: 1, gap: spacing.xs },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
  disabledButton: { opacity: 0.4 },
  primaryButtonText: { color: colors.onTint },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
  },
  successText: { color: colors.text, flex: 1 },
});

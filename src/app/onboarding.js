// 설문 3단계 — 한 화면에서 step 상태로 관리 (DEVLOG 결정 7, 활동수준·스트레스·목표 질문 제거)
// 설정의 "프로필 수정"으로 재진입 시 기존 답변을 불러와 채워줌(편집 모드)
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing, type } from '../../theme';
import ThemedText from '../components/ThemedText';
import { get, KEYS, saveOnboarding } from '../lib/storage';
import { deriveCarbSensitivity } from '../lib/analysis';

const STEPS = [
  { title: '기본 정보', intro: '나이·성별·신체 정보로 하루 필요 칼로리를 계산해요', questions: [
    { key: 'age', label: '나이', type: 'input', placeholder: '예: 25' },
    { key: 'gender', label: '성별', type: 'choice', options: ['남', '여'] },
    { key: 'height', label: '키 (cm)', type: 'input', placeholder: '예: 170' },
    { key: 'weight', label: '몸무게 (kg)', type: 'input', placeholder: '예: 65' },
  ]},
  { title: '생활 습관', intro: '수면 습관은 혈당 조절에 큰 영향을 줘요', questions: [
    { key: 'exercise', label: '운동 빈도', type: 'choice', options: ['거의 안 함', '주 1-2회', '주 3-4회', '주 5회 이상'] },
    { key: 'sleep', label: '평소 수면 시간', type: 'choice', options: ['4시간 이하', '5시간', '6시간', '7시간', '8시간 이상'] },
  ]},
  { title: '식이 패턴', intro: '식사 후 몸의 반응으로 혈당 민감도를 파악해요', questions: [
    { key: 'mealReactions', label: '식사 후 반응', type: 'choice', options: ['특별히 없음', '나른함/졸림', '어지러움', '소화 불량'] },
  ]},
];

// 저장된 수면 값(숫자) → 칩 라벨 매핑 (예: 7 → '7시간', 3 → '4시간 이하')
function sleepLabel(n) {
  const h = Number(n);
  if (!h) return undefined;
  if (h <= 4) return '4시간 이하';
  if (h >= 8) return '8시간 이상';
  return `${h}시간`;
}

// 이전 설문에서는 물어봤지만 지금은 삭제된 항목 — 편집 시 잔존값 제거
const STALE_KEYS = ['activity', 'stress', 'weightGoal', 'goalPeriod', 'familyHistory'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showHint, setShowHint] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // 기존 답변이 있으면 채워서 시작 (설정 → 프로필 수정)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await get(KEYS.SURVEY_ANSWERS);
      if (!mounted || !saved) return;
      const clean = {};
      for (const [key, value] of Object.entries(saved)) {
        if (!STALE_KEYS.includes(key)) clean[key] = value;
      }
      if (clean.sleep != null) clean.sleep = sleepLabel(clean.sleep) || clean.sleep;
      setAnswers((prev) => ({ ...clean, ...prev }));
      setEditMode(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const setValue = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const isStepComplete = () =>
    current.questions.every((q) => {
      const v = answers[q.key];
      return v !== undefined && String(v).trim() !== '';
    });

  const finish = async () => {
    // 수면 칩 값("7시간" 등)에서 숫자만 추출
    const sleepHours = Number((String(answers.sleep || '').match(/\d+/) || [0])[0]) || 0;
    const cleaned = {
      ...answers,
      age: Number(answers.age) || 0,
      height: Number(answers.height) || 0,
      weight: Number(answers.weight) || 0,
      sleep: sleepHours,
    };
    for (const key of STALE_KEYS) delete cleaned[key];
    // 탄수화물 민감도 질문 제거 — 예전에 직접 응답한 값이 있으면 존중, 없으면 식사 후 반응 등에서 유도
    cleaned.carbSensitivity = cleaned.carbSensitivity || deriveCarbSensitivity(cleaned);
    await saveOnboarding(cleaned);
    // 편집 진입(설정→프로필 수정)이면 설정으로 복귀, 첫 설문이면 홈으로 진입
    if (editMode) router.back();
    else router.replace('/(tabs)');
  };

  const goNext = () => {
    if (!isStepComplete()) {
      setShowHint(true);
      return;
    }
    setShowHint(false);
    if (isLast) finish();
    else setStep(step + 1);
  };

  return (
    <View style={styles.container}>
      <ThemedText variant="caption">
        설문 {step + 1}/{STEPS.length} · {current.title}
      </ThemedText>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]}
        />
      </View>

      <ScrollView style={styles.questionArea} contentContainerStyle={styles.questionContent}>
        <ThemedText variant="title">{current.title}</ThemedText>
        <ThemedText variant="subhead">{current.intro}</ThemedText>
        {current.questions.map((q) => (
          <View key={q.key} style={styles.questionBlock}>
            <ThemedText variant="headline" style={styles.questionLabel}>
              {q.label}
            </ThemedText>
            {q.type === 'input' ? (
              <TextInput
                style={styles.input}
                placeholder={q.placeholder || '직접 입력'}
                placeholderTextColor={colors.sub}
                keyboardType="numeric"
                value={answers[q.key] ? String(answers[q.key]) : ''}
                onChangeText={(text) => setValue(q.key, text)}
              />
            ) : (
              <View style={styles.chipRow}>
                {q.options.map((opt) => {
                  const selected = answers[q.key] === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setValue(q.key, opt)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <ThemedText variant="body" style={selected ? styles.chipTextSelected : styles.chipText}>
                        {opt}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ))}
        {showHint && (
          <ThemedText variant="subhead" style={styles.hint}>
            모든 항목을 입력/선택해 주세요.
          </ThemedText>
        )}
      </ScrollView>

      <View style={styles.buttonRow}>
        {step > 0 && (
          <Pressable
            style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.buttonPressed]}
            onPress={() => {
              setShowHint(false);
              setStep(step - 1);
            }}
            accessibilityRole="button"
          >
            <ThemedText variant="headline" style={styles.buttonSecondaryText}>
              이전
            </ThemedText>
          </Pressable>
        )}
        {step === 0 && editMode && (
          <Pressable
            style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.buttonPressed]}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <ThemedText variant="headline" style={styles.buttonSecondaryText}>
              취소
            </ThemedText>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.buttonPressed]}
          onPress={goNext}
          accessibilityRole="button"
        >
          <ThemedText variant="headline" style={styles.buttonPrimaryText}>
            {isLast ? '설문 완료' : '다음'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  questionArea: { flex: 1, marginTop: spacing.lg },
  questionContent: { gap: spacing.lg, paddingBottom: spacing.xl },
  questionLabel: { marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: type.body.fontSize, // 입력 커서가 본문 크기와 정렬되도록
  },
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
  chipPressed: { opacity: 0.7 },
  chipText: { color: colors.sub },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  hint: { color: colors.danger },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.lg },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  buttonPressed: { opacity: 0.7 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.onTint },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonSecondaryText: { color: colors.sub },
});

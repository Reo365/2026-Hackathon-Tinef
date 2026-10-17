// 설문 4단계 — 한 화면에서 step 상태로 관리 (DEVLOG 결정 7)
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing, font } from '../../theme';
import { saveOnboarding } from '../lib/storage';

const STEPS = [
  { title: '기본 정보', questions: [
    { key: 'age', label: '나이', type: 'input', placeholder: '예: 25' },
    { key: 'gender', label: '성별', type: 'choice', options: ['남', '여'] },
    { key: 'height', label: '키 (cm)', type: 'input', placeholder: '예: 170' },
    { key: 'weight', label: '몸무게 (kg)', type: 'input', placeholder: '예: 65' },
    { key: 'activity', label: '활동 수준', type: 'choice', options: ['낮음', '보통', '높음', '매우높음'] },
  ]},
  { title: '생활 습관', questions: [
    { key: 'exercise', label: '운동 빈도', type: 'choice', options: ['거의 안 함', '주 1-2회', '주 3-4회', '주 5회 이상'] },
    { key: 'sleep', label: '수면 시간 (시간)', type: 'input', placeholder: '예: 7' },
    { key: 'stress', label: '스트레스 수준', type: 'choice', options: ['낮음', '보통', '높음'] },
  ]},
  { title: '식이 패턴', questions: [
    { key: 'mealReactions', label: '식사 후 반응', type: 'choice', options: ['특별히 없음', '나른함/졸림', '어지러움', '소화 불량'] },
    { key: 'carbSensitivity', label: '탄수화물 민감도', type: 'choice', options: ['낮음', '보통', '높음'] },
    { key: 'familyHistory', label: '가족력 여부', type: 'choice', options: ['없음', '있음'] },
  ]},
  { title: '목표', questions: [
    { key: 'weightGoal', label: '체중 목표', type: 'choice', options: ['감량', '유지', '증량'] },
    { key: 'goalPeriod', label: '목표 기간', type: 'choice', options: ['1개월', '3개월', '6개월', '1년'] },
  ]},
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showHint, setShowHint] = useState(false);

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
    const cleaned = {
      ...answers,
      age: Number(answers.age) || 0,
      height: Number(answers.height) || 0,
      weight: Number(answers.weight) || 0,
      sleep: Number(answers.sleep) || 0,
      familyHistory: answers.familyHistory === '있음',
    };
    await saveOnboarding(cleaned);
    router.replace('/(tabs)');
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
      <Text style={styles.progressLabel}>
        설문 {step + 1}/{STEPS.length} · {current.title}
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]}
        />
      </View>

      <ScrollView style={styles.questionArea} contentContainerStyle={styles.questionContent}>
        {current.questions.map((q) => (
          <View key={q.key} style={styles.questionBlock}>
            <Text style={styles.questionLabel}>{q.label}</Text>
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
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ))}
        {showHint && <Text style={styles.hint}>모든 항목을 입력/선택해 주세요.</Text>}
      </ScrollView>

      <View style={styles.buttonRow}>
        {step > 0 && (
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => {
              setShowHint(false);
              setStep(step - 1);
            }}
          >
            <Text style={styles.buttonSecondaryText}>이전</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={goNext}>
          <Text style={styles.buttonPrimaryText}>{isLast ? '설문 완료' : '다음'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  progressLabel: { color: colors.sub, fontSize: font.sub, marginBottom: spacing.sm },
  progressTrack: { height: 8, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  questionArea: { flex: 1, marginTop: spacing.lg },
  questionContent: { paddingBottom: spacing.xl },
  questionBlock: { marginBottom: spacing.lg },
  questionLabel: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.body,
    color: colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.sub, fontSize: font.body },
  chipTextSelected: { color: colors.primary, fontWeight: '700' },
  hint: { color: colors.danger, fontSize: font.sub, marginTop: spacing.xs },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.lg },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.card, fontSize: font.body, fontWeight: '700' },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonSecondaryText: { color: colors.sub, fontSize: font.body, fontWeight: '700' },
});

// 설정 — 저장된 설문 기반 프로필 표시 + "프로필 수정" + 테스트용 앱 초기화
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '../../../theme';
import Card from '../../components/Card';
import ThemedText from '../../components/ThemedText';
import { get, remove, KEYS } from '../../lib/storage';

export default function SettingsScreen() {
  const [profile, setProfile] = useState(null);
  // 초기화 2단계 확인 — 첫 탭에만 확인 상태, 다시 탭하면 실행 (파괴적 동작 실수 방지)
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const answers = await get(KEYS.SURVEY_ANSWERS);
      if (mounted && answers) setProfile(answers);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 앱 초기화 — KEYS의 모든 저장 데이터(설문·기록·설정) 삭제 후 온보딩부터 재시작
  const resetApp = async () => {
    if (resetting) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setResetting(true);
    await Promise.all(Object.values(KEYS).map((key) => remove(key)));
    setProfile(null);
    setConfirming(false);
    setResetting(false);
    router.replace('/onboarding');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          프로필
        </ThemedText>
        <ThemedText variant="body" style={styles.cardBody}>
          {profile
            ? `${profile.age}세 · ${profile.gender} · ${profile.height}cm · ${profile.weight}kg`
            : '사용자 · 정보 미설정'}
        </ThemedText>
        <Pressable
          onPress={() => router.push('/onboarding')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.editButton, pressed && styles.pressedState]}
        >
          <Ionicons name="create-outline" size={16} color={colors.primaryDeep} />
          <ThemedText variant="subhead" style={styles.editText}>
            프로필 수정
          </ThemedText>
        </Pressable>
      </Card>

      {/* 테스트용 — 앱 초기화 */}
      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          테스트
        </ThemedText>
        <ThemedText variant="subhead" style={styles.cardBody}>
          설문·기록 등 앱의 저장 데이터를 모두 지우고 초기 화면부터 다시 시작해요.
        </ThemedText>
        <Pressable
          onPress={resetApp}
          disabled={resetting}
          accessibilityRole="button"
          accessibilityLabel={confirming ? '초기화 실행' : '앱 초기화'}
          style={({ pressed }) => [
            styles.resetButton,
            confirming && styles.resetButtonConfirm,
            pressed && styles.pressedState,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={16}
            color={confirming ? colors.onTint : colors.danger}
          />
          <ThemedText
            variant="subhead"
            style={confirming ? styles.resetTextConfirm : styles.resetText}
          >
            {resetting ? '초기화 중...' : confirming ? '다시 탭하면 초기화돼요' : '앱 초기화'}
          </ThemedText>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl + spacing.lg },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  editText: { color: colors.primaryDeep, fontWeight: '600' },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  resetButtonConfirm: { backgroundColor: colors.danger, borderColor: colors.danger },
  resetText: { color: colors.danger, fontWeight: '600' },
  resetTextConfirm: { color: colors.onTint, fontWeight: '600' },
  pressedState: { opacity: 0.7 },
});

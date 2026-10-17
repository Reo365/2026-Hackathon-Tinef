// 설정 — 프로필/목표 더미 + "설문 다시 하기" 데모 리셋 (A 뼈대, 테스트 체크리스트 필수)
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '../../../theme';
import Card from '../../components/Card';
import ThemedText from '../../components/ThemedText';
import { resetOnboarding } from '../../lib/storage';

export default function SettingsScreen() {
  // TODO: 설문 데이터 연결 (내용 단계 — get(KEYS.SURVEY_ANSWERS))
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    await resetOnboarding();
    router.replace('/onboarding');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          프로필
        </ThemedText>
        <ThemedText variant="body" style={styles.cardBody}>
          사용자 · 정보 미설정
        </ThemedText>
      </Card>

      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          건강 목표
        </ThemedText>
        <ThemedText variant="body" style={styles.cardBody}>
          설문 완료 후 목표가 표시됩니다.
        </ThemedText>
      </Card>

      <Pressable
        onPress={handleReset}
        disabled={resetting}
        accessibilityRole="button"
        style={({ pressed }) => [styles.resetButton, (pressed || resetting) && styles.resetPressed]}
      >
        <Ionicons name="refresh" size={18} color={colors.danger} />
        <ThemedText variant="body" style={styles.resetText}>
          {resetting ? '초기화 중...' : '설문 다시 하기 (데모 리셋)'}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
  resetPressed: { opacity: 0.7 },
  resetText: { color: colors.danger, fontWeight: '600' },
});

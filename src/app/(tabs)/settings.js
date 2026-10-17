// 설정 — 프로필/목표 더미 + "설문 다시 하기" 데모 리셋 (A 뼈대, 테스트 체크리스트 필수)
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing, font } from '../../../theme';
import { resetOnboarding } from '../../lib/storage';

export default function SettingsScreen() {
  // TODO: 설문 데이터 연결 (내용 단계 — get(KEYS.SURVEY_ANSWERS))
  const handleReset = async () => {
    await resetOnboarding();
    router.replace('/onboarding');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>프로필</Text>
        <Text style={styles.cardBody}>사용자 · 정보 미설정</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>건강 목표</Text>
        <Text style={styles.cardBody}>설문 완료 후 목표가 표시됩니다.</Text>
      </View>

      <Pressable style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetButtonText}>설문 다시 하기 (데모 리셋)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: spacing.sm },
  cardBody: { color: colors.sub, fontSize: font.body, lineHeight: 22 },
  resetButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  resetButtonText: { color: colors.danger, fontSize: font.body, fontWeight: '700' },
});

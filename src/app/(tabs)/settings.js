// 설정 — 저장된 설문 기반 프로필 표시 + "프로필 수정"
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '../../../theme';
import Card from '../../components/Card';
import ThemedText from '../../components/ThemedText';
import { get, KEYS } from '../../lib/storage';

export default function SettingsScreen() {
  const [profile, setProfile] = useState(null);

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
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <ThemedText variant="subhead" style={styles.editText}>
            프로필 수정
          </ThemedText>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
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
  editText: { color: colors.primary, fontWeight: '600' },
  pressedState: { opacity: 0.7 },
});

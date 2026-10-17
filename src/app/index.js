// 🚪 게이트 — 모든 진입 분기는 이 파일 한 곳에서만 (AGENTS.md 결정 6)
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, spacing } from '../../theme';
import { get, KEYS } from '../lib/storage';

export default function Gate() {
  const [done, setDone] = useState(null);

  useEffect(() => {
    let mounted = true;
    get(KEYS.ONBOARDING_DONE).then((value) => {
      if (mounted) setDone(!!value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (done === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          gap: spacing.md,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return done ? <Redirect href="/(tabs)" /> : <Redirect href="/onboarding" />;
}

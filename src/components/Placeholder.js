// 공용 placeholder 화면 — 아이콘 원형 배지 + 타이틀/설명
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';
import ThemedText from './ThemedText';

export default function Placeholder({ icon = 'sparkles-outline', title, description }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={colors.primaryDeep} />
      </View>
      <ThemedText variant="title" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText variant="body" style={styles.description}>
        {description}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { marginBottom: spacing.sm, textAlign: 'center' },
  description: { textAlign: 'center' },
});

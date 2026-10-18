// 혈당 수준 배지 — 완만/다소 높음/스파이크 프레임 (당뇨 진단 기준 아님; predict-result·food-analysis·홈 공용)
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';
import ThemedText from './ThemedText';

const LEVELS = {
  ok: { icon: 'checkmark-circle', color: colors.success, bg: colors.successSoft, label: '완만해요!' },
  warn: { icon: 'alert-circle', color: colors.warning, bg: colors.warningSoft, label: '다소 높아요' },
  danger: { icon: 'alert-circle', color: colors.danger, bg: colors.primarySoft, label: '스파이크 주의' },
};

// level: 'ok' | 'warn' | 'danger' (rules.glucoseLevel 기준), label로 문구 대체 가능
export default function StatusBadge({ level = 'ok', label }) {
  const cfg = LEVELS[level] || LEVELS.ok;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]} accessibilityLabel={label || cfg.label}>
      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
      <ThemedText variant="caption" style={[styles.text, { color: cfg.color }]}>
        {label || cfg.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  text: { fontWeight: '700' },
});

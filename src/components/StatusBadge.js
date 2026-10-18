// 혈당 수준 배지 — 정상/주의/경고 표준화 (predict-result·food-analysis·홈 공용)
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';
import ThemedText from './ThemedText';

const LEVELS = {
  ok: { icon: 'checkmark-circle', color: colors.success, bg: colors.successSoft, label: '정상 범위예요!' },
  warn: { icon: 'alert-circle', color: colors.warning, bg: colors.warningSoft, label: '주의 구간이에요' },
  danger: { icon: 'alert-circle', color: colors.danger, bg: colors.primarySoft, label: '경고 구간이에요' },
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

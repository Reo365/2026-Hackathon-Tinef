// 음식 검색 결과 행 — 이름·서빙·선택 delta 표시 + 우측 액션 버튼 (predict·food-log 공용)
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';
import ThemedText from './ThemedText';

// 항목별 혈당 상승량 색 — 낮음(초록)/중간(주황)/높음(빨강)
export function deltaColor(delta) {
  if (delta >= 20) return colors.danger;
  if (delta >= 10) return colors.warning;
  return colors.success;
}

export default function FoodRow({ name, serving, delta, onPress, actionIcon = 'add', actionLabel, disabled }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={actionLabel || `${name} 추가`}
    >
      <View style={styles.left}>
        <ThemedText variant="body" style={styles.name}>
          {name}
        </ThemedText>
        {serving ? <ThemedText variant="caption">{serving}</ThemedText> : null}
      </View>
      {delta !== undefined && delta !== null && (
        <ThemedText variant="subhead" style={[styles.delta, { color: deltaColor(delta) }]}>
          +{delta} mg/dL
        </ThemedText>
      )}
      {onPress && (
        <View style={styles.action}>
          <Ionicons name={actionIcon} size={16} color={colors.onTint} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.7 },
  left: { flex: 1 },
  name: { color: colors.text },
  delta: { fontWeight: '600' },
  action: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// 식사 시간 4타일 — predict·food-log 공용
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';
import ThemedText from './ThemedText';

const OPTIONS = [
  { value: '아침', icon: 'sunny-outline' },
  { value: '점심', icon: 'restaurant-outline' },
  { value: '저녁', icon: 'moon-outline' },
  { value: '간식', icon: 'cafe-outline' },
];

export default function TimeTiles({ value, onChange }) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.tile,
              selected && styles.tileSelected,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={opt.icon} size={20} color={selected ? colors.primary : colors.sub} />
            <ThemedText variant="caption" style={selected ? styles.tileTextSelected : styles.tileText}>
              {opt.value}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.sm + 2,
  },
  tileSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  tileText: { color: colors.sub },
  tileTextSelected: { color: colors.primary, fontWeight: '600' },
});

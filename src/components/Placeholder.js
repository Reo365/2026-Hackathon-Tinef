// 공용 placeholder 화면 — 뼈대 단계 스택 화면용 (내용 단계에서 각 화면이 대체)
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, font } from '../../theme';

export default function Placeholder({ emoji, title, description }) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
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
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: font.title, fontWeight: '700', marginBottom: spacing.sm },
  description: { color: colors.sub, fontSize: font.body, textAlign: 'center', lineHeight: 22 },
});

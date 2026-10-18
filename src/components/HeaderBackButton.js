// 헤더 뒤로가기 버튼 — 웹 전용
// 원인: 웹에서 새로고침·URL 직접 진입 시 스택이 현재 화면 1장으로 재구성되어
//       네이티브 헤더의 기본 뒤로가기 버튼이 사라진다 (스택 index 0).
// 해결: 항상 표시되는 커스텀 뒤로가기. 히스토리가 없으면 게이트(/)로 보내 분기 복구.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export default function HeaderBackButton() {
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <Pressable
      onPress={goBack}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="뒤로가기"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={26} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.6 },
});

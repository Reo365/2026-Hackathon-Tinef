// 카드 프리미티브 — 보더 대신 배경 대비 + 토큰 그림자 (와이어프레임 보더 안티패턴 대체)
import { View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme';

export default function Card({ style, children, ...props }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: spacing.md,
          boxShadow: shadows.card,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

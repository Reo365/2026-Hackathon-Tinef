// 스켈레톤 프리미티브 — 로딩 원 대신 항목별 뼈대 애니메이션 (pulse)
// 제목 등 고정 요소는 실제 텍스트로 표시하고, 가변 내용만 이 컴포넌트로 채운다
// useNativeDriver: false — 네이티브 Animated 모듈 누락 환경에서도 동일 동작 (경고 제거)
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { colors, radius } from '../../theme';

export default function Skeleton({ width = '100%', height = 14, style }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius.sm,
          backgroundColor: colors.border,
        },
        { opacity },
        style,
      ]}
    />
  );
}

// 섹션 전환 — 웹: 높이 보간 애니메이션 / 네이티브: 즉시 렌더
// 네이티브(Expo Go)에서 Animated 네이티브 모듈 이슈로 섹션이 표시되지 않는 사례 방지 →
// 모바일은 컨테이너 없이 children을 직접 렌더해 항상 확실히 표시 (애니메이션은 웹 전용)
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { spacing } from '../../theme';

// 웹 전용 — 내용 실측 후 높이 보간 (마운트 0→h, 변화 h→h)
function AnimatedWeb({ children, onHeightDelta }) {
  const height = useRef(new Animated.Value(0)).current;
  const target = useRef(0);
  const innerRef = useRef(null);
  const [locked, setLocked] = useState(false);

  const applyHeight = (rawH, pageY) => {
    const next = Math.round(rawH);
    if (Math.abs(target.current - next) <= 1) return;
    const delta = next - target.current;
    target.current = next;
    Animated.timing(height, {
      toValue: next,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    if (onHeightDelta) onHeightDelta(delta, pageY);
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const node = innerRef.current;
      if (!node) return;
      if (typeof node.measure !== 'function') {
        setLocked(false);
        return;
      }
      node.measure((x, y, w, h) => applyHeight(h, y));
    });
    return () => cancelAnimationFrame(id);
  });

  if (!locked) {
    return <View>{children}</View>;
  }

  return (
    <Animated.View style={{ height, overflow: 'hidden' }}>
      <View ref={innerRef} style={{ gap: spacing.md }}>
        {children}
      </View>
    </Animated.View>
  );
}

export default function AnimatedSection({ children, onHeightDelta }) {
  if (Platform.OS === 'web') {
    return <AnimatedWeb onHeightDelta={onHeightDelta}>{children}</AnimatedWeb>;
  }
  // 네이티브 — 애니메이션 없이 즉시 렌더 (정보 누락 방지)
  return <View style={{ gap: spacing.md }}>{children}</View>;
}

// 섹션 높이 전환 애니메이션 — 내용 실측 후 높이 보간
// 마운트 시 0→h, 내용 변화 시 h→h. 뷰포트 위쪽 섹션의 높이 변화는 onHeightDelta로 알려
// 스크롤 보정이 가능하게 함 (위쪽 내용이 늘어나거나 줄 때 화면이 뛰는 것 방지)
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

export default function AnimatedSection({ children, onHeightDelta }) {
  const height = useRef(new Animated.Value(0)).current;
  const target = useRef(0);
  const innerRef = useRef(null);
  const [staticMode, setStaticMode] = useState(false);

  const applyHeight = (rawH, pageY) => {
    const next = Math.round(rawH);
    if (Math.abs(target.current - next) <= 1) return;
    const delta = next - target.current;
    target.current = next;
    Animated.timing(height, {
      toValue: next,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height 보간은 JS 드라이버 필수
    }).start();
    if (onHeightDelta) onHeightDelta(delta, pageY);
  };

  useEffect(() => {
    // 매 렌더 다음 프레임에 내용 실측 — 어떤 크기 변화도 누락하지 않음
    const id = requestAnimationFrame(() => {
      const node = innerRef.current;
      if (!node) return;
      if (typeof node.measure !== 'function') {
        setStaticMode(true); // 실측 불가 환경 — 클리핑 없이 즉시 표시
        return;
      }
      // pageY: 화면 기준 위치(여기서는 페이지 스크롤이 없어 뷰포트 기준과 동일)
      node.measure((x, y, w, h) => applyHeight(h, y));
    });
    return () => cancelAnimationFrame(id);
  });

  if (staticMode) {
    return <View>{children}</View>;
  }

  return (
    <Animated.View style={{ height, overflow: 'hidden' }}>
      {/* 내용은 자연 크기로 렌더되고, 바깥 컨테이너가 높이를 보간하며 잘라낸다 */}
      <View ref={innerRef}>{children}</View>
    </Animated.View>
  );
}

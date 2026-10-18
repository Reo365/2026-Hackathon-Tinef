// 혈당 라인 차트 — 전 플랫폼(web·iOS·Android) 동일한 svg 디자인 통일
// chart-kit은 플랫폼별 렌더 차이와 웹 DOM 경고(onPressIn·transform-origin)가 있어 제거하고
// react-native-svg 기반 단일 구현으로 통일 (시안 스타일: 파란 라인 + 점 + 최고치 라벨 + x축 라벨)
// 인터랙션: 웹은 점에 마우스 오버(hover), 모바일은 점을 탭하면 해당 시점의 혈당값 표시
// props: labels(문자열[]), values(mg/dL 숫자[])
import { useState } from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme';

export default function BloodSugarChart({ labels = [], values }) {
  return <SvgChart labels={labels} values={values} />;
}

// svg 라인 + 점 + 최대치 표시 + x축 라벨 (viewBox라 폭 자동 대응)
export function SvgChart({ labels = [], values }) {
  const width = 300;
  const height = 160;
  const padX = 20;
  const padTop = 28;
  const padBottom = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = padX + (i * (width - padX * 2)) / Math.max(1, values.length - 1);
    const y = height - padBottom - ((v - min) / range) * (height - padTop - padBottom);
    return { x, y };
  });
  const maxIndex = values.indexOf(max);
  // 웹: 마우스 오버 / 모바일: 탭 — 가리킨 점의 값 표시 (최대치는 항상 표시라 제외)
  const [hoverIndex, setHoverIndex] = useState(null);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* 기준선 */}
      <Line
        x1={padX}
        y1={height - padBottom}
        x2={width - padX}
        y2={height - padBottom}
        stroke={colors.border}
        strokeWidth="1"
      />
      <Polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={colors.primaryDeep}
        strokeWidth="2"
      />
      {points.map((p, i) => (
        <Circle
          key={`dot-${i}`}
          cx={p.x}
          cy={p.y}
          r={i === maxIndex ? 5 : 3.5}
          fill={i === maxIndex ? colors.primaryDeep : colors.card}
          stroke={colors.primaryDeep}
          strokeWidth="2"
          onPress={() => setHoverIndex(hoverIndex === i ? null : i)}
          {...(Platform.OS === 'web'
            ? { onMouseEnter: () => setHoverIndex(i), onMouseLeave: () => setHoverIndex(null) }
            : {})}
        />
      ))}
      {/* 최대치 값 표시 */}
      {points[maxIndex] && (
        <SvgText
          x={Math.min(width - padX, Math.max(padX, points[maxIndex].x))}
          y={Math.max(12, points[maxIndex].y - 10)}
          fill={colors.text}
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          {max}
        </SvgText>
      )}
      {/* 가리킨 점의 값 표시 — 최대치 외 나머지 점 */}
      {points.map((p, i) =>
        i !== maxIndex && hoverIndex === i && values[i] != null ? (
          <SvgText
            key={`value-${i}`}
            x={Math.min(width - padX, Math.max(padX, p.x))}
            y={Math.max(12, p.y - 10)}
            fill={colors.text}
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
          >
            {values[i]}
          </SvgText>
        ) : null
      )}
      {/* x축 라벨 */}
      {labels.map((label, i) => {
        if (!points[i]) return null;
        return (
          <SvgText
            key={`label-${i}`}
            x={points[i].x}
            y={height - 8}
            fill={colors.sub}
            fontSize="9"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

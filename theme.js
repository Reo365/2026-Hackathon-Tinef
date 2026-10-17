// 디자인 토큰 — 단일 진실 공급원 (expo-design-system 스킬)
// 규칙: 이 파일 밖에서 색상/폰트/간격/그림자 리터럴 금지
export const colors = {
  primary: '#6B8AFB',
  primarySoft: '#E8EDFF',
  accent: '#8E7BFF',
  success: '#3FC97C',
  successSoft: '#E6F7EE',
  warning: '#F5A25D',
  danger: '#FF6B6B',
  bg: '#F6F8FE',
  card: '#FFFFFF',
  text: '#2B2F4A',
  sub: '#8A90A8',
  border: '#ECEFF9',
  // 틴트(브랜드색) 배경 위 텍스트 — 라이트 고정 앱이므로 의도적 고정값
  onTint: '#FFFFFF',
  onTintSoft: 'rgba(255, 255, 255, 0.8)',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const radius = { sm: 8, md: 12, lg: 16, full: 999 };

// 이름 있는 텍스트 스타일 램프 — 화면에서 fontSize 직접 사용 금지
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', color: colors.text, lineHeight: 41 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, lineHeight: 28 },
  headline: { fontSize: 17, fontWeight: '600', color: colors.text, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 22 },
  subhead: { fontSize: 13, fontWeight: '400', color: colors.sub, lineHeight: 20 },
  caption: { fontSize: 11, fontWeight: '400', color: colors.sub, lineHeight: 16 },
  hero: { fontSize: 40, fontWeight: '700', color: colors.onTint, lineHeight: 48 },
};

// boxShadow 문자열 — 레거시 shadow/elevation 금지, 2단계면 충분
export const shadows = {
  card: '0 1px 2px rgba(0, 0, 0, 0.05)',
  raised: '0 4px 12px rgba(0, 0, 0, 0.10)',
};

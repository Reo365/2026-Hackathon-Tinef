import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import HeaderBackButton from '../components/HeaderBackButton';

// 웹에서 새로고침·직접 진입 시 스택 히스토리가 비어 기본 뒤로가기 버튼이 사라진다.
// → 웹에서는 항상 표시되는 커스텀 뒤로가기를 사용 (네이티브는 기본 동작 유지)
const webBack = Platform.OS === 'web' ? { headerLeft: () => <HeaderBackButton /> } : {};

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="predict" options={{ title: '혈당 예측하기', ...webBack }} />
      <Stack.Screen name="predict-result" options={{ title: '예측 결과', ...webBack }} />
      <Stack.Screen name="food-log" options={{ title: '식단 분석', ...webBack }} />
      <Stack.Screen name="schedule" options={{ title: '스케줄 계획', ...webBack }} />
      <Stack.Screen name="record-detail" options={{ title: '기록 상세', ...webBack }} />
    </Stack>
  );
}

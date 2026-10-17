import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="predict" options={{ title: '혈당 예측하기' }} />
      <Stack.Screen name="predict-result" options={{ title: '예측 결과' }} />
      <Stack.Screen name="food-log" options={{ title: '식단 기록하기' }} />
      <Stack.Screen name="food-analysis" options={{ title: '식단 분석' }} />
      <Stack.Screen name="exercise-log" options={{ title: '운동 기록하기' }} />
      <Stack.Screen name="tip-detail" options={{ title: '팁' }} />
    </Stack>
  );
}

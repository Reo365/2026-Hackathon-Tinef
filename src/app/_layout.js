import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="predict" options={{ title: '혈당 예측하기' }} />
      <Stack.Screen name="predict-result" options={{ title: '예측 결과' }} />
      <Stack.Screen name="food-log" options={{ title: '식단 분석' }} />
      <Stack.Screen name="schedule" options={{ title: '루틴 계획' }} />
      <Stack.Screen name="record-detail" options={{ title: '기록 상세' }} />
    </Stack>
  );
}

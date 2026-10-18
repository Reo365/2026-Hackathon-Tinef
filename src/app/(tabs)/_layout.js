// 하단 탭 3개 — 플로팅 독 형태 (둥근 캡슐, 화면 위에 떠 있음) + 플랫폼 아이콘 (이모지 아이콘 금지)
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors, radius, shadows, spacing } from '../../../theme';

const TAB_ICONS = {
  index: { focused: 'home', idle: 'home-outline' },
  records: { focused: 'stats-chart', idle: 'stats-chart-outline' },
  settings: { focused: 'settings', idle: 'settings-outline' },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primaryDeep,
        tabBarInactiveTintColor: colors.sub,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: spacing.sm,
          marginHorizontal: spacing.md,
          height: 58,
          backgroundColor: colors.card,
          borderRadius: radius.full,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.border,
          boxShadow: shadows.raised,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={TAB_ICONS.index[focused ? 'focused' : 'idle']} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: '내 기록',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={TAB_ICONS.records[focused ? 'focused' : 'idle']} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={TAB_ICONS.settings[focused ? 'focused' : 'idle']} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

import React from 'react';
import { Stack } from 'expo-router';
import { THEME } from '@/constants/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: THEME.colors.background },
        headerTintColor: THEME.colors.textDark,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: THEME.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="budget" options={{ title: 'Budget & cycle' }} />
      <Stack.Screen name="subscriptions" options={{ title: 'Subscriptions' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="about" options={{ title: 'Privacy & About' }} />
    </Stack>
  );
}

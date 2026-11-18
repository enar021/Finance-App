import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { THEME } from '@/constants/theme';

function getSubpageOptions(title: string) {
  return {
    title,
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => router.replace('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Back to settings"
        hitSlop={8}
        style={{ marginRight: 12 }}
      >
        <Ionicons name="arrow-back" size={22} color={THEME.colors.textDark} />
      </TouchableOpacity>
    ),
  };
}

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
      <Stack.Screen name="budget" options={getSubpageOptions('Budget & cycle')} />
      <Stack.Screen name="subscriptions" options={getSubpageOptions('Subscriptions')} />
      <Stack.Screen name="notifications" options={getSubpageOptions('Notifications')} />
      <Stack.Screen name="about" options={getSubpageOptions('Privacy & About')} />
    </Stack>
  );
}

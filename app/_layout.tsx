import React, { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/store/useFinanceStore';
import { THEME } from '@/constants/theme';
import { StartupAnimation } from '@/components/StartupAnimation';
import { checkAndTriggerScheduledReminders } from '@/utils/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore */
});

function RootTabs() {
  const loadData = useFinanceStore((s) => s.loadData);
  const checkAndAdvanceMonth = useFinanceStore((s) => s.checkAndAdvanceMonth);
  const isLoaded = useFinanceStore((s) => s.isLoaded);
  const insets = useSafeAreaInsets();

  // Mobile responsiveness:
  // On iOS Safari / PWA, the home indicator requires at least 26px bottom padding so labels are never cut off.
  // On native iOS/Android, insets.bottom gives the exact system inset.
  const isWeb = Platform.OS === 'web';
  const bottomPadding = Math.max(insets.bottom, isWeb ? 26 : 12);
  const tabHeight = 58 + bottomPadding;

  const [isAnimationFinished, setIsAnimationFinished] = useState(false);

  useEffect(() => {
    loadData();

    // Hide native splash screen so our animated splash takes over seamlessly
    SplashScreen.hideAsync().catch(() => {
      /* ignore */
    });

    // Check for scheduled expense reminders on startup
    checkAndTriggerScheduledReminders();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAndAdvanceMonth();
        checkAndTriggerScheduledReminders();
      }
    });

    // Check periodically in case month changes or reminder time arrives
    const interval = setInterval(() => {
      checkAndAdvanceMonth();
      checkAndTriggerScheduledReminders();
    }, 30000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false, // Clean custom headers in each screen matching mockups
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E2E8F0',
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: bottomPadding,
            height: tabHeight,
            elevation: 8,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
          },
          tabBarActiveTintColor: THEME.colors.pillDark,
          tabBarInactiveTintColor: THEME.colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Ledger',
            tabBarIcon: ({ color, size }: { color: any; size: number }) => (
              <Ionicons name="wallet-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Statistics',
            tabBarIcon: ({ color, size }: { color: any; size: number }) => (
              <Ionicons name="pie-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }: { color: any; size: number }) => (
              <Ionicons name="shield-checkmark-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Startup brand animation overlay */}
      {!isAnimationFinished && (
        <StartupAnimation
          isReady={isLoaded}
          onFinish={() => setIsAnimationFinished(true)}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootTabs />
    </SafeAreaProvider>
  );
}

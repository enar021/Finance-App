import React, { useEffect, useState } from 'react';
import { AppState, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/store/useFinanceStore';
import { THEME } from '@/constants/theme';
import { StartupAnimation } from '@/components/StartupAnimation';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore */
});

export default function RootLayout() {
  const loadData = useFinanceStore((s) => s.loadData);
  const checkAndAdvanceMonth = useFinanceStore((s) => s.checkAndAdvanceMonth);
  const isLoaded = useFinanceStore((s) => s.isLoaded);
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom + 4 : 12;

  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth > 580;
  const maxContentWidth = 520;

  const [isAnimationFinished, setIsAnimationFinished] = useState(false);

  useEffect(() => {
    loadData();

    // Hide native splash screen so our animated splash takes over seamlessly
    SplashScreen.hideAsync().catch(() => {
      /* ignore */
    });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAndAdvanceMonth();
      }
    });

    // Check periodically in case month changes while app is open
    const interval = setInterval(() => {
      checkAndAdvanceMonth();
    }, 60000);

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
            height: 56 + bottomPadding,
            elevation: 8,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            left: isLargeScreen ? (windowWidth - maxContentWidth) / 2 : 0,
            right: isLargeScreen ? (windowWidth - maxContentWidth) / 2 : 0,
            borderRadius: isLargeScreen ? 20 : 0,
            marginBottom: isLargeScreen ? 12 : 0,
            borderLeftWidth: isLargeScreen ? 1 : 0,
            borderRightWidth: isLargeScreen ? 1 : 0,
            borderLeftColor: '#E2E8F0',
            borderRightColor: '#E2E8F0',
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

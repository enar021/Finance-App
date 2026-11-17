import React, { useEffect, useState } from 'react';
import { AppState, Platform, useWindowDimensions, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/store/useFinanceStore';
import { THEME } from '@/constants/theme';
import { StartupAnimation } from '@/components/StartupAnimation';
import TermsAgreementModal from '@/components/TermsAgreementModal';
import { checkAndTriggerScheduledReminders } from '@/utils/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore */
});

function RootTabs() {
  const loadData = useFinanceStore((s) => s.loadData);
  const checkAndAdvanceMonth = useFinanceStore((s) => s.checkAndAdvanceMonth);
  const isLoaded = useFinanceStore((s) => s.isLoaded);
  const hasAcceptedTerms = useFinanceStore((s) => s.hasAcceptedTerms);
  const acceptTerms = useFinanceStore((s) => s.acceptTerms);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const isPhoneWeb = isWeb && width <= 430;
  const bottomPadding = Math.max(insets.bottom, isPhoneWeb ? 8 : isWeb ? 26 : 12);
  const tabHeight = 58 + bottomPadding;

  const [isAnimationFinished, setIsAnimationFinished] = useState(false);

  useEffect(() => {
    loadData();

    SplashScreen.hideAsync().catch(() => {
      /* ignore */
    });

    checkAndTriggerScheduledReminders();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAndAdvanceMonth();
        checkAndTriggerScheduledReminders();
      }
    });

    const interval = setInterval(() => {
      checkAndAdvanceMonth();
      checkAndTriggerScheduledReminders();
    }, 30000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [loadData, checkAndAdvanceMonth]);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
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
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wallet-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Statistics',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pie-chart-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={size} color={color as string} />
            ),
          }}
        />
      </Tabs>

      {!isAnimationFinished && (
        <StartupAnimation
          isReady={isLoaded}
          onFinish={() => setIsAnimationFinished(true)}
        />
      )}

      {isLoaded && isAnimationFinished && !hasAcceptedTerms && (
        <TermsAgreementModal
          visible
          onAccept={acceptTerms}
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
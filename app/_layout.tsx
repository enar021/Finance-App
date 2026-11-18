import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, Tabs } from 'expo-router';
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
  const saveStatus = useFinanceStore((s) => s.saveStatus);
  const clearSaveStatus = useFinanceStore((s) => s.clearSaveStatus);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const isPhoneWeb = isWeb && width <= 430;
  const bottomPadding = Math.max(insets.bottom, isPhoneWeb ? 8 : isWeb ? 26 : 12);
  const tabHeight = (isPhoneWeb ? 72 : 58) + bottomPadding;

  const [isAnimationFinished, setIsAnimationFinished] = useState(false);

  const handleAcceptTerms = () => {
    acceptTerms();
    router.replace('/');
  };

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

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const timer = setTimeout(clearSaveStatus, 2200);
    return () => clearTimeout(timer);
  }, [saveStatus, clearSaveStatus]);

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

      {saveStatus !== 'idle' && (
        <View
          pointerEvents="none"
          style={[
            styles.saveNotice,
            { bottom: tabHeight + 8 },
            saveStatus === 'saved' && styles.saveNoticeSuccess,
            saveStatus === 'error' && styles.saveNoticeError,
          ]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            saveStatus === 'saving'
              ? 'Saving changes'
              : saveStatus === 'saved'
                ? 'Changes saved'
                : 'Could not save changes. Check available device storage and try saving again.'
          }
        >
          {saveStatus === 'saving' ? (
            <ActivityIndicator size="small" color={THEME.colors.pillDark} />
          ) : (
            <Ionicons
              name={saveStatus === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={18}
              color={saveStatus === 'error' ? '#991B1B' : '#166534'}
            />
          )}
          <Text
            style={[
              styles.saveNoticeText,
              saveStatus === 'error' && styles.saveNoticeErrorText,
            ]}
          >
            {saveStatus === 'saving'
              ? 'Saving changes...'
              : saveStatus === 'saved'
                ? 'Changes saved'
                : 'Could not save. Check device storage and try again.'}
          </Text>
        </View>
      )}

      {!isAnimationFinished && (
        <StartupAnimation
          isReady={isLoaded}
          onFinish={() => setIsAnimationFinished(true)}
        />
      )}

      {isLoaded && isAnimationFinished && !hasAcceptedTerms && (
        <TermsAgreementModal
          visible
          onAccept={handleAcceptTerms}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  saveNotice: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderWidth: 1,
    elevation: 6,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    left: 16,
    maxWidth: 480,
    minHeight: 46,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 50,
  },
  saveNoticeSuccess: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  saveNoticeError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  saveNoticeText: { color: THEME.colors.textDark, flexShrink: 1, fontSize: 13, fontWeight: '700' },
  saveNoticeErrorText: { color: '#991B1B' },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootTabs />
    </SafeAreaProvider>
  );
}
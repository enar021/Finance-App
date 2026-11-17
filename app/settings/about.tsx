import React, { useState, type ComponentProps } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';

export default function AboutSettingsScreen() {
  const resetAllData = useFinanceStore((state) => state.resetAllData);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const confirmReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setResetError(null);
    const didReset = await resetAllData();
    setIsResetting(false);
    if (didReset) {
      setShowResetConfirmation(false);
    } else {
      setResetError('Could not clear your saved data. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Penny Wise Personal Finance</Text>
        <InfoCard
          icon="lock-closed"
          title="100% on-device privacy"
          body="Penny Wise is designed with a strict offline-first privacy model. Account names, monthly allowances, transactions, subscriptions, and savings balances are stored solely on your device. We do not collect, transmit, sell, or analyze your personal or financial data. No remote servers or analytics are used."
        />
        <InfoCard
          icon="alert-circle"
          title="Informational tool only"
          body="Penny Wise is an informational personal budgeting calculator and organizational ledger. It does not provide professional financial, investment, legal, or tax advice. Penny Wise is not a bank, broker, or registered financial advisor. Users are solely responsible for evaluating their own spending, budgeting, and financial decisions."
        />
        <InfoCard
          icon="document-text"
          title="Terms & as-is provision"
          body="This application is provided “as is”, without warranty of any kind, express or implied. In no event shall the authors or developers be liable for any direct or indirect damages, loss, or financial discrepancies resulting from the use of this software."
        />
        <View style={styles.dangerCard}>
          <View style={styles.dangerHeading}>
            <Ionicons name="warning-outline" size={18} color={THEME.colors.indicatorRed} />
            <Text style={styles.dangerTitle}>Danger zone</Text>
          </View>
          <Text style={styles.dangerBody}>Permanently remove locally saved ledger data.</Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setResetError(null);
              setShowResetConfirmation(true);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.resetText}>Clear all data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal
        visible={showResetConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isResetting) setShowResetConfirmation(false);
        }}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Clear all data?</Text>
            <Text style={styles.confirmationBody}>
              This permanently removes your account name, budget, savings balance, subscriptions,
              and expenses from this device. This cannot be undone.
            </Text>
            {resetError ? <Text style={styles.confirmationError}>{resetError}</Text> : null}
            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.confirmationCancel}
                onPress={() => setShowResetConfirmation(false)}
                disabled={isResetting}
                accessibilityRole="button"
              >
                <Text style={styles.confirmationCancelText}>Keep my data</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmationDelete}
                onPress={confirmReset}
                disabled={isResetting}
                accessibilityRole="button"
              >
                <Text style={styles.confirmationDeleteText}>
                  {isResetting ? 'Clearing...' : 'Clear all data'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeading}>
        <Ionicons name={icon} size={18} color={THEME.colors.pillDark} />
        <Text style={styles.infoTitle}>{title}</Text>
      </View>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  content: { gap: 13, padding: 20, paddingBottom: 36 },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, marginBottom: 3 },
  infoCard: {
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  infoHeading: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 8 },
  infoTitle: { color: THEME.colors.textDark, fontSize: 14, fontWeight: '800' },
  infoBody: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  dangerCard: {
    backgroundColor: '#FFF7F7',
    borderColor: '#FECACA',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    marginTop: 10,
    padding: 16,
  },
  dangerHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  dangerTitle: { color: THEME.colors.indicatorRed, fontSize: 14, fontWeight: '800' },
  dangerBody: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 7 },
  resetButton: {
    alignItems: 'center',
    borderColor: '#FCA5A5',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    marginTop: 13,
    paddingVertical: 11,
  },
  resetText: { color: THEME.colors.indicatorRed, fontSize: 13, fontWeight: '800' },
  confirmationOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  confirmationCard: {
    alignSelf: 'center',
    backgroundColor: THEME.colors.white,
    borderRadius: THEME.radius.lg,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  confirmationTitle: { color: THEME.colors.textDark, fontSize: 18, fontWeight: '800' },
  confirmationBody: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  confirmationError: { color: THEME.colors.indicatorRed, fontSize: 13, marginTop: 10 },
  confirmationActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  confirmationCancel: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  confirmationCancelText: { color: THEME.colors.textDark, fontSize: 13, fontWeight: '700' },
  confirmationDelete: {
    alignItems: 'center',
    backgroundColor: THEME.colors.indicatorRed,
    borderRadius: THEME.radius.full,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  confirmationDeleteText: { color: THEME.colors.white, fontSize: 13, fontWeight: '700' },
});

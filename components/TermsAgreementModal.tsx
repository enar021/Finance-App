import React from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { PennyWiseLogo } from './PennyWiseLogo';

interface TermsAgreementModalProps {
  visible: boolean;
  onAccept: () => void;
}

export default function TermsAgreementModal({
  visible,
  onAccept,
}: TermsAgreementModalProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'web' ? 24 : 16);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <PennyWiseLogo size={36} />
            </View>
            <Text style={styles.title}>Welcome to Penny Wise</Text>
            <Text style={styles.subtitle}>
              Please review and agree to our Privacy Notice & Disclaimers before setting up your budget.
            </Text>
          </View>

          {/* Scrollable Terms Content */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Privacy Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, styles.privacyBadge]}>
                  <Ionicons name="lock-closed" size={17} color="#059669" />
                </View>
                <Text style={styles.cardTitle}>100% On-Device Privacy</Text>
              </View>
              <Text style={styles.cardText}>
                Penny Wise is designed with a strict offline-first privacy model. All account names,
                monthly allowances, transactions, and savings balances are stored solely on your
                device. We do not collect, transmit, sell, or analyze your personal or financial data.
                No remote servers or analytics are used.
              </Text>
            </View>

            {/* 2. Informational Disclaimer Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, styles.disclaimerBadge]}>
                  <Ionicons name="alert-circle" size={17} color="#D97706" />
                </View>
                <Text style={styles.cardTitle}>Informational Tool Only</Text>
              </View>
              <Text style={styles.cardText}>
                Penny Wise is an informational personal budgeting calculator and organizational ledger.
                It does not provide professional financial, investment, legal, or tax advice.
                Penny Wise is not a bank, broker, or registered financial advisor. Users are solely
                responsible for evaluating their own spending, budgeting, and financial decisions.
              </Text>
            </View>

            {/* 3. As-Is Terms Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, styles.termsBadge]}>
                  <Ionicons name="document-text" size={17} color="#4F46E5" />
                </View>
                <Text style={styles.cardTitle}>Terms & &ldquo;As Is&rdquo; Provision</Text>
              </View>
              <Text style={styles.cardText}>
                This application is provided &ldquo;as is&rdquo;, without warranty of any kind, express
                or implied. In no event shall the authors or developers be liable for any direct or
                indirect damages, loss, or financial discrepancies resulting from the use of this software.
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Agreement Button Area */}
          <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
            <Text style={styles.agreementNotice}>
              By tapping Agree & Continue, you confirm that you have read and agree to these terms.
            </Text>
            <TouchableOpacity
              style={styles.agreeButton}
              onPress={onAccept}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Agree to terms and continue"
            >
              <Text style={styles.agreeButtonText}>Agree & Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#EDF6F2',
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCE2D8',
    borderRadius: 24,
    borderWidth: 1.5,
    height: 64,
    justifyContent: 'center',
    marginBottom: 14,
    width: 64,
    ...THEME.shadow.soft,
  },
  title: {
    color: THEME.colors.textDark,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 16,
    ...THEME.shadow.card,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  badgeIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  privacyBadge: { backgroundColor: '#D1FAE5' },
  disclaimerBadge: { backgroundColor: '#FEF3C7' },
  termsBadge: { backgroundColor: '#EEF2FF' },
  cardTitle: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: '800',
  },
  cardText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  agreementNotice: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: 12,
    textAlign: 'center',
  },
  agreeButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 15,
    ...THEME.shadow.button,
  },
  agreeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

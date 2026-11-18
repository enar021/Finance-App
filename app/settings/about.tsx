import React, { type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';

export default function AboutSettingsScreen() {
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
      </ScrollView>
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
});

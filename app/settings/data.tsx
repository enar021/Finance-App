import React, { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';
import { showConfirm } from '@/utils/alerts';

export default function DataSettingsScreen() {
  const resetAllData = useFinanceStore((state) => state.resetAllData);
  const createBackup = useFinanceStore((state) => state.createBackup);
  const restoreBackup = useFinanceStore((state) => state.restoreBackup);
  const hasConfirmedBackupConsent = useFinanceStore((state) => state.hasConfirmedBackupConsent);
  const confirmBackupConsent = useFinanceStore((state) => state.confirmBackupConsent);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPickingBackup, setIsPickingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConfirmingConsent, setIsConfirmingConsent] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<unknown>(undefined);
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false);

  const exportBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setBackupError(null);
    setBackupStatus(null);
    try {
      const backup = createBackup();
      const contents = JSON.stringify(backup, null, 2);
      const filename = `penny-wise-backup-${backup.exportedAt.replace(/[:.]/g, '-')}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([contents], { type: 'application/json' });
        const uri = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = uri;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(uri), 1000);
      } else {
        const file = new ExpoFile(Paths.cache, filename);
        file.create();
        await file.write(contents);
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('File sharing is not available on this device.');
        }
        await Sharing.shareAsync(file.uri, {
          dialogTitle: 'Save your Penny Wise backup',
          mimeType: 'application/json',
          UTI: 'public.json',
        });
      }

      setBackupStatus('Backup file created. Keep it somewhere private and safe.');
    } catch (error) {
      console.error('Failed to export ledger backup:', error);
      setBackupError('Could not create or share the backup file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const chooseBackup = async () => {
    if (isPickingBackup || isRestoring) return;
    setIsPickingBackup(true);
    setBackupError(null);
    setBackupStatus(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const contents =
        Platform.OS === 'web' && asset.file
          ? await asset.file.text()
          : await new ExpoFile(asset.uri).text();
      const backup: unknown = JSON.parse(contents);
      setPendingBackup(backup);
      setShowRestoreConfirmation(true);
    } catch (error) {
      console.error('Failed to read ledger backup file:', error);
      setBackupError('Could not read that file. Choose a valid Penny Wise JSON backup.');
    } finally {
      setIsPickingBackup(false);
    }
  };

  const requestBackupAction = (action: 'export' | 'import') => {
    if (isExporting || isPickingBackup || isRestoring || isConfirmingConsent) return;

    const continueAction = () => {
      if (action === 'export') {
        void exportBackup();
      } else {
        void chooseBackup();
      }
    };

    if (hasConfirmedBackupConsent) {
      continueAction();
      return;
    }

    showConfirm(
      'Allow backup and restore?',
      'Backups include your account name, budget, expenses, subscriptions, and savings history. This one-time approval allows Penny Wise to create backup files and open the file picker. You will still confirm before an imported backup replaces your ledger.',
      {
        confirmText: 'Allow',
        onConfirm: () => void (async () => {
          setIsConfirmingConsent(true);
          setBackupError(null);
          const wasSaved = await confirmBackupConsent();
          setIsConfirmingConsent(false);
          if (wasSaved) {
            continueAction();
          } else {
            setBackupError('Could not save your choice. Please try again.');
          }
        })(),
      }
    );
  };

  const requestExport = () => {
    requestBackupAction('export');
  };

  const requestImport = () => {
    requestBackupAction('import');
  };

  const confirmRestore = async () => {
    if (isRestoring || pendingBackup === undefined) return;
    setIsRestoring(true);
    setBackupError(null);
    try {
      const result = await restoreBackup(pendingBackup);
      if (result.ok) {
        setShowRestoreConfirmation(false);
        setPendingBackup(undefined);
        setBackupStatus(result.message);
      } else {
        setBackupError(result.message);
      }
    } catch (error) {
      console.error('Failed to restore ledger backup:', error);
      setBackupError('Could not restore this backup. Your current ledger was not replaced.');
    } finally {
      setIsRestoring(false);
    }
  };

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
        <Text style={styles.intro}>Manage backups and locally stored ledger data.</Text>
        <View style={styles.backupCard}>
          <View style={styles.backupHeading}>
            <Ionicons name="archive-outline" size={19} color={THEME.colors.pillDark} />
            <Text style={styles.backupTitle}>Backup & restore</Text>
          </View>
          <View style={styles.backupActions}>
            <TouchableOpacity
              style={[styles.backupButton, styles.backupButtonPrimary]}
              onPress={requestExport}
              disabled={isExporting || isPickingBackup || isRestoring || isConfirmingConsent}
              accessibilityRole="button"
              accessibilityLabel="Request permission to export ledger backup"
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.backupButtonPrimaryText}>
                {isExporting ? 'Preparing...' : 'Export backup'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backupButton, styles.backupButtonSecondary]}
              onPress={requestImport}
              disabled={isExporting || isPickingBackup || isRestoring || isConfirmingConsent}
              accessibilityRole="button"
              accessibilityLabel="Request permission to choose a ledger backup"
            >
              <Ionicons name="refresh-outline" size={18} color={THEME.colors.textDark} />
              <Text style={styles.backupButtonSecondaryText}>
                {isPickingBackup ? 'Opening...' : 'Restore backup'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.backupPrivacy}>
            Backup files contain personal financial data. Store them securely.
          </Text>
          {backupStatus ? <Text style={styles.backupStatus}>{backupStatus}</Text> : null}
          {backupError ? <Text style={styles.backupError}>{backupError}</Text> : null}
        </View>
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
      <Modal
        visible={showRestoreConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isRestoring) {
            setShowRestoreConfirmation(false);
            setPendingBackup(undefined);
          }
        }}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Replace this ledger?</Text>
            <Text style={styles.confirmationBody}>
              Restoring will replace the budget, expenses, subscriptions, and savings history on this
              device. This cannot be undone. Export your current ledger first if you may need it.
            </Text>
            {backupError ? <Text style={styles.confirmationError}>{backupError}</Text> : null}
            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.confirmationCancel}
                onPress={() => {
                  setShowRestoreConfirmation(false);
                  setPendingBackup(undefined);
                }}
                disabled={isRestoring}
                accessibilityRole="button"
                accessibilityLabel="Cancel backup restore"
              >
                <Text style={styles.confirmationCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmationDelete}
                onPress={confirmRestore}
                disabled={isRestoring}
                accessibilityRole="button"
                accessibilityLabel="Confirm backup restore and replace current ledger"
              >
                <Text style={styles.confirmationDeleteText}>
                  {isRestoring ? 'Restoring...' : 'Replace ledger'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  content: { gap: 13, padding: 20, paddingBottom: 36 },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, marginBottom: 3 },
  backupCard: {
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  backupHeading: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  backupTitle: { color: THEME.colors.textDark, fontSize: 15, fontWeight: '800' },
  backupActions: { gap: 9, marginTop: 14 },
  backupButton: {
    alignItems: 'center',
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  backupButtonPrimary: { backgroundColor: THEME.colors.pillDark },
  backupButtonPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  backupButtonSecondary: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1 },
  backupButtonSecondaryText: { color: THEME.colors.textDark, fontSize: 14, fontWeight: '800' },
  backupPrivacy: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 10 },
  backupStatus: { color: '#166534', fontSize: 13, fontWeight: '700', marginTop: 8 },
  backupError: { color: THEME.colors.indicatorRed, fontSize: 13, fontWeight: '700', marginTop: 8 },
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

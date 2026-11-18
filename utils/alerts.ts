import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  confirmText: string;
  onConfirm: () => void;
  confirmStyle?: 'default' | 'destructive';
  cancelText?: string;
}

export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

export function showConfirm(
  title: string,
  message: string,
  options: ConfirmOptions
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      options.onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: options.cancelText ?? 'Cancel', style: 'cancel' },
    {
      text: options.confirmText,
      style: options.confirmStyle,
      onPress: options.onConfirm,
    },
  ]);
}

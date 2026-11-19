"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showAlert = showAlert;
exports.showConfirm = showConfirm;
const react_native_1 = require("react-native");
function showAlert(title, message) {
    if (react_native_1.Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
        return;
    }
    react_native_1.Alert.alert(title, message);
}
function showConfirm(title, message, options) {
    if (react_native_1.Platform.OS === 'web') {
        if (window.confirm(`${title}\n\n${message}`)) {
            options.onConfirm();
        }
        return;
    }
    react_native_1.Alert.alert(title, message, [
        { text: options.cancelText ?? 'Cancel', style: 'cancel' },
        {
            text: options.confirmText,
            style: options.confirmStyle,
            onPress: options.onConfirm,
        },
    ]);
}

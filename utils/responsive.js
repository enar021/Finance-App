"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scale = scale;
exports.moderateScale = moderateScale;
exports.isNarrow = isNarrow;
exports.isCompact = isCompact;
const react_native_1 = require("react-native");
const { width: SCREEN_WIDTH } = react_native_1.Dimensions.get('window');
// Base design width (iPhone 14/15 Pro - 393px)
const BASE_WIDTH = 393;
/**
 * Scale a value proportionally to screen width.
 * On a 393px screen, returns the input as-is.
 * On a 320px screen, returns ~81% of input.
 * On a 430px screen, returns ~109% of input.
 */
function scale(size) {
    return Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);
}
/**
 * Moderate scale — scales less aggressively (for font sizes).
 * factor 0.5 means halfway between fixed and fully scaled.
 */
function moderateScale(size, factor = 0.5) {
    return Math.round(size + (scale(size) - size) * factor);
}
/** True when the device is a narrow phone (iPhone SE, Galaxy A series, etc.) */
function isNarrow(screenWidth) {
    return screenWidth < 360;
}
/** True when the device is a compact phone (iPhone 13 mini, Pixel 5, etc.) */
function isCompact(screenWidth) {
    return screenWidth < 400;
}

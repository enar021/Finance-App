import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Base design width (iPhone 14/15 Pro - 393px)
const BASE_WIDTH = 393;

/**
 * Scale a value proportionally to screen width.
 * On a 393px screen, returns the input as-is.
 * On a 320px screen, returns ~81% of input.
 * On a 430px screen, returns ~109% of input.
 */
export function scale(size: number): number {
  return Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);
}

/**
 * Moderate scale — scales less aggressively (for font sizes).
 * factor 0.5 means halfway between fixed and fully scaled.
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  return Math.round(size + (scale(size) - size) * factor);
}

/** True when the device is a narrow phone (iPhone SE, Galaxy A series, etc.) */
export function isNarrow(screenWidth: number): boolean {
  return screenWidth < 360;
}

/** True when the device is a compact phone (iPhone 13 mini, Pixel 5, etc.) */
export function isCompact(screenWidth: number): boolean {
  return screenWidth < 400;
}

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  G,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

interface PennyWiseLogoProps {
  size?: number;
  style?: ViewStyle;
}

/**
 * PennyWiseLogo: A premium branded emblem featuring a gleaming gold coin
 * nestled inside a modern charcoal leather wallet with brass clasp.
 */
export function PennyWiseLogo({ size = 64, style }: PennyWiseLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Gold coin gradient */}
          <LinearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FDE68A" />
            <Stop offset="40%" stopColor="#F59E0B" />
            <Stop offset="100%" stopColor="#D97706" />
          </LinearGradient>

          {/* Coin rim gradient */}
          <LinearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FEF3C7" />
            <Stop offset="50%" stopColor="#FBBF24" />
            <Stop offset="100%" stopColor="#B45309" />
          </LinearGradient>

          {/* Wallet front leather gradient */}
          <LinearGradient id="walletFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#2A303A" />
            <Stop offset="100%" stopColor="#1A1E24" />
          </LinearGradient>

          {/* Wallet back interior */}
          <LinearGradient id="walletBack" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#14171C" />
            <Stop offset="100%" stopColor="#1F242C" />
          </LinearGradient>
        </Defs>

        {/* 1. Wallet Back interior layer */}
        <Rect
          x="16"
          y="32"
          width="68"
          height="48"
          rx="12"
          fill="url(#walletBack)"
        />

        {/* 2. The Golden Coin nestled inside the wallet pocket */}
        <G id="coin">
          {/* Coin outer rim */}
          <Circle
            cx="50"
            cy="35"
            r="19"
            fill="url(#rimGrad)"
          />
          {/* Coin face */}
          <Circle
            cx="50"
            cy="35"
            r="16"
            fill="url(#coinGrad)"
          />
          {/* Inner coin ring detail */}
          <Circle
            cx="50"
            cy="35"
            r="13.5"
            fill="none"
            stroke="#FEF3C7"
            strokeWidth="0.8"
            strokeDasharray="2,1.5"
            opacity={0.7}
          />
          {/* Embossed 'P' for Penny Wise */}
          <SvgText
            x="50"
            y="41"
            fontSize="15"
            fontWeight="900"
            fill="#92400E"
            textAnchor="middle"
            fontFamily="System"
          >
            P
          </SvgText>
          {/* Shiny top-left glint reflection */}
          <Path
            d="M 39 26 A 14 14 0 0 1 54 22"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            opacity={0.8}
          />
        </G>

        {/* 3. Wallet Front leather pocket (covers the lower half of the coin) */}
        <Path
          d="M 16 48 Q 50 54 84 48 L 84 68 A 12 12 0 0 1 72 80 L 28 80 A 12 12 0 0 1 16 68 Z"
          fill="url(#walletFront)"
        />

        {/* Pocket rim highlight stitching */}
        <Path
          d="M 18 50 Q 50 56 82 50"
          stroke="#424D5C"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* 4. Wallet Clasp tab on the right edge */}
        <G id="clasp">
          <Rect
            x="64"
            y="57"
            width="22"
            height="14"
            rx="7"
            fill="#1E232A"
            stroke="#374151"
            strokeWidth="0.8"
          />
          {/* Golden brass snap button */}
          <Circle
            cx="77"
            cy="64"
            r="3.5"
            fill="#FBBF24"
            stroke="#B45309"
            strokeWidth="0.8"
          />
          <Circle
            cx="76"
            cy="63"
            r="1"
            fill="#FEF3C7"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PennyWiseLogo } from '@/components/PennyWiseLogo';

interface StartupAnimationProps {
  onFinish: () => void;
  isReady?: boolean;
}

export function StartupAnimation({ onFinish, isReady = true }: StartupAnimationProps) {
  const insets = useSafeAreaInsets();
  const footerBottom = Math.max(insets.bottom + 16, 28);

  // All animations use 100% Native Driver for locked 60-120 FPS
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const sparkScale = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;

  const screenOpacity = useRef(new Animated.Value(1)).current;

  const hasTriggeredExit = useRef(false);
  const isMountedRef = useRef(true);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      screenOpacity.stopAnimation();
    };
  }, [screenOpacity]);

  useEffect(() => {
    // Smooth, graceful entrance sequence running on GPU / Native Driver
    const entranceAnimation = Animated.parallel([
      // Logo card smooth spring
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),

      // Sparkle accent
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(sparkScale, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),

      // Title & subtitle smooth slide & fade
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
      ]),
    ]);

    entranceAnimation.start();

    return () => {
      entranceAnimation.stop();
    };
  }, [logoOpacity, logoScale, sparkScale, textOpacity, textTranslateY]);

  // Smooth, unhurried exit after comfortable display duration
  useEffect(() => {
    if (!isReady || hasTriggeredExit.current) return;

    const timer = setTimeout(() => {
      if (!isMountedRef.current || hasTriggeredExit.current) return;
      hasTriggeredExit.current = true;

      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      }).start(({ finished }) => {
        if (!isMountedRef.current) return;

        if (finished) {
          onFinishRef.current();
        } else {
          hasTriggeredExit.current = false;
        }
      });
    }, 750);

    return () => clearTimeout(timer);
  }, [isReady, screenOpacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity: screenOpacity,
        },
      ]}
    >
      <View style={[styles.centerContent, { paddingBottom: footerBottom + 24 }]}>
        {/* Brand Logo Card */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.iconCircle}>
            <PennyWiseLogo size={58} />
          </View>

          {/* Emerald accent spark */}
          <Animated.View
            style={[
              styles.sparkBadge,
              {
                transform: [{ scale: sparkScale }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={13} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>

        {/* Brand App Name */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.title}>Penny Wise</Text>
          <Text style={styles.subtitle}>Smart Personal Finance</Text>
        </Animated.View>
      </View>

      {/* Clean footer note */}
      <Animated.View
        style={[
          styles.footer,
          {
            bottom: footerBottom,
            opacity: textOpacity,
          },
        ]}
      >
        <Text style={styles.footerText}>Monthly Budget & Savings</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#EDF6F2', // Matches native splash background exactly
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 16,
    shadowColor: '#1E2229',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CCE2D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1E2229',
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5F697A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A97A6',
    letterSpacing: 0.4,
  },
});
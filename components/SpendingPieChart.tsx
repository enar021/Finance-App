import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { THEME } from '@/constants/theme';
import { formatCurrency } from '@/utils/dates';

export interface ChartSegment {
  key: string;
  label: string;
  amount: number;
  percentage: number; // 0 - 100
  color: string;
  count: number;
}

interface SpendingPieChartProps {
  segments: ChartSegment[];
  totalAmount: number;
  allowance: number | null;
  selectedKey: string | null;
  onSelectSegment: (key: string | null) => void;
  size?: number;
  animationKey?: number | string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);

  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export default function SpendingPieChart({
  segments,
  totalAmount,
  allowance,
  selectedKey,
  onSelectSegment,
  size = 240,
  animationKey,
}: SpendingPieChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 10;
  const innerRadius = outerRadius - 38;

  const selectedSegment = segments.find((s) => s.key === selectedKey);

  // Native Driver values for pop & fade
  const centerScale = useRef(new Animated.Value(0.9)).current;
  const centerOpacity = useRef(new Animated.Value(0)).current;

  // Clockwise fill-up progress (0 to 1)
  const [fillProgress, setFillProgress] = useState(0);

  useEffect(() => {
    // 1. Center hub smooth entrance
    centerScale.setValue(0.92);
    centerOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(centerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.spring(centerScale, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Smooth, graceful clockwise fill-up sweep
    if (segments.length === 0 || totalAmount === 0) {
      setFillProgress(1);
      return;
    }

    setFillProgress(0);
    let start: number | null = null;
    let reqId: number;
    const duration = 950; // Smooth, unhurried, elegant circular fill-up

    const animateSweep = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const raw = Math.min(1, elapsed / duration);
      // Silky smooth cubic deceleration curve
      const eased = 1 - Math.pow(1 - raw, 3);
      setFillProgress(eased);

      if (raw < 1) {
        reqId = requestAnimationFrame(animateSweep);
      }
    };

    reqId = requestAnimationFrame(animateSweep);

    return () => {
      if (reqId) cancelAnimationFrame(reqId);
    };
  }, [animationKey, segments.length, totalAmount]);

  // Compute fill-up slices mathematically
  const totalCircle = Math.PI * 2;
  const targetAngle = fillProgress * totalCircle;
  const hasMultiple = segments.length > 1;
  const sliceGap = hasMultiple ? 0.04 : 0;

  let accumulatedAngle = 0;
  let currentStartAngle = -Math.PI / 2; // Start at 12 o'clock

  const slices = segments
    .map((segment) => {
      const fullSegmentSweep = (segment.percentage / 100) * totalCircle;
      const segStart = accumulatedAngle;
      const segEnd = accumulatedAngle + fullSegmentSweep;
      accumulatedAngle += fullSegmentSweep;

      // How much of this segment is currently filled
      let visibleSweep = 0;
      if (targetAngle >= segEnd) {
        visibleSweep = fullSegmentSweep;
      } else if (targetAngle > segStart) {
        visibleSweep = targetAngle - segStart;
      }

      if (visibleSweep <= 0.005) {
        return null;
      }

      // Safe gap calculation that prevents inverted arc anomalies
      const gap = hasMultiple && visibleSweep > sliceGap * 1.8 ? sliceGap : 0;
      const startAngle = currentStartAngle + gap / 2;
      const endAngle = currentStartAngle + Math.max(0.001, visibleSweep - gap / 2);
      currentStartAngle += visibleSweep;

      const isSelected = selectedKey === segment.key;
      const activeOuter = isSelected ? outerRadius + 5 : outerRadius;
      const activeInner = isSelected ? innerRadius - 2 : innerRadius;

      let pathD = '';
      if (segment.percentage >= 99.5 && fillProgress >= 0.99) {
        // Complete 360-degree circle split into two 180-deg arcs
        const midAngle = startAngle + Math.PI;
        const arc1 = describeArc(cx, cy, activeInner, activeOuter, startAngle, midAngle);
        const arc2 = describeArc(cx, cy, activeInner, activeOuter, midAngle, startAngle + totalCircle);
        pathD = `${arc1} ${arc2}`;
      } else {
        pathD = describeArc(cx, cy, activeInner, activeOuter, startAngle, endAngle);
      }

      return {
        ...segment,
        pathD,
        isSelected,
      };
    })
    .filter(Boolean) as (ChartSegment & { pathD: string; isSelected: boolean })[];

  return (
    <View style={styles.container}>
      <View style={[styles.chartWrapper, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {totalAmount === 0 ? (
            <Circle
              cx={cx}
              cy={cy}
              r={(outerRadius + innerRadius) / 2}
              stroke="#E2E8F0"
              strokeWidth={38}
              fill="none"
            />
          ) : (
            <G>
              {slices.map((slice) => (
                <Path
                  key={slice.key}
                  d={slice.pathD}
                  fill={slice.color}
                  opacity={selectedKey && !slice.isSelected ? 0.45 : 1}
                  onPress={() => {
                    onSelectSegment(selectedKey === slice.key ? null : slice.key);
                  }}
                />
              ))}
            </G>
          )}
        </Svg>

        {/* Center cutout content */}
        <Animated.View
          style={[
            styles.centerCutout,
            {
              width: innerRadius * 2 - 8,
              height: innerRadius * 2 - 8,
              opacity: centerOpacity,
              transform: [{ scale: centerScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.centerTouchable}
            activeOpacity={0.8}
            onPress={() => onSelectSegment(null)}
          >
            {totalAmount === 0 ? (
              <View style={styles.centerTextGroup}>
                <Text style={styles.centerSub}>NO EXPENSES</Text>
                <Text style={styles.centerAmount}>₱ 0</Text>
                <Text style={styles.centerHint}>100% budget intact</Text>
              </View>
            ) : selectedSegment ? (
              <View style={styles.centerTextGroup}>
                <View style={[styles.categoryDot, { backgroundColor: selectedSegment.color }]} />
                <Text numberOfLines={1} style={styles.centerCategory}>
                  {selectedSegment.label}
                </Text>
                <Text style={styles.centerAmount}>₱ {formatCurrency(selectedSegment.amount)}</Text>
                <Text style={styles.centerPercentage}>
                  {selectedSegment.percentage.toFixed(1)}% of spent
                </Text>
              </View>
            ) : (
              <View style={styles.centerTextGroup}>
                <Text style={styles.centerSub}>TOTAL SPENT</Text>
                <Text style={styles.centerAmount}>₱ {formatCurrency(totalAmount)}</Text>
                {allowance !== null && allowance > 0 && (
                  <Text style={styles.centerHint}>
                    {((totalAmount / allowance) * 100).toFixed(0)}% of allowance
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerCutout: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.white,
    borderRadius: 9999,
    ...THEME.shadow.soft,
  },
  centerTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  centerTextGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryDot: {
    borderRadius: 4,
    height: 8,
    marginBottom: 4,
    width: 8,
  },
  centerCategory: {
    color: THEME.colors.textDark,
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 110,
    textAlign: 'center',
  },
  centerSub: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  centerAmount: {
    color: THEME.colors.textDark,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  centerPercentage: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  centerHint: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});

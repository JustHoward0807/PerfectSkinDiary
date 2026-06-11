import { useRef, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, Pressable,
  PanResponder, Animated, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IOSColors, Colors, Radius } from '../../../theme';
import type { ComparisonFullscreenProps } from './ComparisonFullscreen.types';

export default function ComparisonFullscreenIOS({ visible, day1Uri, goalUri, onClose }: ComparisonFullscreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();

  const ctnWidthRef = useRef(screenWidth);
  const [containerWidth, setContainerWidth] = useState(screenWidth);
  const clipWidthAnim = useRef(new Animated.Value(screenWidth * 0.5)).current;
  const dividerLeftAnim = useRef(new Animated.Value(screenWidth * 0.5 - 1)).current;

  const moveSlider = (x: number) => {
    const clamped = Math.max(2, Math.min(ctnWidthRef.current - 2, x));
    clipWidthAnim.setValue(clamped);
    dividerLeftAnim.setValue(clamped - 1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => moveSlider(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => moveSlider(evt.nativeEvent.locationX),
    })
  ).current;

  const handleShow = () => {
    clipWidthAnim.setValue(screenWidth * 0.5);
    dividerLeftAnim.setValue(screenWidth * 0.5 - 1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={handleShow}
    >
      {/* Slider layer — PanResponder covers the full screen */}
      <View
        style={[styles.slider, { width: screenWidth, height: screenHeight }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          ctnWidthRef.current = w;
          setContainerWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        {/* Layer 1: Goal image (full, behind) */}
        {goalUri ? (
          <Image source={{ uri: goalUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Ionicons name="image-outline" size={52} color="rgba(255,255,255,0.3)" />
            <Text style={styles.placeholderText}>Goal image unavailable</Text>
          </View>
        )}

        {/* Layer 2: Day 1 (clipped to left portion) */}
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden', width: clipWidthAnim }}>
          {day1Uri ? (
            <Image
              source={{ uri: day1Uri }}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: containerWidth }}
              contentFit="cover"
            />
          ) : (
            <View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: containerWidth }, styles.placeholder]}>
              <Ionicons name="person-outline" size={52} color="rgba(255,255,255,0.3)" />
            </View>
          )}
        </Animated.View>

        {/* Layer 3: Divider */}
        <Animated.View pointerEvents="none" style={[styles.divider, { left: dividerLeftAnim }]}>
          <BlurView intensity={60} tint="light" style={styles.dividerHandle}>
            <Ionicons name="code" size={16} color={IOSColors.label} />
          </BlurView>
        </Animated.View>

        {/* Layer 4: UI overlay — box-none so touches on empty areas reach the PanResponder */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* DAY 1 label — bottom-left */}
          <BlurView
            intensity={50}
            tint="dark"
            style={[styles.labelDay1, { bottom: bottom + 20 }]}
            pointerEvents="none"
          >
            <Text style={styles.labelText}>DAY 1</Text>
          </BlurView>

          {/* GOAL label — bottom-right */}
          <BlurView
            intensity={50}
            tint="dark"
            style={[styles.labelGoal, { bottom: bottom + 20 }]}
            pointerEvents="none"
          >
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
            <Text style={styles.labelText}> GOAL</Text>
          </BlurView>

          {/* Close button — top-right */}
          <Pressable
            style={[styles.closeBtn, { top: top + 12 }]}
            onPress={onClose}
            hitSlop={12}
          >
            <BlurView intensity={60} tint="dark" style={styles.closeBtnInner}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </BlurView>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  slider: {
    backgroundColor: '#000',
  },
  placeholder: {
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placeholderText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },

  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerHandle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  labelDay1: {
    position: 'absolute',
    left: 16,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  labelGoal: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  closeBtn: {
    position: 'absolute',
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeBtnInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

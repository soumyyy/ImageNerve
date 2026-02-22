import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, onPress }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  if (onPress) {
    return (
      <TouchableWithoutFeedback
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 12, stiffness: 200 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10, stiffness: 150 });
        }}
        onPress={onPress}
      >
        <Animated.View style={[styles.glassCard, style, animatedStyle]}>
          {children}
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }
  return (
    <View style={[styles.glassCard, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 8,
  },
}); 
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ShimmerProps {
  style?: ViewStyle;
  borderRadius?: number;
}

export const Shimmer: React.FC<ShimmerProps> = ({ style, borderRadius = 0 }) => {
  const translateX = useRef(new Animated.Value(-220)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 220,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [translateX]);

  return (
    <View style={[styles.container, style, { borderRadius }]}>      
      <Animated.View style={[styles.shimmerOverlay, { transform: [{ translateX }] }]}>        
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(255,255,255,0.12)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default Shimmer;


import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.glassCard, style]} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
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
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MainScreen } from './src/screens/MainScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" backgroundColor="#000" translucent={false} />
        <MainScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
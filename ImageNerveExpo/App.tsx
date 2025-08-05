import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'settings'>('dashboard');

  const navigateToSettings = () => setCurrentScreen('settings');
  const navigateToDashboard = () => setCurrentScreen('dashboard');

  return (
    <SafeAreaProvider>
      {currentScreen === 'dashboard' ? (
        <DashboardScreen onSettingsPress={navigateToSettings} />
      ) : (
        <SettingsScreen onBackPress={navigateToDashboard} />
      )}
    </SafeAreaProvider>
  );
}
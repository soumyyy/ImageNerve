import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DashboardScreen } from './DashboardScreen';
import { SettingsScreen } from './SettingsScreen';

export const MainScreen: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'settings'>('dashboard');

  const navigateToSettings = () => setCurrentScreen('settings');
  const navigateToDashboard = () => setCurrentScreen('dashboard');

  const renderMainContent = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen onSettingsPress={navigateToSettings} />;
      case 'settings':
        return <SettingsScreen onBackPress={navigateToDashboard} />;
      default:
        return <DashboardScreen onSettingsPress={navigateToSettings} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mainContent}>{renderMainContent()}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#000',
  },
}); 
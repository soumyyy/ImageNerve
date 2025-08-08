import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from './DashboardScreen';
import { SettingsScreen } from './SettingsScreen';

export const MainScreen: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'settings'>('dashboard');

  const navigateToSettings = () => setCurrentScreen('settings');
  const navigateToDashboard = () => setCurrentScreen('dashboard');
  // Shared overlay removed per new direction

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
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {renderMainContent()}
      </View>

      {/* Shared overlay removed */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  // removed shared overlay styles
}); 
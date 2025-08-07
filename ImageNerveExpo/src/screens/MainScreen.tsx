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
import SharedAlbumsScreen from './SharedAlbumsScreen';

export const MainScreen: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'settings' | 'shared'>('dashboard');
  const [showSharedAlbums, setShowSharedAlbums] = useState(false);

  const navigateToSettings = () => setCurrentScreen('settings');
  const navigateToDashboard = () => setCurrentScreen('dashboard');
  const navigateToShared = () => setCurrentScreen('shared');

  const toggleSharedAlbums = () => {
    setShowSharedAlbums(!showSharedAlbums);
  };

  const renderMainContent = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen onSettingsPress={navigateToSettings} />;
      case 'settings':
        return <SettingsScreen onBackPress={navigateToDashboard} />;
      case 'shared':
        return <SharedAlbumsScreen />;
      default:
        return <DashboardScreen onSettingsPress={navigateToSettings} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {renderMainContent()}
      </View>

      {/* Shared Albums Overlay */}
      {showSharedAlbums && (
        <View style={styles.sharedAlbumsOverlay}>
          <View style={styles.sharedAlbumsContainer}>
            <View style={styles.sharedAlbumsHeader}>
              <Text style={styles.sharedAlbumsTitle}>Shared Albums</Text>
              <TouchableOpacity onPress={toggleSharedAlbums} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <SharedAlbumsScreen />
          </View>
        </View>
      )}

      {/* Swipe Indicator */}
      <TouchableOpacity style={styles.swipeIndicator} onPress={toggleSharedAlbums}>
        <Ionicons name="albums-outline" size={20} color="#e94560" />
        <Text style={styles.swipeText}>View shared albums</Text>
      </TouchableOpacity>
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
  sharedAlbumsOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '80%',
    height: '100%',
    backgroundColor: '#1a1a2e',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
  },
  sharedAlbumsContainer: {
    flex: 1,
  },
  sharedAlbumsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sharedAlbumsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  swipeIndicator: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  swipeText: {
    fontSize: 12,
    color: '#e94560',
    marginLeft: 4,
    fontWeight: '500',
  },
}); 
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUserId } from '../config/user';
import { photosAPI, facesAPI } from '../services/api';
import FaceProfileWizard from '../components/FaceProfileWizard';

interface SettingsScreenProps {
  onBackPress?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBackPress }) => {
  const [userStats, setUserStats] = useState({
    totalPhotos: 0,
    totalSize: 0,
    username: 'User',
  });
  const [showWizard, setShowWizard] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ exists: boolean; threshold?: number } | null>(null);
  const [loadingProfileStatus, setLoadingProfileStatus] = useState(true);

  useEffect(() => {
    loadUserStats();
    loadProfileStatus();
  }, []);

  // Refresh profile status when wizard is closed (in case user cancelled)
  useEffect(() => {
    if (!showWizard) {
      loadProfileStatus();
    }
  }, [showWizard]);

  const loadUserStats = async () => {
    try {
      const userId = getCurrentUserId();
      const photos = await photosAPI.getUserPhotos(userId);

      // Calculate total size (assuming average 2MB per photo)
      const totalSize = photos.length * 2 * 1024 * 1024; // 2MB per photo

      setUserStats({
        totalPhotos: photos.length,
        totalSize,
        username: 'Test User',
      });
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const loadProfileStatus = async () => {
    try {
      const userId = getCurrentUserId();
      const status = await facesAPI.getProfileStatus(userId);
      setProfileStatus(status);
    } catch (error) {
      console.error('Failed to load profile status:', error);
      // Default to no profile if API fails
      setProfileStatus({ exists: false });
    } finally {
      setLoadingProfileStatus(false);
    }
  };

  const handleFaceProfileAction = () => {
    setShowWizard(true);
  };

  const handleProfileSaved = async (data: any) => {
    console.log('Profile face saved', data);
    // Reload profile status after saving
    await loadProfileStatus();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{userStats.username.charAt(0)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userStats.username}</Text>
              <Text style={styles.profileEmail}>user@example.com</Text>
            </View>
          </View>
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage</Text>
          <View style={styles.storageCard}>
            <View style={styles.storageItem}>
              <Text style={styles.storageLabel}>Total Photos</Text>
              <Text style={styles.storageValue}>{userStats.totalPhotos}</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageLabel}>Total Size</Text>
              <Text style={styles.storageValue}>{formatFileSize(userStats.totalSize)}</Text>
            </View>
            <View style={styles.storageProgress}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min((userStats.totalSize / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {formatFileSize(userStats.totalSize)} of 5 GB used
              </Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Edit Profile</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Change Password</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Privacy Settings</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Face Recognition Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Face Recognition</Text>
          {loadingProfileStatus ? (
            <View style={styles.settingItem}>
              <Text style={[styles.settingText, { color: 'rgba(255, 255, 255, 0.5)' }]}>
                Loading profile status...
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.settingItem} onPress={handleFaceProfileAction}>
                <View style={styles.settingContent}>
                  <Text style={styles.settingText}>
                    {profileStatus?.exists ? 'Recalibrate Profile' : 'Set My Face Profile'}
                  </Text>
                  {profileStatus?.exists && profileStatus.threshold && (
                    <Text style={styles.settingSubtext}>
                      Threshold: {profileStatus.threshold.toFixed(2)}
                    </Text>
                  )}
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>

              {profileStatus?.exists ? (
                <View style={styles.statusCard}>
                  <Text style={styles.statusText}>✅ Face profile configured</Text>
                  <Text style={styles.statusSubtext}>
                    Your photos will appear in the "Me" tab
                  </Text>
                </View>
              ) : (
                <View style={[styles.statusCard, { backgroundColor: 'rgba(255, 193, 7, 0.15)', borderLeftColor: '#FFC107' }]}>
                  <Text style={[styles.statusText, { color: '#FFC107' }]}>⚠️ No face profile set</Text>
                  <Text style={[styles.statusSubtext, { color: 'rgba(255, 193, 7, 0.8)' }]}>
                    Set your face profile to see your photos in the "Me" tab
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* General Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Notifications</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Auto Backup</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Data Usage</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Help Center</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Privacy Policy</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Terms of Service</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => Alert.alert('Logout', 'Logout functionality coming soon!')}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <FaceProfileWizard
        visible={showWizard}
        userId={getCurrentUserId()}
        onClose={() => setShowWizard(false)}
        onSaved={handleProfileSaved}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 15,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  storageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
  },
  storageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storageLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  storageValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  storageProgress: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  settingItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingText: {
    fontSize: 17,
    color: '#ffffff',
  },
  settingSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statusCard: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 13,
    color: 'rgba(0, 122, 255, 0.8)',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
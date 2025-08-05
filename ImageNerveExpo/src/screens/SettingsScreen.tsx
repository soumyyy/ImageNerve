import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { facesAPI } from '../services/api';
import { GlassCard } from '../components/GlassCard';

export const SettingsScreen: React.FC = () => {
  const [clustering, setClustering] = useState(false);
  const [clusters, setClusters] = useState([]);
  const userId = 'test-user-001'; // Test user ID

  const handleClusterFaces = async () => {
    setClustering(true);
    try {
      const result = await facesAPI.clusterFaces(userId);
      Alert.alert('Success!', `Created ${result.clusters?.length || 0} face clusters`);
      
      // Load clusters
      const userClusters = await facesAPI.getClusters(userId);
      setClusters(userClusters);
    } catch (error) {
      console.error('Clustering error:', error);
      Alert.alert('Error', 'Failed to cluster faces. Please try again.');
    } finally {
      setClustering(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.settingsTitle}>Settings</Text>
        
        <GlassCard style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>User Profile</Text>
          <View style={styles.profileItem}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>Soumya</Text>
          </View>
          <View style={styles.profileItem}>
            <Text style={styles.label}>Mail</Text>
            <Text style={styles.value}>soumya@example.com</Text>
          </View>
          <View style={styles.profileItem}>
            <Text style={styles.label}>Number</Text>
            <Text style={styles.value}>+91 98765 43210</Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Face Recognition</Text>
          <TouchableOpacity 
            style={[styles.glassButton, clustering && styles.buttonDisabled]} 
            onPress={handleClusterFaces}
            disabled={clustering}
            activeOpacity={0.8}
          >
            {clustering ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.glassButtonText}>Clustering Faces...</Text>
              </View>
            ) : (
              <Text style={styles.glassButtonText}>🤖 Cluster My Faces</Text>
            )}
          </TouchableOpacity>
          
          {clusters.length > 0 && (
            <GlassCard style={styles.clusterInfo}>
              <Text style={styles.label}>Face Clusters: {clusters.length}</Text>
            </GlassCard>
          )}
        </GlassCard>
        
        <TouchableOpacity style={styles.glassLogoutButton} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  settingsTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 30,
  },
  settingsSection: {
    marginBottom: 24,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  value: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  glassButton: {
    backgroundColor: '#e94560',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  glassButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clusterInfo: {
    marginTop: 16,
    padding: 16,
  },
  glassLogoutButton: {
    backgroundColor: '#e94560',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 
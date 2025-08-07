import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface SharedAlbum {
  share_id: string;
  album_id: string;
  album_name: string;
  album_description?: string;
  shared_by: string;
  shared_by_name: string;
  permissions: 'view' | 'edit' | 'admin';
  shared_at: string;
  accepted_at?: string;
  photo_count: number;
  cover_photo_url?: string;
}

interface PendingShare {
  share_id: string;
  album_id: string;
  album_name: string;
  album_description?: string;
  shared_by: string;
  shared_by_name: string;
  permissions: 'view' | 'edit' | 'admin';
  shared_at: string;
  photo_count: number;
}

const SharedAlbumsScreen: React.FC = () => {
  const [sharedAlbums, setSharedAlbums] = useState<SharedAlbum[]>([]);
  const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'shared' | 'pending'>('shared');

  // Mock data for testing
  useEffect(() => {
    loadSharedAlbums();
  }, []);

  const loadSharedAlbums = async () => {
    // TODO: Replace with actual API call
    const mockSharedAlbums: SharedAlbum[] = [
      {
        share_id: '1',
        album_id: 'album1',
        album_name: 'Wedding Photos',
        album_description: 'Beautiful wedding memories',
        shared_by: 'user1',
        shared_by_name: 'John Doe',
        permissions: 'view',
        shared_at: '2024-01-15T10:00:00Z',
        accepted_at: '2024-01-15T10:30:00Z',
        photo_count: 45,
        cover_photo_url: 'https://example.com/cover1.jpg',
      },
      {
        share_id: '2',
        album_id: 'album2',
        album_name: 'Family Vacation',
        album_description: 'Summer vacation memories',
        shared_by: 'user2',
        shared_by_name: 'Jane Smith',
        permissions: 'edit',
        shared_at: '2024-01-10T14:00:00Z',
        accepted_at: '2024-01-10T15:00:00Z',
        photo_count: 23,
        cover_photo_url: 'https://example.com/cover2.jpg',
      },
    ];

    const mockPendingShares: PendingShare[] = [
      {
        share_id: '3',
        album_id: 'album3',
        album_name: 'Birthday Party',
        album_description: 'Birthday celebration photos',
        shared_by: 'user3',
        shared_by_name: 'Mike Johnson',
        permissions: 'view',
        shared_at: '2024-01-20T09:00:00Z',
        photo_count: 12,
      },
    ];

    setSharedAlbums(mockSharedAlbums);
    setPendingShares(mockPendingShares);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSharedAlbums();
    setRefreshing(false);
  };

  const handleAcceptShare = async (shareId: string) => {
    try {
      // TODO: Replace with actual API call
      Alert.alert('Success', 'Album share accepted!');
      // Remove from pending and add to shared
      const shareToAccept = pendingShares.find(s => s.share_id === shareId);
      if (shareToAccept) {
        setPendingShares(prev => prev.filter(s => s.share_id !== shareId));
        setSharedAlbums(prev => [...prev, { ...shareToAccept, accepted_at: new Date().toISOString() }]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept share');
    }
  };

  const handleDeclineShare = async (shareId: string) => {
    try {
      // TODO: Replace with actual API call
      Alert.alert('Success', 'Album share declined');
      setPendingShares(prev => prev.filter(s => s.share_id !== shareId));
    } catch (error) {
      Alert.alert('Error', 'Failed to decline share');
    }
  };

  const renderSharedAlbum = (album: SharedAlbum) => (
    <TouchableOpacity key={album.share_id} style={styles.albumCard}>
      <View style={styles.albumHeader}>
        <View style={styles.albumInfo}>
          <Text style={styles.albumName}>{album.album_name}</Text>
          <Text style={styles.albumDescription}>{album.album_description}</Text>
          <Text style={styles.sharedBy}>Shared by {album.shared_by_name}</Text>
        </View>
        <View style={styles.permissionBadge}>
          <Text style={styles.permissionText}>{album.permissions}</Text>
        </View>
      </View>
      
      <View style={styles.albumFooter}>
        <View style={styles.photoCount}>
          <Ionicons name="images-outline" size={16} color="#cccccc" />
          <Text style={styles.photoCountText}>{album.photo_count} photos</Text>
        </View>
        <Text style={styles.acceptedDate}>
          Accepted {new Date(album.accepted_at!).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderPendingShare = (share: PendingShare) => (
    <View key={share.share_id} style={styles.pendingCard}>
      <View style={styles.pendingHeader}>
        <View style={styles.pendingInfo}>
          <Text style={styles.albumName}>{share.album_name}</Text>
          <Text style={styles.albumDescription}>{share.album_description}</Text>
          <Text style={styles.sharedBy}>Shared by {share.shared_by_name}</Text>
        </View>
        <View style={styles.permissionBadge}>
          <Text style={styles.permissionText}>{share.permissions}</Text>
        </View>
      </View>
      
      <View style={styles.pendingFooter}>
        <View style={styles.photoCount}>
          <Ionicons name="images-outline" size={16} color="#cccccc" />
          <Text style={styles.photoCountText}>{share.photo_count} photos</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptShare(share.share_id)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDeclineShare(share.share_id)}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shared Albums</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.activeTab]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.activeTabText]}>
            Shared ({sharedAlbums.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending ({pendingShares.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'shared' ? (
          sharedAlbums.length > 0 ? (
            sharedAlbums.map(renderSharedAlbum)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={64} color="#cccccc" />
              <Text style={styles.emptyStateText}>No shared albums yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Albums shared with you will appear here
              </Text>
            </View>
          )
        ) : (
          pendingShares.length > 0 ? (
            pendingShares.map(renderPendingShare)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={64} color="#cccccc" />
              <Text style={styles.emptyStateText}>No pending invitations</Text>
              <Text style={styles.emptyStateSubtext}>
                Album share invitations will appear here
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  tabText: {
    fontSize: 16,
    color: '#cccccc',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#e94560',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  albumCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  albumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  albumInfo: {
    flex: 1,
  },
  albumName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  albumDescription: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
  },
  sharedBy: {
    fontSize: 12,
    color: '#999999',
  },
  permissionBadge: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  permissionText: {
    fontSize: 12,
    color: '#e94560',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  albumFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoCountText: {
    fontSize: 14,
    color: '#cccccc',
    marginLeft: 4,
  },
  acceptedDate: {
    fontSize: 12,
    color: '#999999',
  },
  pendingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4caf50',
  },
  acceptButtonText: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '500',
  },
  declineButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#f44336',
  },
  declineButtonText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default SharedAlbumsScreen; 
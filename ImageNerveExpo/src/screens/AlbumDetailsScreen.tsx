import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { albumsAPI } from '../services/api';
import { Photo } from '../types';
import { PhotoImage } from '../components/PhotoImage';

interface AlbumDetailsScreenProps {
  albumId: string;
  userId: string;
  onBack?: () => void;
}

export const AlbumDetailsScreen: React.FC<AlbumDetailsScreenProps> = ({ albumId, userId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [album, setAlbum] = useState<any>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, p, s] = await Promise.all([
          albumsAPI.getAlbum(albumId, userId),
          albumsAPI.getAlbumPhotos(albumId, userId),
          albumsAPI.getAlbumStats(albumId, userId),
        ]);
        setAlbum(a);
        setPhotos(p.photos);
        setStats(s);
      } catch (e) {
        // noop basic
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId, userId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>{album?.name || 'Album'}</Text>
        <View style={{ width: 32 }} />
      </View>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color="#fff" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.metaPrimary}>{stats?.photo_count ?? photos.length} items · Owner: {album?.owner_id?.slice(0,8)}</Text>
          <Text style={styles.metaSecondary}>
            Created {new Date(album?.created_at || Date.now()).toDateString()}
          </Text>
          {!!album?.description && <Text style={styles.description}>{album.description}</Text>}

          <View style={styles.grid}>
            {photos.map((p) => (
              <View key={p.id} style={styles.gridItem}>
                <PhotoImage photo={p} userId={userId} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)' },
  backText: { color: '#fff', fontSize: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  metaPrimary: { color: '#fff', fontSize: 16, fontWeight: '600' },
  metaSecondary: { color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  description: { color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  gridItem: { width: '33.3333%', aspectRatio: 1 },
});

export default AlbumDetailsScreen;


import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { albumsAPI, photosAPI, facesAPI } from '../services/api';
import { Photo } from '../types';
import { PhotoImage } from '../components/PhotoImage';
import { pickImages, MULTI_PICK_LIMIT } from '../utils/imageUtils';
import { uploadPhotosBatch } from '../utils/uploadPhotos';

const { width: screenWidth } = Dimensions.get('window');

interface AlbumDetailsScreenProps {
  albumId: string;
  userId: string;
  onBack: () => void;
  onOpenPhoto?: (index: number, photos: Photo[]) => void;
}

const getItemSize = () => screenWidth / 3;

export const AlbumDetailsScreen: React.FC<AlbumDetailsScreenProps> = ({ albumId, userId, onBack, onOpenPhoto }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Debounce clustering similar to dashboard
  const clusterDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isClusteringRef = useRef<boolean>(false);
  const scheduleClusterRefresh = useCallback(() => {
    try {
      if (clusterDebounceRef.current) clearTimeout(clusterDebounceRef.current);
      clusterDebounceRef.current = setTimeout(async () => {
        if (isClusteringRef.current) return;
        isClusteringRef.current = true;
        try {
          console.log('🧠 Triggering face clustering (debounced) from AlbumDetails...');
          await facesAPI.clusterFaces(userId);
          console.log('✅ Face clustering complete');
        } catch (err: any) {
          console.warn('⚠️ Failed to run clustering:', err?.message || String(err));
        } finally {
          isClusteringRef.current = false;
        }
      }, 2000);
    } catch { }
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const album = await albumsAPI.getAlbum(albumId, userId);
        setTitle(album.name);
        const res = await albumsAPI.getAlbumPhotos(albumId, userId);
        setPhotos(res.photos);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId, userId]);

  const renderItem = ({ item, index }: { item: Photo; index: number }) => (
    <TouchableOpacity onPress={() => onOpenPhoto?.(index, photos)} activeOpacity={0.7} style={{ width: getItemSize(), height: getItemSize() }}>
      <PhotoImage photo={item} userId={userId} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Album</Text></View>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const uploadToThisAlbum = async () => {
    try {
      setUploading(true);
      const images = await pickImages(MULTI_PICK_LIMIT);
      if (!images.length) return;
      setUploadProgress({ current: 0, total: images.length });
      const { uploadedPhotos } = await uploadPhotosBatch(userId, images, {
        targetAlbumId: albumId,
        onProgress: (current, total) => setUploadProgress({ current, total }),
      });
      scheduleClusterRefresh();
      setPhotos(prev => [...uploadedPhotos, ...prev]);
      const total = uploadedPhotos.length;
      Alert.alert('Success', total === 1 ? 'Photo added to album' : `${total} photos added to album`);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Unable to upload');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <View style={styles.container}>
      {uploading && uploadProgress && (
        <View style={styles.uploadProgressOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadProgressText}>
            Uploading {uploadProgress.current}/{uploadProgress.total}
          </Text>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity onPress={uploadToThisAlbum} disabled={uploading} style={[styles.addBtn, uploading && { opacity: 0.6 }]}>
          <Text style={styles.addText}>＋</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={photos}
        renderItem={renderItem}
        keyExtractor={(p) => p.id}
        numColumns={3}
        initialNumToRender={24}
        removeClippedSubviews
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 24 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 20 },
  uploadProgressOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  uploadProgressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    fontWeight: '600',
  },
});

export default AlbumDetailsScreen;


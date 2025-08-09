import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { albumsAPI } from '../services/api';
import { Photo } from '../types';
import { PhotoImage } from '../components/PhotoImage';
import { pickImage } from '../utils/imageUtils';
import { getMimeType } from '../utils/fileUtils';
import { photosAPI } from '../services/api';

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
      const imageResult = await pickImage();
      if (!imageResult) return;
      const uploadUrlResponse = await photosAPI.getUploadUrl(imageResult.name, userId);
      const mimeType = getMimeType(imageResult.name);
      const blob = await fetch(imageResult.uri).then(r => r.blob());
      const putResp = await fetch(uploadUrlResponse.upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': mimeType } });
      if (!putResp.ok) throw new Error(`S3 upload failed ${putResp.status}`);
      const photoData = {
        user_id: userId,
        s3_url: uploadUrlResponse.file_url,
        filename: uploadUrlResponse.sanitizedFilename || uploadUrlResponse.filename,
        description: 'Uploaded from mobile app',
        is_public: false,
        album_ids: [albumId],
        skip_default_album: true,
        photo_metadata: {
          file_size: (blob as any).size,
          format: mimeType,
          uploaded_from: 'mobile_app',
          upload_timestamp: new Date().toISOString(),
        },
      } as any;
      const created = await photosAPI.createPhoto(photoData);
      setPhotos(prev => [created, ...prev]);
      Alert.alert('Success', 'Photo added to album');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Unable to upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
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
});

export default AlbumDetailsScreen;


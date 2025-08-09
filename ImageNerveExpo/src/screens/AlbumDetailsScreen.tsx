import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { albumsAPI } from '../services/api';
import { Photo } from '../types';
import { PhotoImage } from '../components/PhotoImage';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
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
});

export default AlbumDetailsScreen;


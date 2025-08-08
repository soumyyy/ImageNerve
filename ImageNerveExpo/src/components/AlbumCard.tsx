import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Photo } from '../types';

interface AlbumCardProps {
  title: string;
  count: number;
  photos: Photo[];
  onPress?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const cardSize = Math.min(140, Math.floor(screenWidth / 3));

export const AlbumCard: React.FC<AlbumCardProps> = ({ title, count, photos, onPress }) => {
  const previews = photos.slice(0, 4);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.previewGrid}>
        {[0,1,2,3].map(i => (
          <View key={i} style={styles.previewCell}>
            {previews[i] ? (
              <Image source={{ uri: previews[i].s3_url }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.previewPlaceholder} />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.count}>{count} {count === 1 ? 'item' : 'items'}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardSize,
    marginRight: 12,
  },
  previewGrid: {
    width: '100%',
    height: cardSize,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  previewCell: {
    width: '50%',
    height: '50%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  count: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
});

export default AlbumCard;


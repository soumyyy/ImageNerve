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
  const cover = photos?.[0];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.coverWrap}>
        {cover ? (
          <Image source={{ uri: cover.s3_url }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder} />
        )}
        <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.count}>{count === 1 ? '1 item' : `${count} items`}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardSize,
    marginRight: 12,
  },
  coverWrap: {
    width: '100%',
    height: cardSize,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  previewPlaceholder: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  badge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
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


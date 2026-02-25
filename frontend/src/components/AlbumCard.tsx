import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Photo } from '../types';
import { PhotoImage } from './PhotoImage';

interface AlbumCardProps {
  title: string;
  count: number;
  photos: Photo[];
  onPress?: () => void;
  userId: string;
}

const { width: screenWidth } = Dimensions.get('window');
const cardSize = Math.min(140, Math.floor(screenWidth / 3));

export const AlbumCard: React.FC<AlbumCardProps> = ({ title, count, photos, onPress, userId }) => {
  const cover = photos?.[0];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.coverWrap}>
        {cover ? (
          <PhotoImage photo={cover} userId={userId} />
        ) : (
          <View style={styles.previewPlaceholder} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        />
        <View style={styles.overlayRow}>
          <Text style={styles.overlayTitle} numberOfLines={1}>{title}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>
        </View>
      </View>
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
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  coverImage: { width: '100%', height: '100%' },
  previewPlaceholder: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  gradient: { ...StyleSheet.absoluteFillObject },
  overlayRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayTitle: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1, marginRight: 8 },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  title: {
    display: 'none'
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 6,
  },
  count: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
});

export default AlbumCard;


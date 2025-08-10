import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Photo } from '../types';
import { photosAPI } from '../services/api';
import Shimmer from './Shimmer';

interface PhotoImageProps {
  photo: Photo;
  userId: string;  // Add userId prop
  style?: any;  // Add optional style prop
}

export const PhotoImage: React.FC<PhotoImageProps> = ({ photo, userId, style }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const thumbFade = useState(new Animated.Value(0))[0];
  
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
    setImageUrl(null);
    setThumbUrl(null);
    fadeAnim.setValue(0);
    thumbFade.setValue(0);
    loadUrls();
  }, [photo.id]);

  const loadUrls = async () => {
    try {
      // Low-res thumbnail first
      const thumb = photosAPI.getThumbnailUrl(photo.filename, 320, 60);
      setThumbUrl(thumb);
      Animated.timing(thumbFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();

      // Full-res presigned
      const downloadResponse = await photosAPI.getDownloadUrl(photo.filename, userId);
      setImageUrl(downloadResponse.url);
    } catch (error) {
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleImageError = (_error: any) => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  if (hasError) {
    return (
      <View style={styles.photoImageContainer}>
        <View style={styles.photoError}>
          <Text style={styles.photoErrorText}>📷</Text>
          <Text style={styles.photoErrorSubtext}>{photo.filename}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.photoImageContainer}>
      {/* Thumbnail Layer */}
      {thumbUrl && (
        <Animated.View style={[styles.imageContainer, { opacity: thumbFade }]}>        
          <ExpoImage
            source={{ uri: thumbUrl }}
            style={[styles.photoImage, style]}
            contentFit={style ? 'contain' : 'cover'}
            cachePolicy="memory-disk"
            recyclingKey={`${photo.id}-thumb`}
            transition={100}
          />
        </Animated.View>
      )}

      {/* Full-res Layer */}
      {imageUrl ? (
        <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>        
          <ExpoImage
            source={{ uri: imageUrl }}
            style={[styles.photoImage, style]}
            onError={handleImageError}
            onLoad={handleImageLoad as any}
            contentFit={style ? 'contain' : 'cover'}
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={photo.id}
          />
        </Animated.View>
      ) : (
        <Shimmer style={styles.photoLoading} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  photoImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    margin: 0,
    padding: 0,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    backgroundColor: '#000',
    margin: 0,
    padding: 0,
  },
  photoLoading: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
  },
  photoError: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
  },
  photoErrorText: {
    fontSize: 24,
    marginBottom: 4,
  },
  photoErrorSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
}); 
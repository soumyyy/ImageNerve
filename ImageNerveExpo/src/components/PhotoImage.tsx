import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
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
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  useEffect(() => {
    console.log('🖼️ PhotoImage component mounted for:', photo.filename);
    console.log('📋 Photo data:', photo);
    
    // Reset states when photo changes
    setHasError(false);
    setIsLoading(true);
    setImageUrl(null);
    fadeAnim.setValue(0);
    
    loadImageUrl();
  }, [photo.id]); // Re-run when photo.id changes

  const loadImageUrl = async () => {
    try {
      console.log('🔗 Loading URL for:', photo.filename);
      console.log('📋 Photo s3_url:', photo.s3_url);
      
      // Always use presigned URL for better access control
      console.log('🔐 Getting presigned URL for:', photo.filename);
      const downloadResponse = await photosAPI.getDownloadUrl(photo.filename, userId);
      console.log('✅ Presigned URL received:', downloadResponse.url);
      setImageUrl(downloadResponse.url);
    } catch (error) {
      console.log('❌ Presigned URL failed for:', photo.filename, error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleImageError = (error: any) => {
    console.log('Image failed to load:', photo.filename, error.nativeEvent?.error || 'Unknown error');
    setIsLoading(false);
    setHasError(true);
  };

  const handleImageLoad = () => {
    console.log('Image loaded successfully:', photo.filename);
    setIsLoading(false);
    setHasError(false);
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
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

  if (!imageUrl) {
    return (
      <View style={styles.photoImageContainer}>
        <Shimmer style={styles.photoLoading} />
      </View>
    );
  }

  return (
    <View style={styles.photoImageContainer}>
      {isLoading && (
        <Animated.View style={{ position: 'absolute', zIndex: 1, width: '100%', height: '100%', opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
          <Shimmer style={styles.photoLoading} />
        </Animated.View>
      )}
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
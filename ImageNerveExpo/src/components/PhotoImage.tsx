import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Animated } from 'react-native';
import { Photo } from '../types';
import { photosAPI } from '../services/api';

interface PhotoImageProps {
  photo: Photo;
}

export const PhotoImage: React.FC<PhotoImageProps> = ({ photo }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  useEffect(() => {
    console.log('🖼️ PhotoImage component mounted for:', photo.filename);
    console.log('📋 Photo data:', photo);
    loadImageUrl();
  }, []);

  const loadImageUrl = async () => {
    try {
      console.log('🔗 Loading URL for:', photo.filename);
      console.log('📋 Photo s3_url:', photo.s3_url);
      
      // Always use presigned URL for better access control
      console.log('🔐 Getting presigned URL for:', photo.filename);
      const downloadResponse = await photosAPI.getDownloadUrl(photo.filename);
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

  if (!imageUrl) {
    return (
      <View style={styles.photoImageContainer}>
        <View style={styles.photoLoading}>
          <ActivityIndicator size="small" color="#e94560" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.photoImageContainer}>
      {isLoading && (
        <View style={[styles.photoLoading, { position: 'absolute', zIndex: 1 }]}>
          <ActivityIndicator size="small" color="#e94560" />
        </View>
      )}
      <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
        <Image 
          source={{ uri: imageUrl }}
          style={styles.photoImage}
          onError={handleImageError}
          onLoad={handleImageLoad}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  photoImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoLoading: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    width: '100%',
    height: '100%',
  },
  photoError: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    width: '100%',
    height: '100%',
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
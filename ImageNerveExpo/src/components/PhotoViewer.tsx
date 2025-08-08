import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { photosAPI } from '../services/api';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Photo } from '../types';
import { PhotoImage } from './PhotoImage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  userId: string;
  onClose: () => void;
  onDeleted?: (photoId: string) => void;
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photos,
  initialIndex,
  userId,
  onClose,
  onDeleted,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const metadataAnim = useRef(new Animated.Value(0)).current;
  const slideDirection = useRef<'left' | 'right' | null>(null);

  // Update currentPhoto when currentIndex changes
  const currentPhoto = photos[currentIndex];
  const nextPhoto = currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null;
  const prevPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;
  
  console.log('📸 Current photo:', currentPhoto?.filename, 'Index:', currentIndex);

  // Reset metadata panel when photo changes
  useEffect(() => {
    console.log('🔄 Photo index changed to:', currentIndex);
    if (showMetadata) {
      setShowMetadata(false);
      metadataAnim.setValue(0);
    }
  }, [currentIndex]);

  const handleSwipe = (direction: 'left' | 'right') => {
    console.log('🔄 Swiping:', direction, 'Current index:', currentIndex, 'Total photos:', photos.length);
    
    if (direction === 'left' && currentIndex < photos.length - 1) {
      const newIndex = currentIndex + 1;
      console.log('➡️ Moving to next photo:', newIndex);
      
      // Set slide direction for animation
      slideDirection.current = 'left';
      
      // Animate slide out
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(newIndex);
        // Reset slide position
        slideAnim.setValue(screenWidth);
        // Animate slide in
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
      
    } else if (direction === 'right' && currentIndex > 0) {
      const newIndex = currentIndex - 1;
      console.log('⬅️ Moving to previous photo:', newIndex);
      
      // Set slide direction for animation
      slideDirection.current = 'right';
      
      // Animate slide out
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(newIndex);
        // Reset slide position
        slideAnim.setValue(-screenWidth);
        // Animate slide in
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const toggleMetadata = () => {
    const toValue = showMetadata ? 0 : 1;
    setShowMetadata(!showMetadata);
    
    Animated.spring(metadataAnim, {
      toValue,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleDownload = async () => {
    try {
      console.log('⬇️ Download requested for index', currentIndex, 'photo', currentPhoto?.id, currentPhoto?.filename);
      const filename = currentPhoto.filename;
      const { url } = await photosAPI.getDownloadUrl(filename, userId);
      console.log('Download URL received:', url);
      if (Platform.OS === 'web') {
        // Web: download via backend proxy to avoid S3 CORS
        const streamUrl = photosAPI.getWebDownloadStreamUrl(filename);
        const objectUrl = streamUrl; // Let browser handle streaming download
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename || 'image.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const tmpPath = `${FileSystem.cacheDirectory}${filename}`;
      const { uri } = await FileSystem.downloadAsync(url, tmpPath);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Media Library permission denied');
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('ImageNerve', asset, false);
      Alert.alert('Saved', 'Photo saved to your library.');
    } catch (e: any) {
      console.error('Download error:', e);
      if (Platform.OS === 'ios' && await Sharing.isAvailableAsync()) {
        try {
          const filename = currentPhoto.filename;
          const { url } = await photosAPI.getDownloadUrl(filename, userId);
          await Sharing.shareAsync(url);
          return;
        } catch {}
      }
      Alert.alert('Download failed', e?.message || 'Unable to save photo');
    }
  };

  const handleDelete = () => {
    console.log('🗑️ Delete requested for index', currentIndex, 'photo', currentPhoto?.id);

    const performDelete = async () => {
      try {
        console.log('Calling delete API...');
        await photosAPI.deletePhoto(currentPhoto.id, userId);
        if (Platform.OS !== 'web') {
          Alert.alert('Deleted', 'Photo has been deleted');
        }
        if (onDeleted) onDeleted(currentPhoto.id);
        if (currentIndex < photos.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        } else {
          onClose();
        }
      } catch (e: any) {
        console.error('Delete error:', e);
        if (Platform.OS !== 'web') {
          Alert.alert('Delete failed', e?.message || 'Unable to delete photo');
        }
      }
    };

    if (Platform.OS === 'web') {
      // Web: use confirm() since Alert buttons do not work in RN Web
      // eslint-disable-next-line no-alert
      const ok = (globalThis as any).confirm?.('Delete Photo? This action cannot be undone.') ?? false;
      if (ok) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete }
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLocation = (location: any) => {
    if (!location) return 'Not available';
    if (typeof location === 'string') return location;
    if (location.coordinates) {
      return `${location.coordinates[1].toFixed(4)}, ${location.coordinates[0].toFixed(4)}`;
    }
    return JSON.stringify(location);
  };

  const extractImageMetadata = (photo: Photo) => {
    const metadata = photo.photo_metadata || {};
    const extracted = {
      // Basic Info
      filename: photo.filename,
      uploadedAt: photo.uploaded_at,
      description: photo.description,
      isPublic: photo.is_public,
      tags: photo.tags || [],
      location: photo.location,
      
      // Image Metadata (from photo_metadata)
      dimensions: metadata.dimensions || 'Unknown',
      fileSize: metadata.file_size || 'Unknown',
      format: metadata.format || 'Unknown',
      colorSpace: metadata.color_space || 'Unknown',
      dpi: metadata.dpi || 'Unknown',
      
      // Camera Info
      camera: metadata.camera || 'Unknown',
      lens: metadata.lens || 'Unknown',
      focalLength: metadata.focal_length || 'Unknown',
      aperture: metadata.aperture || 'Unknown',
      shutterSpeed: metadata.shutter_speed || 'Unknown',
      iso: metadata.iso || 'Unknown',
      
      // GPS Info
      gpsLatitude: metadata.gps_latitude || 'Unknown',
      gpsLongitude: metadata.gps_longitude || 'Unknown',
      gpsAltitude: metadata.gps_altitude || 'Unknown',
      
      // Additional Info
      software: metadata.software || 'Unknown',
      artist: metadata.artist || 'Unknown',
      copyright: metadata.copyright || 'Unknown',
      orientation: metadata.orientation || 'Unknown',
      
      // Upload Info
      uploadedFrom: metadata.uploaded_from || 'Unknown',
      uploadTimestamp: metadata.upload_timestamp || 'Unknown',
      
      // Custom fields
      customFields: Object.keys(metadata).filter(key => 
        !['dimensions', 'file_size', 'format', 'color_space', 'dpi', 
          'camera', 'lens', 'focal_length', 'aperture', 'shutter_speed', 'iso',
          'gps_latitude', 'gps_longitude', 'gps_altitude', 'software', 'artist', 
          'copyright', 'orientation', 'uploaded_from', 'upload_timestamp'].includes(key)
      ).map(key => ({ key, value: metadata[key] }))
    };
    
    return extracted;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentIndex + 1} of {photos.length}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Photo Display */}
        <View style={styles.photoContainer}>
          {/* Preloaded Previous Photo (hidden) */}
          {prevPhoto && (
            <View style={[styles.preloadedPhoto, { left: -screenWidth }]}>
              <PhotoImage 
                photo={prevPhoto} 
                userId={userId}
                style={styles.fullPhoto}
              />
            </View>
          )}
          
          {/* Current Photo */}
          <Animated.View style={{
            transform: [{ translateX: slideAnim }]
          }}>
            <PhotoImage 
              photo={currentPhoto} 
              userId={userId}
              style={styles.fullPhoto}
            />
          </Animated.View>
          
          {/* Preloaded Next Photo (hidden) */}
          {nextPhoto && (
            <View style={[styles.preloadedPhoto, { right: -screenWidth }]}>
              <PhotoImage 
                photo={nextPhoto} 
                userId={userId}
                style={styles.fullPhoto}
              />
            </View>
          )}
        </View>

        {/* Liquid Glass Dock */}
        <View style={styles.dockWrapper} pointerEvents="box-none">
          <View style={styles.dock} pointerEvents="box-none">
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject as any} pointerEvents="none" />
            <View style={styles.dockContent}>
            {/* Navigation */}
            <View style={styles.dockLeft}>
              {currentIndex > 0 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.dockButton}
                  onPress={() => handleSwipe('right')}
                >
                  <Text style={styles.dockButtonText}>‹</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Center Actions */}
            <View style={styles.dockCenter}>
              <TouchableOpacity 
                accessibilityRole="button"
                style={styles.dockButton}
                onPress={toggleMetadata}
              >
                <Text style={styles.dockButtonText}>i</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                accessibilityRole="button"
                style={styles.dockButton}
                onPress={() => handleDownload()}
              >
                <Text style={styles.dockButtonText}>↓</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                accessibilityRole="button"
                style={styles.dockButton}
                onPress={() => handleDelete()}
              >
                <Text style={styles.dockButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Navigation */}
            <View style={styles.dockRight}>
              {currentIndex < photos.length - 1 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.dockButton}
                  onPress={() => handleSwipe('left')}
                >
                  <Text style={styles.dockButtonText}>›</Text>
                </TouchableOpacity>
              )}
            </View>
            </View>
          </View>
        </View>

        {/* Metadata Panel */}
        <Animated.View
          pointerEvents={showMetadata ? 'auto' : 'none'}
          style={[
            styles.metadataPanel,
            {
              zIndex: showMetadata ? 100 : -1,
              transform: [
                {
                  translateY: metadataAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [screenHeight, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.metadataContent}>
            <View style={styles.metadataHeader}>
              <Text style={styles.metadataTitle}>Photo Details</Text>
              <TouchableOpacity onPress={toggleMetadata}>
                <Text style={styles.closeMetadataText}>×</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.metadataScroll}>
              {(() => {
                const metadata = extractImageMetadata(currentPhoto);
                
                return (
                  <>
                    {/* Basic Information */}
                    <View style={styles.metadataSection}>
                      <Text style={styles.metadataSectionTitle}>Basic Information</Text>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Filename</Text>
                        <Text style={styles.metadataValue}>{metadata.filename}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Uploaded</Text>
                        <Text style={styles.metadataValue}>
                          {formatDate(metadata.uploadedAt)}
                        </Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Description</Text>
                        <Text style={styles.metadataValue}>
                          {metadata.description || 'No description'}
                        </Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Public</Text>
                        <Text style={styles.metadataValue}>
                          {metadata.isPublic ? 'Yes' : 'No'}
                        </Text>
                      </View>
                      
                      {metadata.tags.length > 0 && (
                        <View style={styles.metadataItem}>
                          <Text style={styles.metadataLabel}>Tags</Text>
                          <Text style={styles.metadataValue}>
                            {metadata.tags.join(', ')}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Location</Text>
                        <Text style={styles.metadataValue}>
                          {formatLocation(metadata.location)}
                        </Text>
                      </View>
                    </View>

                    {/* Image Information */}
                    <View style={styles.metadataSection}>
                      <Text style={styles.metadataSectionTitle}>Image Information</Text>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Dimensions</Text>
                        <Text style={styles.metadataValue}>{metadata.dimensions}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>File Size</Text>
                        <Text style={styles.metadataValue}>{metadata.fileSize}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Format</Text>
                        <Text style={styles.metadataValue}>{metadata.format}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Color Space</Text>
                        <Text style={styles.metadataValue}>{metadata.colorSpace}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>DPI</Text>
                        <Text style={styles.metadataValue}>{metadata.dpi}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Orientation</Text>
                        <Text style={styles.metadataValue}>{metadata.orientation}</Text>
                      </View>
                    </View>

                    {/* Camera Information */}
                    <View style={styles.metadataSection}>
                      <Text style={styles.metadataSectionTitle}>Camera Information</Text>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Camera</Text>
                        <Text style={styles.metadataValue}>{metadata.camera}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Lens</Text>
                        <Text style={styles.metadataValue}>{metadata.lens}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Focal Length</Text>
                        <Text style={styles.metadataValue}>{metadata.focalLength}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Aperture</Text>
                        <Text style={styles.metadataValue}>{metadata.aperture}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Shutter Speed</Text>
                        <Text style={styles.metadataValue}>{metadata.shutterSpeed}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>ISO</Text>
                        <Text style={styles.metadataValue}>{metadata.iso}</Text>
                      </View>
                    </View>

                    {/* GPS Information */}
                    <View style={styles.metadataSection}>
                      <Text style={styles.metadataSectionTitle}>Location Data</Text>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Latitude</Text>
                        <Text style={styles.metadataValue}>{metadata.gpsLatitude}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Longitude</Text>
                        <Text style={styles.metadataValue}>{metadata.gpsLongitude}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Altitude</Text>
                        <Text style={styles.metadataValue}>{metadata.gpsAltitude}</Text>
                      </View>
                    </View>

                    {/* Upload Information */}
                    <View style={styles.metadataSection}>
                      <Text style={styles.metadataSectionTitle}>Upload Information</Text>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Uploaded From</Text>
                        <Text style={styles.metadataValue}>{metadata.uploadedFrom}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Upload Timestamp</Text>
                        <Text style={styles.metadataValue}>
                          {metadata.uploadTimestamp !== 'Unknown' 
                            ? formatDate(metadata.uploadTimestamp)
                            : 'Unknown'
                          }
                        </Text>
                      </View>
                    </View>

                    {/* Additional Information */}
                    <View style={styles.metadataSection}>
                      <Text style={styles.metadataSectionTitle}>Additional Information</Text>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Software</Text>
                        <Text style={styles.metadataValue}>{metadata.software}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Artist</Text>
                        <Text style={styles.metadataValue}>{metadata.artist}</Text>
                      </View>
                      
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Copyright</Text>
                        <Text style={styles.metadataValue}>{metadata.copyright}</Text>
                      </View>
                    </View>

                    {/* Custom Fields */}
                    {metadata.customFields.length > 0 && (
                      <View style={styles.metadataSection}>
                        <Text style={styles.metadataSectionTitle}>Custom Fields</Text>
                        {metadata.customFields.map((field, index) => (
                          <View key={index} style={styles.metadataItem}>
                            <Text style={styles.metadataLabel}>{field.key}</Text>
                            <Text style={styles.metadataValue}>
                              {typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  fullPhoto: {
    width: screenWidth,
    height: screenHeight * 0.7,
    resizeMode: 'contain',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftButton: {
    left: 20,
  },
  rightButton: {
    right: 20,
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
  },
  metadataPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.6,
  },
  metadataContent: {
    padding: 20,
  },
  metadataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  metadataTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  closeMetadataText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  metadataScroll: {
    maxHeight: screenHeight * 0.4,
  },
  metadataItem: {
    marginBottom: 16,
  },
  metadataLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  metadataValue: {
    color: '#ffffff',
    fontSize: 16,
  },
  metadataSection: {
    marginBottom: 24,
  },
  metadataSectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingBottom: 8,
  },
  dock: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    paddingTop: 20,
  },
  dockWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 0,
  },
  dockContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dockLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  dockCenter: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dockRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dockButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  dockButtonText: {
    fontSize: 20,
    color: '#ffffff',
  },
  preloadedPhoto: {
    position: 'absolute',
    top: 0,
    width: screenWidth,
    height: '100%',
  },
}); 
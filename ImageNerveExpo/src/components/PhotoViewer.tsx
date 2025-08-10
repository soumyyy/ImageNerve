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
  PanResponder,
  Easing,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { photosAPI } from '../services/api';
import { BlurView } from 'expo-blur';
// Safe area removed for this viewer to avoid extra padding/margins
import { Photo } from '../types';
import { PhotoImage } from './PhotoImage';
import { Ionicons } from '@expo/vector-icons';

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
  const [headerHeight, setHeaderHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);

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

  // Header includes its own top spacing; dock includes bottom padding
  const availablePhotoHeight = Math.max(0, screenHeight - headerHeight - dockHeight);
  const sidePad = Platform.OS === 'web' ? Math.min(210, Math.round(screenWidth * 0.3)) : 0;
  const imageWidth = Math.max(0, screenWidth - sidePad * 2);

  const animateToIndex = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentIndex < photos.length - 1) {
      const newIndex = currentIndex + 1;
      slideDirection.current = 'left';
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(newIndex);
        slideAnim.setValue(screenWidth);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else if (direction === 'right' && currentIndex > 0) {
      const newIndex = currentIndex - 1;
      slideDirection.current = 'right';
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(newIndex);
        slideAnim.setValue(-screenWidth);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
    }
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    console.log('🔄 Swiping:', direction, 'Current index:', currentIndex, 'Total photos:', photos.length);
    animateToIndex(direction);
  };

  // Gesture handling for swipe navigation (velocity + distance)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (showMetadata) return false;
        const dx = Math.abs(gestureState.dx);
        const dy = Math.abs(gestureState.dy);
        return dx > 8 && dx > dy * 1.2; // horizontal intent
      },
      onPanResponderMove: (_, gestureState) => {
        if (showMetadata) return;
        const dx = gestureState.dx;
        // Allow following finger; resist if no prev/next
        const limitLeft = prevPhoto ? screenWidth : screenWidth * 0.12;
        const limitRight = nextPhoto ? -screenWidth : -screenWidth * 0.12;
        slideAnim.setValue(Math.max(limitRight, Math.min(dx, limitLeft)));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (showMetadata) return;
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const distancePass = Math.abs(dx) > screenWidth * 0.12;
        const velocityPass = Math.abs(vx) > 0.25;
        if ((dx < 0 && (distancePass || vx < -0.25)) && nextPhoto) {
          animateToIndex('left');
        } else if ((dx > 0 && (distancePass || vx > 0.25)) && prevPhoto) {
          animateToIndex('right');
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

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
      // Basic
      filename: photo.filename,
      uploadedAt: photo.uploaded_at,
      dimensions: metadata.dimensions || 'Unknown',
      fileSize: metadata.file_size || 'Unknown',
      format: metadata.format || 'Unknown',
      location: photo.location,
      tags: photo.tags || [],
    };
    
    return extracted as any;
  };

  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        {/* Header */}
        <View
          style={styles.headerAbs}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentIndex + 1} of {photos.length}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Spacer below fixed header */}
        <View style={{ height: headerHeight }} />

        {/* Photo Display */}
        <View style={styles.photoContainer} {...panResponder.panHandlers}>
          {/* Edge tap zones */}
          {currentIndex > 0 && (
            <TouchableOpacity style={styles.edgeTapLeft} activeOpacity={0.8} onPress={() => handleSwipe('right')} />
          )}
          {currentIndex < photos.length - 1 && (
            <TouchableOpacity style={styles.edgeTapRight} activeOpacity={0.8} onPress={() => handleSwipe('left')} />
          )}

          {/* Preloaded Previous Photo (hidden) */}
          {prevPhoto && (
            <View style={[styles.preloadedPhoto, { left: -screenWidth }]}> 
              <PhotoImage 
                photo={prevPhoto} 
                userId={userId}
                style={[styles.fullPhoto, { height: availablePhotoHeight, width: imageWidth, alignSelf: 'center' }]}
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
              style={[styles.fullPhoto, { height: availablePhotoHeight, width: imageWidth, alignSelf: 'center' }]}
            />
          </Animated.View>
          
          {/* Preloaded Next Photo (hidden) */}
          {nextPhoto && (
            <View style={[styles.preloadedPhoto, { right: -screenWidth }]}> 
              <PhotoImage 
                photo={nextPhoto} 
                userId={userId}
                style={[styles.fullPhoto, { height: availablePhotoHeight, width: imageWidth, alignSelf: 'center' }]}
              />
            </View>
          )}
        </View>

        {/* Glass Dock with actions */}
        <View style={styles.dockWrapper} pointerEvents="box-none">
          <View
            style={[styles.dock, { paddingBottom: 0 }]}
            pointerEvents="auto"
            onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
          >
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject as any} pointerEvents="none" />
            <View style={styles.dockContent}>
              <TouchableOpacity accessibilityRole="button" style={styles.dockButton} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={24} color="#0A84FF" />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.dockButton} onPress={toggleMetadata}>
                <Ionicons name="information-circle-outline" size={24} color="#0A84FF" />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.dockButton} onPress={handleDownload}>
                <Ionicons name="download-outline" size={24} color="#0A84FF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Metadata Panel (minimal glass) */}
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
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject as any} />
          <View style={styles.metadataContent}>
            <View style={styles.metadataHeader}>
              <View style={styles.metadataHandle} />
              <Text style={styles.metadataTitle}>Info</Text>
              <TouchableOpacity onPress={toggleMetadata}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.metadataScroll}>
              {(() => {
                const m: any = extractImageMetadata(currentPhoto);
                return (
                  <>
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataKey}>Date</Text>
                      <Text style={styles.metadataVal}>{formatDate(m.uploadedAt)}</Text>
                    </View>
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataKey}>Filename</Text>
                      <Text style={styles.metadataVal}>{m.filename}</Text>
                    </View>
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataKey}>Size</Text>
                      <Text style={styles.metadataVal}>{m.fileSize}</Text>
                    </View>
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataKey}>Dimensions</Text>
                      <Text style={styles.metadataVal}>{m.dimensions}</Text>
                    </View>
                    {m.location && (
                      <View style={styles.metadataRow}>
                        <Text style={styles.metadataKey}>Location</Text>
                        <Text style={styles.metadataVal}>{formatLocation(m.location)}</Text>
                      </View>
                    )}
                    {Array.isArray(m.tags) && m.tags.length > 0 && (
                      <View style={[styles.metadataRow, { alignItems: 'flex-start' }]}>
                        <Text style={styles.metadataKey}>Tags</Text>
                        <View style={styles.tagRow}>
                          {m.tags.map((t: string, i: number) => (
                            <View key={`${t}_${i}`} style={styles.tagChip}><Text style={styles.tagText}>{t}</Text></View>
                          ))}
                        </View>
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
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
  headerAbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 5,
  },
  closeButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 22,
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
    height: screenHeight * 0.86,
    resizeMode: 'contain',
  },
  preloadedPhoto: {
    position: 'absolute',
    top: 0,
    width: screenWidth,
    height: '100%',
  },
  edgeTapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: screenWidth * 0.25,
    zIndex: 5,
  },
  edgeTapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: screenWidth * 0.25,
    zIndex: 5,
  },
  metadataPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.6,
  },
  metadataContent: {
    padding: 16,
  },
  metadataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  metadataHandle: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  metadataTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  metadataScroll: {
    maxHeight: screenHeight * 0.45,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)'
  },
  metadataKey: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  metadataVal: { color: '#fff', fontSize: 14, maxWidth: '55%', textAlign: 'right' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  tagChip: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  tagText: { color: '#fff', fontSize: 12 },
  dock: {
    alignSelf: 'center',
    width: 280,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  dockWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    alignItems: 'center',
  },
  dockContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  dockButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
  },
}); 
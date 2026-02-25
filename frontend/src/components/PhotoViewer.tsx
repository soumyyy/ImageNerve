import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const metadataAnim = useSharedValue(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);

  // Update currentPhoto when currentIndex changes
  const currentPhoto = localPhotos[currentIndex];
  const nextPhoto = currentIndex < localPhotos.length - 1 ? localPhotos[currentIndex + 1] : null;
  const prevPhoto = currentIndex > 0 ? localPhotos[currentIndex - 1] : null;

  // Reset metadata panel when photo changes
  useEffect(() => {
    if (showMetadata) {
      setShowMetadata(false);
      metadataAnim.value = withSpring(0);
    }
  }, [currentIndex]);

  const availablePhotoHeight = Math.max(0, screenHeight - headerHeight - dockHeight);
  const sidePad = Platform.OS === 'web' ? Math.min(210, Math.round(screenWidth * 0.3)) : 0;
  const imageWidth = Math.max(0, screenWidth - sidePad * 2);

  const snapToOffset = (offset: number) => {
    translateX.value = withSpring(offset, {
      damping: 20,
      stiffness: 90,
      mass: 0.5,
    });
  };

  // Shared values for gesture — all worklet-safe (no React state in worklets)
  const hasNext = useSharedValue(currentIndex < localPhotos.length - 1);
  const hasPrev = useSharedValue(currentIndex > 0);

  // Keep shared boundary values in sync with index changes
  useEffect(() => {
    hasNext.value = currentIndex < localPhotos.length - 1;
    hasPrev.value = currentIndex > 0;
  }, [currentIndex, localPhotos.length]);

  const changeIndex = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next' && currentIndex < localPhotos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      translateX.value = screenWidth;
      translateX.value = withSpring(0, { damping: 20, stiffness: 90, mass: 0.5 });
    } else if (direction === 'prev' && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      translateX.value = -screenWidth;
      translateX.value = withSpring(0, { damping: 20, stiffness: 90, mass: 0.5 });
    } else {
      translateX.value = withSpring(0, { damping: 20, stiffness: 90, mass: 0.5 });
    }
  }, [currentIndex, localPhotos.length]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        scale.value = interpolate(
          e.translationY,
          [0, screenHeight / 2],
          [1, 0.7],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationY > 150 || e.velocityY > 1000;
      if (shouldDismiss) {
        runOnJS(onClose)();
        return;
      }

      // Reset Y
      translateY.value = withSpring(0);
      scale.value = withSpring(1);

      // Decide horizontal
      const goNext = (e.translationX < -screenWidth * 0.2 || e.velocityX < -500) && hasNext.value;
      const goPrev = (e.translationX > screenWidth * 0.2 || e.velocityX > 500) && hasPrev.value;

      if (goNext) {
        runOnJS(changeIndex)('next');
      } else if (goPrev) {
        runOnJS(changeIndex)('prev');
      } else {
        translateX.value = withSpring(0);
      }
    });

  const toggleMetadata = () => {
    const toValue = showMetadata ? 0 : 1;
    setShowMetadata(!showMetadata);
    metadataAnim.value = withSpring(toValue, { damping: 15, stiffness: 120 });
  };

  const animatedPhotoStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ],
    };
  });

  const animatedMetadataStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            metadataAnim.value,
            [0, 1],
            [screenHeight, 0]
          )
        }
      ]
    };
  });

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const filename = currentPhoto.filename;
      if (Platform.OS === 'web') {
        const streamUrl = photosAPI.getWebDownloadStreamUrl(filename);
        const a = document.createElement('a');
        a.href = streamUrl;
        a.download = filename || 'image.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Allow access to your photo library to save photos.');
        return;
      }
      const { url } = await photosAPI.getDownloadUrl(filename, userId);
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
      const tmpPath = `${cacheDir}${filename}`;
      const { uri } = await FileSystem.downloadAsync(url, tmpPath);
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('ImageNerve', asset, false);
      Alert.alert('Saved', 'Photo saved to your library.');
    } catch (e: any) {
      console.error('Download error:', e);
      if (Platform.OS === 'ios' && await Sharing.isAvailableAsync()) {
        try {
          const { url } = await photosAPI.getDownloadUrl(currentPhoto.filename, userId);
          await Sharing.shareAsync(url);
          return;
        } catch { }
      }
      Alert.alert('Download failed', e?.message || 'Unable to save photo');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    if (isDeleting) return;

    const performDelete = async () => {
      setIsDeleting(true);
      try {
        await photosAPI.deletePhoto(currentPhoto.id, userId);
        const updated = localPhotos.filter((p) => p.id !== currentPhoto.id);
        onDeleted?.(currentPhoto.id);
        if (updated.length === 0) {
          onClose();
          return;
        }
        setLocalPhotos(updated);
        // Stay at same index so the next photo slides in; step back if we were at the end
        if (currentIndex >= updated.length) {
          setCurrentIndex(updated.length - 1);
        }
      } catch (e: any) {
        console.error('Delete error:', e);
        Alert.alert('Delete failed', e?.message || 'Unable to delete photo');
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      const ok = (globalThis as any).confirm?.('Delete this photo? This cannot be undone.') ?? false;
      if (ok) performDelete();
      return;
    }

    Alert.alert(
      'Delete Photo',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
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
            {currentIndex + 1} of {localPhotos.length}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Spacer below fixed header */}
        <View style={{ height: headerHeight }} />

        {/* Photo Display */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.photoContainer, animatedPhotoStyle]}>
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
            <PhotoImage
              photo={currentPhoto}
              userId={userId}
              style={[styles.fullPhoto, { height: availablePhotoHeight, width: imageWidth, alignSelf: 'center' }]}
            />

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
          </Animated.View>
        </GestureDetector>

        {/* Glass Dock with actions */}
        <View style={styles.dockWrapper} pointerEvents="box-none">
          <View
            style={[styles.dock, { paddingBottom: 0 }]}
            pointerEvents="auto"
            onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
          >
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject as any} pointerEvents="none" />
            <View style={styles.dockContent}>
              <TouchableOpacity accessibilityRole="button" style={styles.dockButton} onPress={handleDelete} disabled={isDeleting}>
                {isDeleting
                  ? <ActivityIndicator size="small" color="#0A84FF" />
                  : <Ionicons name="trash-outline" size={24} color="#0A84FF" />}
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.dockButton} onPress={toggleMetadata}>
                <Ionicons name="information-circle-outline" size={24} color="#0A84FF" />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.dockButton} onPress={handleDownload} disabled={isDownloading}>
                {isDownloading
                  ? <ActivityIndicator size="small" color="#0A84FF" />
                  : <Ionicons name="download-outline" size={24} color="#0A84FF" />}
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
            },
            animatedMetadataStyle,
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
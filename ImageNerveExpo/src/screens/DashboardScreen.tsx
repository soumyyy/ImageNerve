import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Dimensions, FlatList, ListRenderItemInfo, Image as RNImage, Modal } from 'react-native';
import { Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickImages, MULTI_PICK_LIMIT, type ImagePickerResult } from '../utils/imageUtils';
import { uploadPhotosBatch } from '../utils/uploadPhotos';
import { getCurrentUserId } from '../config/user';
import { photosAPI, facesAPI, albumsAPI } from '../services/api';
import { Photo, Album } from '../types';
import { PhotoImage } from '../components/PhotoImage';
import { PhotoViewer } from '../components/PhotoViewer';
import AlbumCard from '../components/AlbumCard';
import AlbumDetailsScreen from './AlbumDetailsScreen';
import NewAlbumModal from '../components/NewAlbumModal';
import AlbumPickerModal from '../components/AlbumPickerModal';
import * as Haptics from 'expo-haptics';
import { LiquidGlassTabBar } from '../components/LiquidGlassTabBar';

// Get screen dimensions for responsive design
const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isLargeScreen = screenWidth > 768;

const getPhotoItemWidth = () => {
  if (isWeb && isLargeScreen) {
    return screenWidth / 6; // 6 columns on large screens, no gaps
  } else if (isWeb) {
    return screenWidth / 4; // 4 columns on medium screens, no gaps
  } else {
    return screenWidth / 3; // 3 columns on mobile, no gaps
  }
};

const scopeToggleWidth = 96; // fixed width for scope toggle — kept at module scope for StyleSheet

interface DashboardScreenProps {
  onSettingsPress?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onSettingsPress }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumPreviews, setAlbumPreviews] = useState<Record<string, Photo[]>>({});
  const [albumCounts, setAlbumCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'everyone'>('mine');
  const [tab, setTab] = useState<'photos' | 'albums'>('photos');
  // Dynamic columns — pinch gesture changes between 3, 5, 10
  const COLUMN_STEPS = [3, 5, 10];
  const [numColumns, setNumColumns] = useState(isWeb && isLargeScreen ? 6 : isWeb ? 4 : 3);
  const pinchBaseScale = useSharedValue(1);
  const pinchActiveScale = useSharedValue(1);
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState<null | { photoId?: string; purpose: 'assign-existing' | 'upload-new' | 'upload-new-with-images' }>(null);
  const pendingUploadImagesRef = useRef<ImagePickerResult[] | null>(null);
  const [showProfileFaceCta, setShowProfileFaceCta] = useState(false);
  const segmentAnim = React.useRef(new Animated.Value(0)).current;
  const INITIAL_PAGE_SIZE = 12;
  const PAGE_SIZE = 60;
  const [cursorBefore, setCursorBefore] = useState<string | null>(null);
  const [isPaginating, setIsPaginating] = useState(false);

  const userId = getCurrentUserId();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadUserData();
  }, [scope, tab]);

  useEffect(() => {
    Animated.timing(segmentAnim, {
      toValue: scope === 'mine' ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [scope]);

  const testAPIConnection = async () => {
    try {
      console.log('Testing API connection...');
      const response = await fetch(`http://127.0.0.1:8000/photos/?user_id=${userId}`);
      const data = await response.json();
      console.log('API test successful:', data);
    } catch (error) {
      console.error('API test failed:', error);
    }
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      const includePublic = scope === 'everyone';

      // First: load photos only for sub-second first paint
      const photosResult = await loadPhotosPart();
      if (tab === 'photos') {
        setPhotos(photosResult.photos);
        setCursorBefore(photosResult.cursorBefore ?? null);
        setShowProfileFaceCta(photosResult.showProfileFaceCta ?? false);
      }
      setLoading(false);

      // Then: albums and album previews in background (don't block grid)
      albumsAPI.getUserAlbums(userId, includePublic).then((albumsResult) => {
        setAlbums(albumsResult);
        setAlbumPreviews({});
        setAlbumCounts({});
        loadAlbumPreviewsInBackground(albumsResult);
      }).catch((err) => console.error('Albums load failed', err));
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      Alert.alert('Error', 'Failed to load your photos');
    } finally {
      setLoading(false);
    }
  };

  const loadPhotosPart = async (): Promise<{
    photos: Photo[];
    cursorBefore: string | null;
    showProfileFaceCta?: boolean;
  }> => {
    if (scope === 'everyone') {
      const res = await photosAPI.getUserPhotos(userId, { limit: INITIAL_PAGE_SIZE });
      const last = res[res.length - 1];
      return { photos: res, cursorBefore: last ? last.uploaded_at : null };
    }
    // Me: show user photos immediately for sub-second paint; refine with face photos in background
    const userPhotos = await photosAPI.getUserPhotos(userId, { limit: INITIAL_PAGE_SIZE });
    const last = userPhotos[userPhotos.length - 1];
    const initial = {
      photos: userPhotos,
      cursorBefore: last ? last.uploaded_at : null,
      showProfileFaceCta: false,
    };
    facesAPI.getProfileStatus(userId).then((status) => {
      if (!status?.exists) {
        setShowProfileFaceCta(true);
        return;
      }
      const thr = typeof status.threshold === 'number' ? status.threshold : 0.45;
      facesAPI.getMyFacePhotos(userId, thr, INITIAL_PAGE_SIZE).then((mine) => {
        if (mine?.success && Array.isArray(mine.photos) && mine.photos.length > 0) {
          const lastM = mine.photos[mine.photos.length - 1];
          setPhotos(mine.photos as Photo[]);
          setCursorBefore(lastM?.uploaded_at ?? null);
          setShowProfileFaceCta(false);
        }
      }).catch(() => { });
    }).catch(() => { });
    return initial;
  };

  const loadAlbumPreviewsInBackground = (albumList: Album[]) => {
    const batchSize = 4;
    const batches = [];
    for (let i = 0; i < Math.min(12, albumList.length); i += batchSize) {
      batches.push(albumList.slice(i, i + batchSize));
    }
    batches.forEach((batch, batchIndex) => {
      setTimeout(() => {
        batch.forEach(async (a: any) => {
          try {
            const res = await albumsAPI.getAlbumPhotos(a.id, userId);
            setAlbumPreviews((prev) => ({ ...prev, [a.id]: res.photos.slice(0, 4) }));
            setAlbumCounts((prev) => ({ ...prev, [a.id]: res.photo_count ?? res.photos.length }));
          } catch { }
        });
      }, batchIndex * 150);
    });
  };

  // Prefetch upcoming images for smooth scrolling
  const prefetchAroundIndex = async (index: number) => {
    const prefetchCount = 12;
    const start = Math.max(0, index);
    const end = Math.min(photos.length, index + prefetchCount);
    for (let i = start; i < end; i++) {
      const p = photos[i];
      if (!p) continue;
      try {
        const { url } = await photosAPI.getDownloadUrl(p.filename, userId);
        RNImage.prefetch(url);
      } catch { }
    }
  };

  const onViewableItemsChanged = React.useRef((info: any) => {
    const items = info.viewableItems as Array<{ index: number | null }>;
    const last = items[items.length - 1];
    const idx = last?.index ?? null;
    if (typeof idx === 'number') prefetchAroundIndex(idx + 1);
  }).current;

  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 60 } as any).current;

  const loadMore = async () => {
    if (isPaginating || !cursorBefore || tab !== 'photos' || scope !== 'everyone') return;
    setIsPaginating(true);
    try {
      const more = await photosAPI.getUserPhotos(userId, { limit: PAGE_SIZE, before: cursorBefore });
      if (Array.isArray(more) && more.length > 0) {
        setPhotos((prev) => {
          const existing = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of more) {
            if (!existing.has(p.id)) merged.push(p);
          }
          return merged;
        });
        const last = more[more.length - 1];
        setCursorBefore(last.uploaded_at);
      } else {
        setCursorBefore(null);
      }
    } catch (e) {
      console.warn('Pagination fetch failed', e);
    } finally {
      setIsPaginating(false);
    }
  };

  // Debounced clustering after uploads
  const clusterDebounceRef = React.useRef<NodeJS.Timeout | null>(null);
  const isClusteringRef = React.useRef<boolean>(false);
  const scheduleClusterRefresh = React.useCallback(() => {
    try {
      if (clusterDebounceRef.current) clearTimeout(clusterDebounceRef.current);
      clusterDebounceRef.current = setTimeout(async () => {
        if (isClusteringRef.current) return;
        isClusteringRef.current = true;
        try {
          console.log('🧠 Triggering face clustering (debounced)...');
          await facesAPI.clusterFaces(userId);
          console.log('✅ Face clustering complete');
        } catch (err: any) {
          console.warn('⚠️ Failed to run clustering:', err?.message || String(err));
        } finally {
          isClusteringRef.current = false;
        }
      }, 2000);
    } catch { }
  }, [userId]);

  // Pinch gesture — maps scale to column step [3,5,10]
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchActiveScale.value = pinchBaseScale.value;
    })
    .onUpdate((e) => {
      pinchActiveScale.value = pinchBaseScale.value * e.scale;
    })
    .onEnd(() => {
      const s = pinchActiveScale.value;
      // pinching in (scale < 1) → more columns, pinching out (scale > 1) → fewer
      let newCols = numColumns;
      if (s < 0.75 && numColumns < COLUMN_STEPS[COLUMN_STEPS.length - 1]) {
        const idx = COLUMN_STEPS.indexOf(numColumns);
        newCols = COLUMN_STEPS[Math.min(idx + 1, COLUMN_STEPS.length - 1)];
      } else if (s > 1.35 && numColumns > COLUMN_STEPS[0]) {
        const idx = COLUMN_STEPS.indexOf(numColumns);
        newCols = COLUMN_STEPS[Math.max(idx - 1, 0)];
      }
      if (newCols !== numColumns) {
        runOnJS(handleColumnChange)(newCols);
      }
      pinchBaseScale.value = 1;
      pinchActiveScale.value = 1;
    });

  const handleColumnChange = useCallback((cols: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNumColumns(cols);
  }, []);

  // Multi-select helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const renderPhotoItem = useCallback(({ item, index }: ListRenderItemInfo<Photo>) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.photoItem, { width: screenWidth / numColumns, height: screenWidth / numColumns }]}
        activeOpacity={isSelecting ? 0.6 : 0.85}
        onPress={() => {
          if (isSelecting) {
            toggleSelect(item.id);
          } else {
            handlePhotoPress(index);
          }
        }}
        onLongPress={() => {
          if (!isSelecting) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsSelecting(true);
            setSelectedIds(new Set([item.id]));
          }
        }}
        delayLongPress={350}
      >
        <PhotoImage photo={item} userId={userId} thumbnailOnly />
        {/* Selection overlay */}
        {isSelecting && (
          <View style={[styles.selectionOverlay, isSelected && styles.selectionOverlayActive]}>
            {isSelected ? (
              <View style={styles.selectionCheck}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            ) : (
              <View style={styles.selectionCircle} />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedIds, isSelecting, numColumns, userId]);

  const getItemLayout = (_: any, index: number) => {
    const size = screenWidth / numColumns;
    const row = Math.floor(index / numColumns);
    return { length: size, offset: row * size, index };
  };

  const handlePhotoUpload = async (targetAlbumId?: string) => {
    try {
      setUploading(true);
      const images = await pickImages(MULTI_PICK_LIMIT);
      if (!images.length) return;
      setUploadProgress({ current: 0, total: images.length });
      const { faceCount } = await uploadPhotosBatch(userId, images, {
        targetAlbumId,
        onProgress: (current, total) => setUploadProgress({ current, total }),
      });
      scheduleClusterRefresh();
      const total = images.length;
      Alert.alert(
        'Success!',
        total === 1
          ? `Photo uploaded.${faceCount > 0 ? ` Found ${faceCount} faces.` : ''}`
          : `${total} photos uploaded.${faceCount > 0 ? ` Faces detected in some.` : ''}`,
      );
      await new Promise((r) => setTimeout(r, 300));
      await loadUserData();
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Error',
        error.response?.data?.detail || error.message || 'Failed to upload. Please try again.',
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handlePhotoPress = (index: number) => {
    setSelectedPhotoIndex(index);
  };

  const handleCloseViewer = () => {
    setSelectedPhotoIndex(null);
  };

  if (selectedPhotoIndex !== null) {
    return (
      <PhotoViewer
        photos={photos}
        initialIndex={selectedPhotoIndex}
        userId={userId}
        onClose={handleCloseViewer}
        onDeleted={(photoId) => {
          setPhotos((prev) => prev.filter((p) => p.id !== photoId));
          // If list becomes empty, close viewer
          if (photos.length <= 1) setSelectedPhotoIndex(null);
        }}
      />
    );
  }

  if (openAlbumId) {
    return (
      <AlbumDetailsScreen
        albumId={openAlbumId}
        userId={userId}
        onBack={() => setOpenAlbumId(null)}
        onOpenPhoto={(index, albumPhotos) => {
          setPhotos(albumPhotos);
          setSelectedPhotoIndex(index);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ImageNerve</Text>
        <TouchableOpacity
          onPress={onSettingsPress}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={24} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      {/* Removed top Photos/Albums toggle; now in header */}

      {/* Floating control row: Me/Everyone toggle (Photos tab only) + Add button */}
      <View style={styles.floatingControls}>
        {tab === 'photos' && (
          <>
            <View style={styles.controlPill}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Animated.View
                style={[
                  styles.scopeHighlight,
                  {
                    width: scopeToggleWidth / 2,
                    transform: [
                      {
                        translateX: segmentAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, scopeToggleWidth / 2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <TouchableOpacity style={styles.scopeHalf} onPress={() => { setScope('mine'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} activeOpacity={0.9}>
                <Ionicons name="person" size={15} color={scope === 'mine' ? '#fff' : 'rgba(255,255,255,0.5)'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.scopeHalf} onPress={() => { setScope('everyone'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} activeOpacity={0.9}>
                <Ionicons name="people" size={15} color={scope === 'everyone' ? '#fff' : 'rgba(255,255,255,0.5)'} />
              </TouchableOpacity>
            </View>
            <View style={styles.controlDivider} />
          </>
        )}
        {/* Add button */}
        <TouchableOpacity
          style={[styles.addPillBtn, uploading && styles.buttonDisabled]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAddMenu(true);
          }}
          activeOpacity={0.75}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {uploading && uploadProgress && (
        <View style={styles.uploadProgressOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadProgressText}>
            Uploading {uploadProgress.current}/{uploadProgress.total}
          </Text>
        </View>
      )}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading your photos...</Text>
        </View>
      ) : tab === 'photos' ? (
        <GestureDetector gesture={pinchGesture}>
          <FlatList
            key={`photos_${numColumns}`}
            data={photos}
            renderItem={renderPhotoItem}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            removeClippedSubviews
            initialNumToRender={24}
            maxToRenderPerBatch={32}
            windowSize={12}
            updateCellsBatchingPeriod={50}
            getItemLayout={getItemLayout}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            inverted
            contentContainerStyle={{ paddingTop: insets.bottom + 80, paddingBottom: 0, minHeight: 0, backgroundColor: '#000' }}

            ListEmptyComponent={
              showProfileFaceCta && scope === 'mine' ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Set up “My Face”</Text>
                  <Text style={styles.emptySubtext}>Capture your face in Settings to personalize your Me tab.</Text>
                  <TouchableOpacity style={styles.ctaBtn} onPress={() => Alert.alert('Go to Settings', 'Open settings and tap “Capture My Face”.')}>
                    <Text style={styles.ctaText}>Open Settings</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No Photos Yet</Text>
                  <Text style={styles.emptySubtext}>Tap the + button below to add your first photo</Text>
                </View>
              )
            }
            onEndReachedThreshold={0.3}
            onEndReached={loadMore}
          />
        </GestureDetector>
      ) : (
        <FlatList
          key={`albums_${2}`}
          data={albums}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <AlbumCard
              key={item.id}
              title={item.name}
              count={albumCounts[item.id] ?? (item as any)?.photo_count ?? (item.photo_ids?.length || 0)}
              photos={albumPreviews[item.id] || []}
              userId={userId}
              onPress={() => setOpenAlbumId(item.id)}
            />
          )}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 80 }}
        />
      )}

      {/* Multi-select action bar */}
      {isSelecting && (
        <BlurView intensity={40} tint="dark" style={styles.selectionBar}>
          <TouchableOpacity onPress={exitSelectionMode} style={styles.selectionBarBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.selectionBarCount}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.selectionBarActions}>
            <TouchableOpacity
              style={styles.selectionBarBtn}
              onPress={async () => {
                if (!selectedIds.size) return;
                setShowAlbumPicker({ purpose: 'assign-existing', photoId: [...selectedIds][0] });
              }}
            >
              <Ionicons name="albums-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectionBarBtn}
              onPress={() => {
                Alert.alert(
                  'Delete Photos',
                  `Delete ${selectedIds.size} photo${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete', style: 'destructive',
                      onPress: async () => {
                        const ids = [...selectedIds];
                        exitSelectionMode();
                        try {
                          await Promise.all(ids.map(id => photosAPI.deletePhoto(id, userId)));
                          setPhotos(prev => prev.filter(p => !ids.includes(p.id)));
                        } catch { Alert.alert('Error', 'Some photos could not be deleted.'); }
                      }
                    }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={22} color="#ff4444" />
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      <LiquidGlassTabBar
        activeTab={tab}
        onTabPress={setTab}
        bottomInset={insets.bottom}
      />

      {/* Add Menu (Action Sheet) — context-aware per tab */}
      <Modal visible={showAddMenu} transparent animationType="fade" onRequestClose={() => setShowAddMenu(false)}>
        <View style={styles.menuOverlay}>
          <View style={styles.menuCard}>

            {/* Albums tab: show New Album option first */}
            {tab === 'albums' && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowAddMenu(false);
                    setTimeout(() => setShowNewAlbum(true), 300);
                  }}
                >
                  <View style={styles.menuItemRow}>
                    <Ionicons name="albums-outline" size={20} color="#fff" style={styles.menuItemIcon} />
                    <Text style={styles.menuItemText}>New Album</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
              </>
            )}

            {/* Both tabs: Add Photo to Album — open picker first (no modal), then choose album */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                setTimeout(async () => {
                  const images = await pickImages(MULTI_PICK_LIMIT);
                  if (!images.length) return;
                  pendingUploadImagesRef.current = images;
                  setShowAlbumPicker({ purpose: 'upload-new-with-images' });
                }, 300);
              }}
            >
              <View style={styles.menuItemRow}>
                <Ionicons name="image-outline" size={20} color="#fff" style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>Add Photo to Album</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuCancel]}
              onPress={() => setShowAddMenu(false)}
            >
              <Text style={[styles.menuItemText, styles.menuCancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NewAlbumModal
        visible={showNewAlbum}
        userId={userId}
        onClose={() => setShowNewAlbum(false)}
        onCreated={async () => {
          // refresh albums immediately
          try {
            const includePublic = scope === 'everyone';
            const userAlbums = await albumsAPI.getUserAlbums(userId, includePublic);
            setAlbums(userAlbums);
          } catch { }
        }}
      />

      <AlbumPickerModal
        visible={!!showAlbumPicker}
        userId={userId}
        defaultToMyPhotos={false}
        onClose={() => setShowAlbumPicker(null)}
        onPick={async (albumId) => {
          const purpose = showAlbumPicker?.purpose;
          const photoId = showAlbumPicker?.photoId;
          const imagesToUpload = purpose === 'upload-new-with-images' ? pendingUploadImagesRef.current : null;
          pendingUploadImagesRef.current = null;
          setShowAlbumPicker(null);
          if (purpose === 'upload-new-with-images' && imagesToUpload?.length) {
            try {
              setUploading(true);
              setUploadProgress({ current: 0, total: imagesToUpload.length });
              const { faceCount } = await uploadPhotosBatch(userId, imagesToUpload, {
                targetAlbumId: albumId,
                onProgress: (current, total) => setUploadProgress({ current, total }),
              });
              scheduleClusterRefresh();
              const total = imagesToUpload.length;
              Alert.alert(
                'Success!',
                total === 1
                  ? `Photo uploaded.${faceCount > 0 ? ` Found ${faceCount} faces.` : ''}`
                  : `${total} photos uploaded.${faceCount > 0 ? ` Faces detected in some.` : ''}`,
              );
              await new Promise((r) => setTimeout(r, 300));
              await loadUserData();
            } catch (error: any) {
              console.error('Upload error:', error);
              Alert.alert(
                'Upload Error',
                error.response?.data?.detail || error.message || 'Failed to upload. Please try again.',
              );
            } finally {
              setUploading(false);
              setUploadProgress(null);
            }
            return;
          }
          try {
            if (purpose === 'assign-existing' && photoId) {
              await albumsAPI.addPhotosToAlbum(albumId, userId, [photoId]);
            }
            const previews: Record<string, Photo[]> = {} as any;
            const userAlbums = await albumsAPI.getUserAlbums(userId, scope === 'everyone');
            setAlbums(userAlbums);
            await Promise.all(userAlbums.slice(0, 12).map(async (a: any) => {
              try {
                const res = await albumsAPI.getAlbumPhotos(a.id, userId);
                previews[a.id] = res.photos.slice(0, 4);
              } catch { }
            }));
            setAlbumPreviews(previews);
          } catch (e) {
            console.log('Album operation failed', e);
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#000',
    zIndex: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  content: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingBottom: 100, // Space for floating button and future albums
    paddingHorizontal: 0, // No horizontal padding to ensure images touch edges
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 8,
  },
  headerTabs: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 2,
  },
  headerTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  headerTabActive: {
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  headerTabText: { color: 'rgba(255,255,255,0.75)' },
  headerTabTextActive: { color: '#fff', fontWeight: '700' },
  // Unified floating control row (scope toggle + add)
  floatingControls: {
    position: 'absolute',
    right: 14,
    top: 50,
    zIndex: 10,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlPill: {
    width: scopeToggleWidth,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  controlDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  addPillBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scopeHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
  },
  scopeHalf: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scopeIconSmall: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabText: { color: 'rgba(255,255,255,0.75)' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 0,
    margin: 0,
    width: screenWidth,
  },
  photoItem: {
    width: getPhotoItemWidth(),
    height: getPhotoItemWidth(),
    margin: 0,
    padding: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  albumsSection: { marginTop: 16 },
  albumsHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  albumsTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  albumsModify: { color: '#0a84ff' },
  albumsRow: { paddingHorizontal: 16, paddingVertical: 10 },
  albumsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 8 },
  albumsBar: {
    marginTop: 10,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 12,
    fontWeight: '500',
  },
  uploadProgressOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  uploadProgressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaBtn: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  ctaText: {
    color: '#fff',
    fontWeight: '600'
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 18,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingAddButtonText: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '300',
    lineHeight: 32,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  menuCard: {
    backgroundColor: '#111',
    padding: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  menuCancel: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  menuCancelText: {
    color: 'rgba(255,255,255,0.8)'
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuItemIcon: {
    opacity: 0.85,
  },
  // Selection overlay styles
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  selectionOverlayActive: {
    backgroundColor: 'rgba(10,132,255,0.35)',
  },
  selectionCircle: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  selectionCheck: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Selection action bar
  selectionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  selectionBarBtn: {
    padding: 10,
  },
  selectionBarCount: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  selectionBarActions: {
    flexDirection: 'row',
    gap: 4,
  },
});
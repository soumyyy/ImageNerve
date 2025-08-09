import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Dimensions, FlatList, ListRenderItemInfo, Image as RNImage, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pickImage } from '../utils/imageUtils';
import { getMimeType } from '../utils/fileUtils';
import { photosAPI, facesAPI, albumsAPI } from '../services/api';
import { Photo, Album } from '../types';
import { PhotoImage } from '../components/PhotoImage';
import { PhotoViewer } from '../components/PhotoViewer';
import AlbumCard from '../components/AlbumCard';
import AlbumDetailsScreen from './AlbumDetailsScreen';
import NewAlbumModal from '../components/NewAlbumModal';
import AlbumPickerModal from '../components/AlbumPickerModal';

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
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'everyone'>('mine');
  const [tab, setTab] = useState<'photos' | 'albums'>('photos');
  const numColumns = isWeb && isLargeScreen ? 6 : (isWeb ? 4 : 3);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState<null | { photoId?: string; purpose: 'assign-existing' | 'upload-new' }>(null);
  
  // Test user ID for development
  const userId = 'test-user-001';

  useEffect(() => {
    loadUserData();
  }, [scope, tab]);

  const testAPIConnection = async () => {
    try {
      console.log('Testing API connection...');
      const response = await fetch('http://127.0.0.1:8000/photos/?user_id=test-user-001');
      const data = await response.json();
      console.log('API test successful:', data);
    } catch (error) {
      console.error('API test failed:', error);
    }
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      if (tab === 'photos') {
        // Photos
        const userPhotos = scope === 'everyone' ? await photosAPI.getPublicPhotos() : await photosAPI.getUserPhotos(userId);
        setPhotos(userPhotos);
      }

      // Albums for both tabs (used by albums tab and the bottom row in photos tab)
      const includePublic = scope === 'everyone';
      const userAlbums = await albumsAPI.getUserAlbums(userId, includePublic);
      setAlbums(userAlbums);
      const previews: Record<string, Photo[]> = {};
      const counts: Record<string, number> = {};
      await Promise.all(userAlbums.slice(0, 12).map(async (a: any) => {
        try {
          const res = await albumsAPI.getAlbumPhotos(a.id, userId);
          previews[a.id] = res.photos.slice(0, 4);
          counts[a.id] = res.photo_count ?? res.photos.length;
        } catch {}
      }));
      setAlbumPreviews(previews);
      setAlbumCounts(counts);
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      Alert.alert('Error', 'Failed to load your photos');
    } finally {
      setLoading(false);
    }
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
      } catch {}
    }
  };

  const onViewableItemsChanged = React.useRef((info: any) => {
    const items = info.viewableItems as Array<{ index: number | null }>;
    const last = items[items.length - 1];
    const idx = last?.index ?? null;
    if (typeof idx === 'number') prefetchAroundIndex(idx + 1);
  }).current;

  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 60 } as any).current;

  const renderPhotoItem = ({ item, index }: ListRenderItemInfo<Photo>) => (
    <TouchableOpacity 
      key={item.id}
      style={styles.photoItem}
      activeOpacity={0.7}
      onPress={() => handlePhotoPress(index)}
    >
      <PhotoImage photo={item} userId={userId} />
    </TouchableOpacity>
  );

  const getItemLayout = (_: any, index: number) => {
    const size = getPhotoItemWidth();
    const row = Math.floor(index / numColumns);
    return { length: size, offset: row * size, index };
  };

  const handlePhotoUpload = async (targetAlbumId?: string) => {
    try {
      setUploading(true);
      console.log('📸 Starting photo upload process...');
      
      // Pick image using cross-platform picker
      const imageResult = await pickImage();
      if (!imageResult) {
        console.log('❌ No image selected');
        return;
      }
      console.log('✅ Image selected:', imageResult.name, '| Type:', imageResult.type);

      // Get presigned URL for S3 upload
      console.log('🔐 Getting upload URL...');
      const uploadUrlResponse = await photosAPI.getUploadUrl(imageResult.name, userId);
      console.log('✅ Upload URL received | Sanitized filename:', uploadUrlResponse.sanitizedFilename);
      
      // Create a temporary photo object for immediate display
      const tempPhoto: Photo = {
        id: `temp-${Date.now()}`,
        user_id: userId,
        s3_url: imageResult.uri, // Use local URI for immediate display
        filename: uploadUrlResponse.sanitizedFilename,
        tags: [],
        uploaded_at: new Date().toISOString(),
        description: 'Uploading...',
        is_public: false,
        photo_metadata: {
          file_size: imageResult.size,
          format: imageResult.type,
          dimensions: 'Unknown',
          uploaded_from: 'mobile_app',
          upload_timestamp: new Date().toISOString(),
        }
      };

      // Add temp photo to the beginning of the list for immediate display
      setPhotos(prevPhotos => [tempPhoto, ...prevPhotos]);
      
      // Prepare upload body with proper mime type
      console.log('📦 Preparing upload body...');
      let uploadBody;
      const mimeType = getMimeType(imageResult.name);
      
      if (Platform.OS === 'web') {
        uploadBody = await fetch(imageResult.uri).then(r => r.blob());
      } else {
        const response = await fetch(imageResult.uri);
        uploadBody = await response.blob();
      }

      // Upload to S3 with retries
      console.log('☁️ Starting S3 upload:', {
        filename: uploadUrlResponse.sanitizedFilename,
        size: uploadBody.size,
        type: mimeType
      });

      let uploadSuccess = false;
      const maxRetries = 3;
      const startTime = Date.now();
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const attemptStart = Date.now();
        try {
          // First verify the upload URL is valid
          if (!uploadUrlResponse.upload_url) {
            throw new Error('No upload URL provided');
          }

          // Attempt the upload with timeout
          // Parse the presigned URL to get the base URL and query parameters
          const presignedUrl = new URL(uploadUrlResponse.upload_url);
          const baseUrl = `${presignedUrl.origin}${presignedUrl.pathname}`;
          const queryParams = Object.fromEntries(presignedUrl.searchParams);

          console.log('🔄 Uploading to:', {
            baseUrl,
            queryParams,
            contentType: mimeType,
            size: uploadBody.size
          });

          const response = await Promise.race([
            fetch(uploadUrlResponse.upload_url, {
              method: 'PUT',
              body: uploadBody,
              headers: {
                'Content-Type': mimeType,
              },
              mode: 'cors',
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Upload timeout')), 30000)
            )
          ]) as Response;

          const attemptDuration = (Date.now() - attemptStart) / 1000;
          
          // Check response status
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error details');
            throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
          }

          // Upload successful
          console.log('✅ S3 upload successful:', {
            attempt,
            duration: attemptDuration.toFixed(2) + 's',
            status: response.status,
            size: uploadBody.size,
          });
          
          uploadSuccess = true;
          break;
          
        } catch (error: any) {
          lastError = error;
          const attemptDuration = (Date.now() - attemptStart) / 1000;
          
          console.warn(`⚠️ Upload attempt ${attempt} failed:`, {
            error: error.message,
            duration: attemptDuration.toFixed(2) + 's'
          });

          if (attempt === maxRetries) {
            console.error('❌ All upload attempts failed:', {
              attempts: maxRetries,
              finalError: error.message
            });
            throw new Error(`Failed to upload after ${maxRetries} attempts: ${error.message}`);
          }

          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!uploadSuccess) {
        throw new Error('Upload failed: ' + (lastError?.message || 'Unknown error'));
      }

                console.log('✅ S3 upload successful');

          // Create photo record in database
          console.log('🗄️ Creating photo record...', {
            filename: uploadUrlResponse.sanitizedFilename,
            url: uploadUrlResponse.file_url
          });
          
      // Extract basic metadata from the image
      const imageMetadata = {
        file_size: uploadBody.size,
        format: mimeType,
        dimensions: 'Unknown', // Will be extracted on backend if possible
        uploaded_from: 'mobile_app',
        upload_timestamp: new Date().toISOString(),
      };

      const photoData = {
        user_id: userId,
        s3_url: uploadUrlResponse.file_url,
        filename: uploadUrlResponse.sanitizedFilename,
        description: 'Uploaded from mobile app',
        is_public: false,
        album_ids: targetAlbumId ? [targetAlbumId] : undefined,
        skip_default_album: !!targetAlbumId,
        photo_metadata: imageMetadata,
      };

      let photo: Photo;
      try {
        photo = await photosAPI.createPhoto(photoData);
        console.log('✅ Photo record created:', {
          id: photo.id,
          filename: photo.filename,
          url: photo.s3_url
        });
        
        // Remove temp photo and add real photo
        setPhotos(prevPhotos => {
          const filteredPhotos = prevPhotos.filter(p => p.id !== tempPhoto.id);
          return [photo, ...filteredPhotos];
        });

        // If an album was chosen, add photo to that album
        if (targetAlbumId) {
          try {
            console.log('📚 Adding photo to album:', targetAlbumId);
            await albumsAPI.addPhotosToAlbum(targetAlbumId, userId, [photo.id]);
          } catch (albumErr) {
            console.warn('⚠️ Failed to add photo to selected album:', albumErr);
          }
        }
      } catch (error: any) {
        console.error('❌ Failed to create photo record:', {
          error: error.response?.data?.detail || error.message,
          status: error.response?.status,
          data: photoData
        });
        throw new Error(`Failed to create photo record: ${error.response?.data?.detail || error.message}`);
      }
      
      // Try to detect faces with retries
      let faceCount = 0;
      try {
        console.log('🤖 Starting face detection...');
        const formData = new FormData();
        
        if (Platform.OS === 'web') {
          const blob = await fetch(imageResult.uri).then(r => r.blob());
          formData.append('file', blob, uploadUrlResponse.sanitizedFilename);
        } else {
          formData.append('file', {
            uri: imageResult.uri,
            type: mimeType,
            name: uploadUrlResponse.sanitizedFilename,
          } as any);
        }
        
        const faceResult = await facesAPI.detectAndStore(formData, photo.id, userId);
        faceCount = faceResult.faces?.length || 0;
        console.log('✅ Face detection completed | Faces found:', faceCount);
      } catch (faceError: any) {
        console.warn('⚠️ Face detection skipped:', faceError.message || faceError);
      }
      
      Alert.alert(
        'Success!', 
        `Photo uploaded successfully!${faceCount > 0 ? ` Found ${faceCount} faces.` : ''}`
      );

      // Wait briefly for S3 propagation then reload
      console.log('⏳ Waiting for S3 propagation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('🔄 Reloading photos...');
      await loadUserData();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to upload photo. Please try again.';
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploading(false);
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Photos</Text>
        <View style={styles.headerTabs}>
          <TouchableOpacity onPress={() => setTab('photos')} style={[styles.headerTabBtn, tab==='photos' && styles.headerTabActive]}>
            <Text style={[styles.headerTabText, tab==='photos' && styles.headerTabTextActive]}>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('albums')} style={[styles.headerTabBtn, tab==='albums' && styles.headerTabActive]}>
            <Text style={[styles.headerTabText, tab==='albums' && styles.headerTabTextActive]}>Albums</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={onSettingsPress}
          activeOpacity={0.7}
        >
          <Text style={styles.profileButtonText}>⚙</Text>
        </TouchableOpacity>
      </View>
      
      {/* Tabs */}
      {/* Removed top Photos/Albums toggle; now in header */}

      {/* Below: Me/Everyone icon-only toggle */}
      <View style={styles.scopeIconToggle}>
        <TouchableOpacity onPress={() => setScope('mine')} style={[styles.scopeIconBtn, scope==='mine' && styles.scopeBtnActive]}>
          <Text style={[styles.scopeIconText, scope==='mine' && styles.scopeTextActive]}>👤</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScope('everyone')} style={[styles.scopeIconBtn, scope==='everyone' && styles.scopeBtnActive]}>
          <Text style={[styles.scopeIconText, scope==='everyone' && styles.scopeTextActive]}>👥</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading your photos...</Text>
        </View>
      ) : tab === 'photos' ? (
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
          contentContainerStyle={{ paddingBottom: 16, minHeight: 200 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No Photos Yet</Text>
              <Text style={styles.emptySubtext}>Tap the + button below to add your first photo</Text>
            </View>
          }
          ListFooterComponent={
            albums.length > 0 ? (
              <View style={styles.albumsSection}>
                <View style={styles.albumsHeader}>
                  <Text style={styles.albumsTitle}>Albums</Text>
                  <TouchableOpacity><Text style={styles.albumsModify}>Modify</Text></TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumsRow}>
                  {albums.map((a) => (
                  <AlbumCard
                      key={a.id}
                      title={a.name}
                    count={albumCounts[a.id] ?? (a as any)?.photo_count ?? (a.photo_ids?.length || 0)}
                      photos={albumPreviews[a.id] || []}
                      userId={userId}
                      onPress={() => setOpenAlbumId(a.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null
          } 
        />
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 }}
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={[styles.floatingAddButton, uploading && styles.buttonDisabled]} 
        onPress={() => setShowAddMenu(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingAddButtonText}>+</Text>
      </TouchableOpacity>

      {/* Add Menu (Action Sheet) */}
      <Modal visible={showAddMenu} transparent animationType="fade" onRequestClose={() => setShowAddMenu(false)}>
        <View style={styles.menuOverlay}>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                // Close menu first, then open create-album modal to avoid iOS modal stacking freeze
                setShowAddMenu(false);
                setTimeout(() => setShowNewAlbum(true), 300);
              }}
            >
              <Text style={styles.menuItemText}>New Album</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                // Close menu first, then open album picker to avoid iOS modal stacking freeze
                setShowAddMenu(false);
                setTimeout(() => setShowAlbumPicker({ purpose: 'upload-new' }), 300);
              }}
            >
              <Text style={styles.menuItemText}>Add To Album</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuCancel]}
              onPress={() => {
                setTimeout(() => setShowAddMenu(false), 0);
              }}
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
          } catch {}
        }}
      />

      <AlbumPickerModal
        visible={!!showAlbumPicker}
        userId={userId}
        defaultToMyPhotos={true}
        onClose={() => setShowAlbumPicker(null)}
        onPick={async (albumId) => {
          try {
            if (showAlbumPicker?.purpose === 'assign-existing') {
              const photoId = showAlbumPicker?.photoId;
              if (photoId) {
                await albumsAPI.addPhotosToAlbum(albumId, userId, [photoId]);
              }
            } else if (showAlbumPicker?.purpose === 'upload-new') {
              await handlePhotoUpload(albumId);
            }

            // refresh previews
            const previews: Record<string, Photo[]> = {} as any;
            const userAlbums = await albumsAPI.getUserAlbums(userId, scope === 'everyone');
            setAlbums(userAlbums);
            await Promise.all(userAlbums.slice(0, 12).map(async (a: any) => {
              try {
                const res = await albumsAPI.getAlbumPhotos(a.id, userId);
                previews[a.id] = res.photos.slice(0, 4);
              } catch {}
            }));
            setAlbumPreviews(previews);
          } catch (e) {
            console.log('Album operation failed', e);
          } finally {
            setShowAlbumPicker(null);
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
  },
  scopeToggle: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -50 } as any],
  },
  scopeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  scopeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  scopeText: { color: 'rgba(255,255,255,0.75)' },
  scopeTextActive: { color: '#fff', fontWeight: '700' },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: {
    fontSize: 20,
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
  scopeIconToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  scopeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeIconText: { color: 'rgba(255,255,255,0.75)', fontSize: 16 },
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
  },
  albumsSection: { marginTop: 16 },
  albumsHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  albumsTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  albumsModify: { color: '#0a84ff' },
  albumsRow: { paddingHorizontal: 16, paddingBottom: 24 },
  albumsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 8 },
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
  floatingAddButton: {
    position: 'absolute',
    bottom: 30,
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
}); 
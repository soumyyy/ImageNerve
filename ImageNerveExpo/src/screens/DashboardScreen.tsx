import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pickImage } from '../utils/imageUtils';
import { getMimeType } from '../utils/fileUtils';
import { photosAPI, facesAPI } from '../services/api';
import { Photo } from '../types';
import { PhotoImage } from '../components/PhotoImage';
import { PhotoViewer } from '../components/PhotoViewer';

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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  
  // Test user ID for development
  const userId = 'test-user-001';

  useEffect(() => {
    // Only load data on mount, no test needed in production
    loadUserData();
  }, []);

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
      // Load user's photos
      console.log('🔍 Loading photos for user:', userId);
      const userPhotos = await photosAPI.getUserPhotos(userId);
      console.log('📸 Loaded photos:', userPhotos);
      console.log('📊 Photo count:', userPhotos.length);
      
      // Log each photo's details
      userPhotos.forEach((photo: Photo, index: number) => {
        console.log(`📷 Photo ${index + 1}:`, {
          id: photo.id,
          filename: photo.filename,
          s3_url: photo.s3_url,
          user_id: photo.user_id
        });
      });
      
      setPhotos(userPhotos);
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      Alert.alert('Error', 'Failed to load your photos');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async () => {
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
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Photos</Text>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={onSettingsPress}
          activeOpacity={0.7}
        >
          <Text style={styles.profileButtonText}>⚙</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading your photos...</Text>
          </View>
        ) : photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <TouchableOpacity 
                key={photo.id} 
                style={styles.photoItem} 
                activeOpacity={0.7}
                onPress={() => handlePhotoPress(index)}
              >
                <PhotoImage photo={photo} userId={userId} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No Photos Yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button below to add your first photo
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={[styles.floatingAddButton, uploading && styles.buttonDisabled]} 
        onPress={handlePhotoUpload}
        disabled={uploading}
        activeOpacity={0.8}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.floatingAddButtonText}>+</Text>
        )}
      </TouchableOpacity>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
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
}); 
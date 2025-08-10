import axios from 'axios';
import { Platform } from 'react-native';
import { Photo, Album, FaceCluster, User } from '../types';
import { sanitizeFilename } from '../utils/fileUtils';
import { getApiUrl } from '../config/api';

const API_BASE_URL = getApiUrl();

console.log('🌐 Using API URL:', API_BASE_URL, '| Platform:', Platform.OS);

// URL cache for presigned URLs
const urlCache = new Map<string, { url: string; expires: number }>();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Test the API connection
(async () => {
  try {
    console.log('🧪 Testing API connection...');
    console.log('🔗 Testing URL:', API_BASE_URL);
    
    const response = await api.get('/');
    console.log('✅ API connection successful:', {
      status: response.status,
      url: API_BASE_URL,
      data: response.data
    });
  } catch (error: any) {
    console.error('❌ API connection failed:', {
      url: API_BASE_URL,
      error: error.message,
      code: error.code,
      response: error.response?.data
    });
  }
})();

// Photos API
export const photosAPI = {
  getUploadUrl: async (filename: string, userId: string) => {
    const sanitizedFilename = sanitizeFilename(filename);
    const params = new URLSearchParams({
      filename: sanitizedFilename,
      user_id: userId
    });
    console.log('🔄 Getting upload URL | Original:', filename, '| Sanitized:', sanitizedFilename);
    const response = await api.post(`/photos/s3/upload-url?${params.toString()}`);
    return {
      ...response.data,
      sanitizedFilename  // Return sanitized name for later use
    };
  },
  
  getThumbnailUrl: (filename: string, width: number = 320, quality: number = 60) => {
    const base = API_BASE_URL;
    // Streamed thumbnail endpoint (no presign needed)
    return `${base}/photos/thumb?filename=${encodeURIComponent(filename)}&w=${width}&q=${quality}`;
  },

  createPhoto: async (photoData: {
    user_id: string;
    s3_url: string;
    filename: string;
    tags?: string[];
    description?: string;
    is_public?: boolean;
    album_ids?: string[];
    skip_default_album?: boolean;
  }) => {
    console.log('📤 Creating photo record:', {
      filename: photoData.filename,
      user: photoData.user_id,
      url: photoData.s3_url
    });

    try {
      // Send as JSON body instead of URL parameters
      const requestUrl = `${API_BASE_URL}/photos/`;
      console.log('🔄 Sending POST request to:', requestUrl);
      console.log('📦 Request data:', JSON.stringify(photoData, null, 2));
      
      const response = await api.post('/photos/', photoData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // Increase timeout to 60 seconds for photo creation
      });
      
      console.log('✅ Photo record created:', {
        id: response.data.id,
        filename: response.data.filename,
        user: response.data.user_id
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to create photo record:', {
        url: `${API_BASE_URL}/photos/`,
        error: error.response?.data?.detail || error.message,
        status: error.response?.status,
        code: error.code,
        data: photoData,
        response: error.response?.data
      });
      throw error;
    }
  },

  getUserPhotos: async (userId: string, opts?: { limit?: number; before?: string }) => {
    try {
      const limit = opts?.limit ?? 50;
      const before = opts?.before ? `&before=${encodeURIComponent(opts.before)}` : '';
      const url = `/photos/?user_id=${userId}&limit=${limit}${before}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get user photos:', {
        error: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  },

  getDownloadUrl: async (filename: string, userId: string) => {
    const cacheKey = `${filename}_${userId}`;
    const cached = urlCache.get(cacheKey);
    
    // Check cache with 5-minute safety margin
    if (cached && cached.expires > Date.now() + 300000) {
      console.log('🎯 Cache hit for:', filename);
      return { url: cached.url };
    }

    console.log('🔄 Cache miss for:', filename);
    const response = await api.get(`/photos/s3/download-url?filename=${filename}&user_id=${userId}`);
    
    // Cache the URL with expiration (1 hour - 5 minutes safety margin)
    urlCache.set(cacheKey, {
      url: response.data.url,
      expires: Date.now() + 3300000 // 55 minutes
    });
    
    return response.data;
  },

  getWebDownloadStreamUrl: (filename: string) => {
    // For web, stream through backend proxy to avoid S3 CORS
    return `${API_BASE_URL}/photos/s3/proxy-download?filename=${encodeURIComponent(filename)}`;
  },

  getPublicPhotos: async () => {
    const response = await api.get('/photos/public');
    return response.data;
  },
  deletePhoto: async (photoId: string, userId: string) => {
    const url = `/photos/${photoId}?user_id=${userId}`;
    try {
      console.log('🗑️ Deleting photo:', { photoId, userId, url: `${API_BASE_URL}${url}` });
      const response = await api.delete(url);
      console.log('✅ Delete response:', response.status, response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Delete failed:', {
        url: `${API_BASE_URL}${url}`,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },
};

// Face Recognition API
export const facesAPI = {
  detectFaces: async (imageFile: any) => {
    const formData = new FormData();
    formData.append('file', imageFile);
    
    const response = await api.post('/faces/detect', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  detectAndStore: async (formData: FormData, photoId: string, userId: string) => {
    const response = await api.post(`/faces/detect-and-store?photo_id=${photoId}&user_id=${userId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  clusterFaces: async (userId: string, eps: number = 0.3, minSamples: number = 2) => {
    const response = await api.post(`/faces/cluster?user_id=${userId}&eps=${eps}&min_samples=${minSamples}`);
    return response.data;
  },

  getClusters: async (userId: string) => {
    const response = await api.get(`/faces/clusters?user_id=${userId}`);
    return response.data;
  },

  setProfileFace: async (formData: FormData, userId: string) => {
    const response = await api.post(`/faces/profile?user_id=${userId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getMyFacePhotos: async (userId: string, threshold: number = 0.45, limit: number = 200) => {
    const response = await api.get(`/faces/me/photos?user_id=${userId}&threshold=${threshold}&limit=${limit}`);
    return response.data as { success: boolean; photos: Photo[] };
  },

  setProfileFaceBatch: async (formData: FormData, userId: string) => {
    const response = await api.post(`/faces/profile/batch?user_id=${userId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data as { success: boolean; accepted: number; rejected: number; suggested_threshold?: number; diagnostics?: any[] };
  },

  getProfileStatus: async (userId: string) => {
    const response = await api.get(`/faces/profile/status?user_id=${userId}`);
    return response.data as { exists: boolean; threshold?: number };
  },

  deleteProfileFace: async (userId: string) => {
    const response = await api.delete(`/faces/profile?user_id=${userId}`);
    return response.data;
  },
};

// Albums API
export const albumsAPI = {
  createAlbum: async (albumData: {
    userId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
    coverPhotoId?: string;
  }) => {
    const params = new URLSearchParams();
    params.append('user_id', albumData.userId);
    params.append('name', albumData.name);
    if (albumData.description) params.append('description', albumData.description);
    if (typeof albumData.isPublic === 'boolean') params.append('is_public', String(albumData.isPublic));
    if (albumData.coverPhotoId) params.append('cover_photo_id', albumData.coverPhotoId);
    const response = await api.post(`/albums/?${params.toString()}`);
    return response.data;
  },

  getUserAlbums: async (userId: string, includePublic: boolean = false) => {
    const response = await api.get(`/albums/?user_id=${userId}&include_public=${includePublic}`);
    return response.data;
  },

  getAlbum: async (albumId: string, userId?: string) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await api.get(`/albums/${albumId}${params}`);
    return response.data;
  },

  listPublicAlbums: async (limit: number = 50) => {
    const response = await api.get(`/albums/public?limit=${limit}`);
    return response.data;
  },

  getAlbumPhotos: async (albumId: string, userId?: string) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await api.get(`/albums/${albumId}/photos${params}`);
    return response.data as { album_id: string; photos: Photo[]; photo_count: number };
  },

  getAlbumStats: async (albumId: string, userId?: string) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await api.get(`/albums/${albumId}/stats${params}`);
    return response.data;
  },

  updateAlbum: async (
    albumId: string,
    params: { userId: string; name?: string; description?: string; isPublic?: boolean; coverPhotoId?: string }
  ) => {
    const qs = new URLSearchParams();
    qs.append('user_id', params.userId);
    if (typeof params.name === 'string') qs.append('name', params.name);
    if (typeof params.description === 'string') qs.append('description', params.description);
    if (typeof params.isPublic === 'boolean') qs.append('is_public', String(params.isPublic));
    if (typeof params.coverPhotoId === 'string') qs.append('cover_photo_id', params.coverPhotoId);
    const response = await api.put(`/albums/${albumId}?${qs.toString()}`);
    return response.data;
  },

  deleteAlbum: async (albumId: string, userId: string) => {
    const response = await api.delete(`/albums/${albumId}?user_id=${userId}`);
    return response.data;
  },

  addPhotosToAlbum: async (albumId: string, userId: string, photoIds: string[]) => {
    const qs = new URLSearchParams();
    qs.append('user_id', userId);
    photoIds.forEach((id) => qs.append('photo_ids', id));
    const response = await api.post(`/albums/${albumId}/photos?${qs.toString()}`);
    return response.data;
  },

  removePhotosFromAlbum: async (albumId: string, userId: string, photoIds: string[]) => {
    const qs = new URLSearchParams();
    qs.append('user_id', userId);
    photoIds.forEach((id) => qs.append('photo_ids', id));
    const response = await api.delete(`/albums/${albumId}/photos?${qs.toString()}`);
    return response.data;
  },
};

export default api; 
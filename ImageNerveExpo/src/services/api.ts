import axios from 'axios';
import { Photo, Album, FaceCluster, User } from '../types';
import { sanitizeFilename } from '../utils/fileUtils';

const API_BASE_URL = 'http://127.0.0.1:8000';

// URL cache for presigned URLs
const urlCache = new Map<string, { url: string; expires: number }>();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

  createPhoto: async (photoData: {
    user_id: string;
    s3_url: string;
    filename: string;
    tags?: string[];
    description?: string;
    is_public?: boolean;
  }) => {
    console.log('📤 Creating photo record:', {
      filename: photoData.filename,
      user: photoData.user_id,
      url: photoData.s3_url
    });

    try {
      // Send as JSON body instead of URL parameters
      console.log('🔄 Sending POST request to /photos with data:', photoData);
      const response = await api.post('/photos', photoData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Photo record created:', {
        id: response.data.id,
        filename: response.data.filename,
        user: response.data.user_id
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to create photo record:', {
        error: error.response?.data?.detail || error.message,
        status: error.response?.status,
        data: photoData
      });
      throw error;
    }
  },

  getUserPhotos: async (userId: string) => {
    console.log('📤 Getting photos for user:', userId);
    const response = await api.get(`/photos/?user_id=${userId}`);
    console.log('📥 User photos response:', response.data);
    return response.data;
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

  getPublicPhotos: async () => {
    const response = await api.get('/photos/public');
    return response.data;
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
};

// Albums API
export const albumsAPI = {
  createAlbum: async (albumData: {
    user_id: string;
    name: string;
    description?: string;
    is_public?: boolean;
    cover_photo_id?: string;
  }) => {
    const response = await api.post('/albums/', albumData);
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
};

export default api; 
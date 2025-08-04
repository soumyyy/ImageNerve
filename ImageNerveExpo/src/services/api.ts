import axios from 'axios';
import { Photo, Album, FaceCluster, User } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Photos API
export const photosAPI = {
  getUploadUrl: async (filename: string) => {
    const response = await api.post(`/photos/s3/upload-url?filename=${filename}`);
    return response.data;
  },

  createPhoto: async (photoData: {
    user_id: string;
    s3_url: string;
    filename: string;
    tags?: string[];
    description?: string;
    is_public?: boolean;
  }) => {
    const params = new URLSearchParams({
      user_id: photoData.user_id,
      s3_url: photoData.s3_url,
      filename: photoData.filename,
      description: photoData.description || '',
      is_public: photoData.is_public ? 'true' : 'false',
    });
    
    if (photoData.tags && photoData.tags.length > 0) {
      params.append('tags', photoData.tags.join(','));
    }
    
    const response = await api.post(`/photos/?${params.toString()}`);
    return response.data;
  },

  getUserPhotos: async (userId: string) => {
    const response = await api.get(`/photos/?user_id=${userId}`);
    return response.data;
  },

  getDownloadUrl: async (filename: string) => {
    const response = await api.get(`/photos/s3/download-url?filename=${filename}`);
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
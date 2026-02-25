export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'photographer';
  profile_pic_url?: string;
  created_at: string;
  last_login?: string;
  settings?: Record<string, any>;
}

export interface Photo {
  id: string;
  user_id: string;
  s3_url: string;
  filename: string;
  tags?: string[];
  uploaded_at: string;
  photo_metadata?: Record<string, any>;
  description?: string;
  is_public: boolean;
  location?: any;
}

export interface FaceEmbedding {
  id: string;
  photo_id: string;
  user_id: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  created_at: string;
}

export interface FaceCluster {
  id: string;
  user_id: string;
  face_ids: string[];
  label: string;
  created_at: string;
}

export interface Album {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  photo_ids: string[];
  cluster_ids: string[];
  cover_photo_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
} 
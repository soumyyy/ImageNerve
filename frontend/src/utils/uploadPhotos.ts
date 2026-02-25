import { Platform } from 'react-native';
import { photosAPI, facesAPI, albumsAPI } from '../services/api';
import { getMimeType } from './fileUtils';
import { Photo } from '../types';

export interface ImagePickerResult {
  uri: string;
  type: string;
  name: string;
  size?: number;
}

async function uploadOneImage(
  userId: string,
  imageResult: ImagePickerResult,
  uploadUrlResponse: { upload_url: string; file_url: string; sanitizedFilename: string },
  mimeType: string,
  uploadBody: Blob,
  targetAlbumId?: string,
): Promise<Photo> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!uploadUrlResponse.upload_url) throw new Error('No upload URL provided');
      const response = await Promise.race([
        fetch(uploadUrlResponse.upload_url, {
          method: 'PUT',
          body: uploadBody,
          headers: { 'Content-Type': mimeType },
          mode: 'cors',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 30000)),
      ]) as Response;
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Upload failed ${response.status}: ${errText}`);
      }
      break;
    } catch (e: any) {
      lastError = e;
      if (attempt === maxRetries) throw e;
      await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempt - 1), 10000)));
    }
  }
  if (lastError) throw lastError;

  const photoData = {
    user_id: userId,
    s3_url: uploadUrlResponse.file_url,
    filename: uploadUrlResponse.sanitizedFilename,
    description: 'Uploaded from mobile app',
    is_public: false,
    album_ids: targetAlbumId ? [targetAlbumId] : undefined,
    skip_default_album: !!targetAlbumId,
    photo_metadata: {
      file_size: uploadBody.size,
      format: mimeType,
      dimensions: 'Unknown',
      uploaded_from: 'mobile_app',
      upload_timestamp: new Date().toISOString(),
    },
  };
  const photo = await photosAPI.createPhoto(photoData);
  if (targetAlbumId) {
    try {
      await albumsAPI.addPhotosToAlbum(targetAlbumId, userId, [photo.id]);
    } catch {
      // ignore
    }
  }
  return photo;
}

export interface UploadPhotosBatchResult {
  uploadedPhotos: Photo[];
  faceCount: number;
}

/**
 * Upload multiple images: S3 + create photo record + optional face detection (when total <= 3).
 * Calls onProgress(current, total) for each photo.
 */
export async function uploadPhotosBatch(
  userId: string,
  images: ImagePickerResult[],
  options: {
    targetAlbumId?: string;
    onProgress?: (current: number, total: number) => void;
  },
): Promise<UploadPhotosBatchResult> {
  const { targetAlbumId, onProgress } = options;
  const total = images.length;
  const uploadedPhotos: Photo[] = [];
  let faceCount = 0;
  const runFaceDetection = total <= 3;

  for (let i = 0; i < images.length; i++) {
    onProgress?.(i, total);
    const imageResult = images[i];
    const mimeType = getMimeType(imageResult.name);
    const uploadUrlResponse = await photosAPI.getUploadUrl(imageResult.name, userId);
    const uploadBody: Blob =
      Platform.OS === 'web'
        ? await fetch(imageResult.uri).then((r) => r.blob())
        : await (await fetch(imageResult.uri)).blob();
    const photo = await uploadOneImage(
      userId,
      imageResult,
      uploadUrlResponse,
      mimeType,
      uploadBody,
      targetAlbumId,
    );
    uploadedPhotos.push(photo);

    if (runFaceDetection) {
      try {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          formData.append('file', await fetch(imageResult.uri).then((r) => r.blob()), uploadUrlResponse.sanitizedFilename);
        } else {
          formData.append('file', {
            uri: imageResult.uri,
            type: mimeType,
            name: uploadUrlResponse.sanitizedFilename,
          } as any);
        }
        const faceResult = await facesAPI.detectAndStore(formData, photo.id, userId);
        faceCount += faceResult.faces?.length || 0;
      } catch {
        // skip
      }
    }
  }

  onProgress?.(total, total);
  return { uploadedPhotos, faceCount };
}

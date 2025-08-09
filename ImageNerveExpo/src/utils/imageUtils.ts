import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export interface ImagePickerResult {
  uri: string;
  type: string;
  name: string;
  size?: number;
}

export const requestPermissions = async () => {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Sorry, we need camera roll permissions to make this work!');
    }
  }
};

export const pickImage = async (): Promise<ImagePickerResult | null> => {
  try {
    await requestPermissions();
    
    let result;
    
    if (Platform.OS === 'web') {
      // For web, use document picker as fallback
      result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: false,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.name,
          size: asset.size,
        };
      }
    } else {
      // For iOS and Android
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: false,
        quality: 1,
        presentationStyle: 'fullScreen',
      } as any);
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          type: 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
          size: asset.fileSize,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
};

export const createFormData = (imageResult: ImagePickerResult, additionalData?: Record<string, any>) => {
  const formData = new FormData();
  
  // For React Native (iOS/Android)
  if (Platform.OS !== 'web') {
    formData.append('file', {
      uri: imageResult.uri,
      type: imageResult.type,
      name: imageResult.name,
    } as any);
  } else {
    // For web, we need to handle File objects differently
    fetch(imageResult.uri)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], imageResult.name, { type: imageResult.type });
        formData.append('file', file);
      });
  }
  
  // Add any additional data
  if (additionalData) {
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });
  }
  
  return formData;
};
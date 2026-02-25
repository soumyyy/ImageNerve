import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Prefer environment variable when available (set EXPO_PUBLIC_API_URL)
const envUrl = process.env.EXPO_PUBLIC_API_URL;

// Get the API URL based on platform and environment
export const getApiUrl = () => {
  if (envUrl) return envUrl;

  // Try to derive your dev machine's IP from the Expo host URI
  // hostUri looks like "192.168.1.23:8081" or "localhost:8081"
  const hostUri = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
  let lanHost: string | undefined;
  if (hostUri && typeof hostUri === 'string') {
    lanHost = hostUri.split(':')[0];
  }

  if (Platform.OS === 'android') {
    // Android emulator
    if (lanHost === 'localhost' || lanHost === '127.0.0.1') return 'http://10.0.2.2:8000';
    return lanHost ? `http://${lanHost}:8000` : 'http://10.0.2.2:8000';
  }

  if (Platform.OS === 'ios') {
    // iOS simulator uses your Mac's localhost; real device needs LAN host
    if (lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
      return `http://${lanHost}:8000`;
    }
    return 'http://127.0.0.1:8000';
  }

  // Web
  if (lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
    return `http://${lanHost}:8000`;
  }
  return 'http://127.0.0.1:8000';
};
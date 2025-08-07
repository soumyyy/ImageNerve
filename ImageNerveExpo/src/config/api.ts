import { Platform } from 'react-native';

// Get the API URL based on platform and environment
export const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:8000';
  } else if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine
    return 'http://10.0.2.2:8000';
  } else {
    // For iOS devices and simulator, use localhost
    return 'http://127.0.0.1:8000';
  }
};
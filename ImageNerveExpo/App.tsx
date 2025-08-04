import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Image, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { pickImage, createFormData, ImagePickerResult } from './src/utils/imageUtils';
import { photosAPI, facesAPI, albumsAPI } from './src/services/api';
import { Photo, Album } from './src/types';

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// PhotoImage Component with fallback strategies
function PhotoImage({ photo }: { photo: Photo }) {
  const [imageUri, setImageUri] = useState(photo.s3_url);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Generate alternative URLs to try
  const getAlternativeUrls = (originalUrl: string) => {
    const filename = originalUrl.split('/').pop();
    const bucketName = 'imagenervetesting'; // Your bucket name
    
    return [
      originalUrl, // Original URL
      `https://${bucketName}.s3.amazonaws.com/${filename}`, // Standard format
      `https://${bucketName}.s3.ap-south-1.amazonaws.com/${filename}`, // Regional format
      `https://s3.ap-south-1.amazonaws.com/${bucketName}/${filename}`, // Alternative format
    ];
  };

  const tryNextUrl = async () => {
    const urls = getAlternativeUrls(photo.s3_url);
    const currentIndex = urls.indexOf(imageUri);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < urls.length) {
      console.log(`Trying alternative URL ${nextIndex + 1}:`, urls[nextIndex]);
      setImageUri(urls[nextIndex]);
      setHasError(false);
    } else {
      // Try getting a presigned download URL as final fallback
      try {
        console.log('Trying presigned download URL for:', photo.filename);
        const downloadResponse = await photosAPI.getDownloadUrl(photo.filename);
        setImageUri(downloadResponse.url);
        setHasError(false);
      } catch (error) {
        console.log('All URL formats failed for photo:', photo.filename);
        setHasError(true);
      }
    }
  };

  const handleImageError = (error: any) => {
    console.log('Image load failed:', imageUri, error.nativeEvent?.error || error);
    setIsLoading(false);
    tryNextUrl();
  };

  const handleImageLoad = () => {
    console.log('Image loaded successfully:', imageUri);
    setIsLoading(false);
    setHasError(false);
  };

  if (hasError) {
    return (
      <View style={[styles.photoImage, styles.photoError]}>
        <Text style={styles.photoErrorText}>📷</Text>
        <Text style={styles.photoErrorSubtext}>{photo.filename}</Text>
      </View>
    );
  }

  return (
    <>
      {isLoading && (
        <View style={[styles.photoImage, styles.photoLoading]}>
          <ActivityIndicator size="small" color="#e94560" />
        </View>
      )}
      <Image 
        source={{ 
          uri: imageUri,
          cache: 'reload' // Force reload to avoid cache issues
        }}
        style={[styles.photoImage, isLoading && { position: 'absolute' }]}
        onError={handleImageError}
        onLoad={handleImageLoad}
        onLoadStart={() => setIsLoading(true)}
        resizeMode="cover"
      />
    </>
  );
}

// Splash Screen Component
function SplashScreen({ navigation }: any) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate('Login');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Text style={styles.appName}>ImageNerve</Text>
      </View>
    </SafeAreaView>
  );
}

// Login Screen Component
function LoginScreen({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigation.navigate('OTP', { phoneNumber });
    } catch (error) {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Text style={styles.title}>Welcome to ImageNerve</Text>
        <Text style={styles.subtitle}>Enter your mobile number to continue</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter mobile number"
            placeholderTextColor="#888"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>
        
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Sending OTP...' : 'Login with Mobile'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// OTP Screen Component
function OTPScreen({ navigation, route }: any) {
  const { phoneNumber } = route.params;
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 4) {
      Alert.alert('Error', 'Please enter the complete OTP');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigation.navigate('MainApp');
    } catch (error) {
      Alert.alert('Error', 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          We've sent a verification code to {phoneNumber}
        </Text>
        
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => {
                const newOtp = [...otp];
                newOtp[index] = text;
                setOtp(newOtp);
              }}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>
        
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Dashboard Screen Component
function DashboardScreen() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Test user ID for development
  const userId = 'test-user-001';

  useEffect(() => {
    loadUserData();
    
    // Test API connectivity
    testAPIConnection();
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
      const userPhotos = await photosAPI.getUserPhotos(userId);
      console.log('Loaded photos:', userPhotos);
      setPhotos(userPhotos);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load your photos');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async () => {
    try {
      setUploading(true);
      console.log('Starting photo upload...');
      
      // Pick image using cross-platform picker
      const imageResult = await pickImage();
      if (!imageResult) {
        console.log('No image selected');
        return;
      }
      console.log('Image selected:', imageResult.name);

      // Get presigned URL for S3 upload
      console.log('Getting upload URL...');
      const uploadUrlResponse = await photosAPI.getUploadUrl(imageResult.name);
      console.log('Upload URL received:', uploadUrlResponse);
      
      // Upload to S3
      console.log('Preparing upload body...');
      let uploadBody;
      if (Platform.OS === 'web') {
        uploadBody = await fetch(imageResult.uri).then(r => r.blob());
      } else {
        // For React Native, we need to use FormData or read the file differently
        const response = await fetch(imageResult.uri);
        uploadBody = await response.blob();
      }

      console.log('Uploading to S3...');
      const uploadResponse = await fetch(uploadUrlResponse.upload_url, {
        method: 'PUT',
        body: uploadBody,
        headers: {
          'Content-Type': imageResult.type,
        },
      });

      if (!uploadResponse.ok) {
        console.error('S3 upload failed:', uploadResponse.status, uploadResponse.statusText);
        throw new Error(`Failed to upload to S3: ${uploadResponse.status}`);
      }
      console.log('S3 upload successful');

      // Create photo record in database
      console.log('Creating photo record in database...');
      const photoData = {
        user_id: userId,
        s3_url: uploadUrlResponse.file_url,
        filename: imageResult.name,
        description: 'Uploaded from mobile app',
        is_public: false,
      };

      const createdPhoto = await photosAPI.createPhoto(photoData);
      console.log('Photo record created:', createdPhoto);
      
      // Try to detect faces (optional - skip if not working)
      let faceCount = 0;
      try {
        console.log('Starting face detection...');
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const blob = await fetch(imageResult.uri).then(r => r.blob());
          formData.append('file', blob, imageResult.name);
        } else {
          formData.append('file', {
            uri: imageResult.uri,
            type: imageResult.type,
            name: imageResult.name,
          } as any);
        }
        
        const faceResult = await facesAPI.detectAndStore(formData, createdPhoto.id, userId);
        faceCount = faceResult.faces?.length || 0;
        console.log('Face detection successful:', faceCount, 'faces found');
      } catch (faceError: any) {
        console.log('Face detection skipped (photo upload successful):', faceError.message || faceError);
      }
      
      Alert.alert(
        'Success!', 
        `Photo uploaded successfully!${faceCount > 0 ? ` Found ${faceCount} faces.` : ''}`
      );

      // Reload photos
      console.log('Reloading user photos...');
      await loadUserData();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to upload photo. Please try again.';
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Image Nerve</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerButton, uploading && styles.buttonDisabled]} 
            onPress={handlePhotoUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.headerButtonText}>+</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Text style={styles.headerButtonText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Photos ({photos.length})</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 20 }} />
          ) : photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <TouchableOpacity key={photo.id} style={styles.photoItem}>
                  <PhotoImage photo={photo} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No photos yet</Text>
              <Text style={styles.emptySubtext}>Tap the + button to upload your first photo</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Settings Screen Component
function SettingsScreen() {
  const [clustering, setClustering] = useState(false);
  const [clusters, setClusters] = useState([]);
  const userId = 'test-user-001'; // Test user ID

  const handleClusterFaces = async () => {
    setClustering(true);
    try {
      const result = await facesAPI.clusterFaces(userId);
      Alert.alert('Success!', `Created ${result.clusters?.length || 0} face clusters`);
      
      // Load clusters
      const userClusters = await facesAPI.getClusters(userId);
      setClusters(userClusters);
    } catch (error) {
      console.error('Clustering error:', error);
      Alert.alert('Error', 'Failed to cluster faces. Please try again.');
    } finally {
      setClustering(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Settings</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Profile</Text>
          <View style={styles.profileItem}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>Soumya</Text>
          </View>
          <View style={styles.profileItem}>
            <Text style={styles.label}>Mail</Text>
            <Text style={styles.value}>soumya@example.com</Text>
          </View>
          <View style={styles.profileItem}>
            <Text style={styles.label}>Number</Text>
            <Text style={styles.value}>+91 98765 43210</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Face Recognition</Text>
          <TouchableOpacity 
            style={[styles.button, clustering && styles.buttonDisabled]} 
            onPress={handleClusterFaces}
            disabled={clustering}
          >
            {clustering ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.buttonText}>Clustering Faces...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>🤖 Cluster My Faces</Text>
            )}
          </TouchableOpacity>
          
          {clusters.length > 0 && (
            <View style={styles.clusterInfo}>
              <Text style={styles.label}>Face Clusters: {clusters.length}</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Search Screen Component
function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Search</Text>
        
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for photos..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relevant Searches</Text>
          <View style={styles.relevantSearches}>
            <Text style={styles.searchSuggestion}>Family photos</Text>
            <Text style={styles.searchSuggestion}>Wedding</Text>
            <Text style={styles.searchSuggestion}>Vacation</Text>
            <Text style={styles.searchSuggestion}>Portraits</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Main Tab Navigator
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#16213e',
        },
        tabBarActiveTintColor: '#0f3460',
        tabBarInactiveTintColor: '#e94560',
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🔍</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Navigator
function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainApp"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0f3460' },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="MainApp" component={MainTabNavigator} />
    </Stack.Navigator>
  );
}

// Main App Component
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isLargeScreen = screenWidth > 768;

// Calculate responsive values
const getResponsiveValue = (small: number, large: number) => isLargeScreen ? large : small;
const getPhotoItemWidth = () => {
  if (isWeb && isLargeScreen) {
    return (screenWidth - 100) / 6; // 6 columns on large screens
  } else if (isWeb) {
    return (screenWidth - 80) / 4; // 4 columns on medium screens
  } else {
    return (screenWidth - 60) / 3; // 3 columns on mobile
  }
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: getResponsiveValue(20, 40),
    maxWidth: isWeb ? 400 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 40,
  },
  otpInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    width: 60,
    height: 60,
    textAlign: 'center',
    fontSize: 24,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  headerButtonText: {
    fontSize: 18,
    color: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: getResponsiveValue(20, 40),
    maxWidth: isWeb ? 1200 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 18,
    color: '#ffffff',
  },
  albumCard: {
    width: 120,
    marginRight: 15,
  },
  albumImagePlaceholder: {
    width: 120,
    height: 80,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    marginBottom: 8,
  },
  albumName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  albumCount: {
    fontSize: 12,
    color: '#cccccc',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    justifyContent: isWeb ? 'flex-start' : 'space-between',
  },
  photoItem: {
    width: getPhotoItemWidth(),
    height: getPhotoItemWidth(),
    margin: isWeb ? 4 : 2,
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  label: {
    fontSize: 16,
    color: '#cccccc',
  },
  value: {
    fontSize: 16,
    color: '#ffffff',
  },
  logoutButton: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 30,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchSection: {
    marginBottom: 30,
  },
  searchInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 15,
  },
  relevantSearches: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 20,
  },
  searchSuggestion: {
    fontSize: 16,
    color: '#cccccc',
    paddingVertical: 8,
  },
  photoImage: {
    flex: 1,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clusterInfo: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
  },
  photoError: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  photoErrorText: {
    fontSize: 20,
    marginBottom: 4,
  },
  photoErrorSubtext: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  photoLoading: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
});

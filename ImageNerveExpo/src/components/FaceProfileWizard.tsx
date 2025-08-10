import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { facesAPI } from '../services/api';

interface FaceProfileWizardProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSaved?: (data: any) => void;
}

const REQUIRED_SHOTS = 3;
const PROMPTS = [
  'Look straight ahead',
  'Turn slightly left',
  'Turn slightly right',
];

const FaceProfileWizard: React.FC<FaceProfileWizardProps> = ({ visible, userId, onClose, onSaved }) => {
  const [shots, setShots] = useState<Array<{ uri: string }>>([]);
  const [showLive, setShowLive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  const takeShot = async () => {
    try {
      const camPerm = await requestPermission();
      if (camPerm?.status !== 'granted') {
        Alert.alert('Permission', 'Camera permission required');
        return;
      }
      // On web, fallback to file picker; on native, use ImagePicker camera
      if (typeof window !== 'undefined' && (window as any).navigator?.mediaDevices) {
        // Show live view overlay for guidance on web where possible
        if (Platform.OS === 'web') {
          // Direct live capture via CameraView is not supported on web; use ImagePicker as fallback
          const res = await ImagePicker.launchCameraAsync({ quality: 0.9 } as any);
          if (!res.canceled && res.assets?.[0]) setShots(prev => [...prev, { uri: res.assets![0].uri }]);
          return;
        }
      }
      const res = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.9 } as any);
      if (!res.canceled && res.assets?.[0]) setShots(prev => [...prev, { uri: res.assets![0].uri }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to capture');
    }
  };

  const saveProfile = async () => {
    if (shots.length < REQUIRED_SHOTS) return;
    try {
      setBusy(true);
      // For responsiveness: quickly generate embeddings server-side via batch endpoint
      const form = new FormData();
      shots.forEach((s, idx) => form.append('files', { uri: s.uri, name: `shot_${idx + 1}.jpg`, type: 'image/jpeg' } as any));
      const result = await facesAPI.setProfileFaceBatch(form, userId);
      if (!result.success) throw new Error('Failed to save profile');
      onSaved?.(result);
      Alert.alert('Saved', `Profile set. Accepted ${result.accepted}. Suggested threshold ${result.suggested_threshold ?? ''}`);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Set My Face</Text>
          <Text style={styles.subtitle}>Capture {REQUIRED_SHOTS} angles: straight, slight left, slight right.</Text>
          <View style={styles.guideBubble}><Text style={styles.guideText}>{PROMPTS[Math.min(shots.length, PROMPTS.length - 1)]}</Text></View>
          {Platform.OS !== 'web' && showLive && (
            <View style={{ height: 240, borderRadius: 12, overflow: 'hidden', marginTop: 10 }}>
              <CameraView style={{ flex: 1 }} facing="front" />
            </View>
          )}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.capture]} onPress={takeShot} disabled={busy}>
              <Text style={styles.btnText}>Capture</Text>
            </TouchableOpacity>
            <View style={styles.counter}><Text style={styles.counterText}>{shots.length}/{REQUIRED_SHOTS}</Text></View>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={onClose} disabled={busy}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.save, shots.length < REQUIRED_SHOTS && styles.disabled]} onPress={saveProfile} disabled={busy || shots.length < REQUIRED_SHOTS}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#111', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  capture: { backgroundColor: 'rgba(255,255,255,0.15)' },
  cancel: { backgroundColor: 'rgba(255,255,255,0.1)' },
  save: { backgroundColor: '#0a84ff' },
  disabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700' },
  counter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  counterText: { color: '#fff' },
  guideBubble: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  guideText: { color: '#fff' },
});

export default FaceProfileWizard;


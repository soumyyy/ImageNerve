import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
// Removed direct Camera rendering to avoid invalid element errors in Expo Go. We fallback to ImagePicker.
import * as ImageManipulator from 'expo-image-manipulator';
// (removed duplicate React import)
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
  const [showLive, setShowLive] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const takeShot = async () => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      setPermissionStatus(camPerm.status as any);
      if (camPerm?.status !== 'granted') {
        Alert.alert('Permission', 'Camera permission required');
        return;
      }
      if (Platform.OS === 'web') {
        // Web fallback to browser camera intent
        const res = await ImagePicker.launchCameraAsync({ quality: 0.9 } as any);
        if (!res.canceled && res.assets?.[0]) setShots(prev => [...prev, { uri: res.assets![0].uri }]);
        return;
      }
      // Native fallback: open camera UI; user taps shutter per shot
      const res = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.9 } as any);
      if (!res.canceled && res.assets?.[0]) {
        let uri = res.assets![0].uri;
        // Convert HEIC to JPEG if needed
        if (uri.toLowerCase().endsWith('.heic') || uri.toLowerCase().endsWith('.heif')) {
          try {
            const manipulated = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
            uri = manipulated.uri;
          } catch {}
        }
        setShots(prev => [...prev, { uri }]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to capture');
    }
  };

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      setPermissionStatus(perm.status as any);
      if (perm?.status !== 'granted') return;
      if (running) return;
      setRunning(true);
      setShots([]);
      setStep(0);
      // small warm-up delay
      await new Promise(r => setTimeout(r, 600));
      for (let i = 0; i < REQUIRED_SHOTS; i++) {
        setStep(i);
        await new Promise(r => setTimeout(r, 600));
        await takeShot();
      }
      setRunning(false);
      // auto-save
      await saveProfile();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
            <View style={styles.liveBox}>
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
              <View style={styles.maskContainer}>
                <View style={styles.circleMask}>
                  <View style={styles.progressRing}>
                    <Text style={styles.progressText}>{step + 1}/{REQUIRED_SHOTS}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          <View style={styles.row}>
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
  liveBox: { height: 260, borderRadius: 130, overflow: 'hidden', alignSelf: 'center', width: 260, marginTop: 12 },
  maskContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  circleMask: { width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  progressRing: { width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  progressText: { color: '#fff', fontWeight: '700' },
});

export default FaceProfileWizard;


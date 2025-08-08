import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Switch } from 'react-native';
import { albumsAPI } from '../services/api';

interface NewAlbumModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onCreated: (album: any) => void;
}

export const NewAlbumModal: React.FC<NewAlbumModalProps> = ({ visible, userId, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const album = await albumsAPI.createAlbum({ userId, name: name.trim(), description: description.trim() || undefined, isPublic: isPublic });
      onCreated(album);
      setName('');
      setDescription('');
      setIsPublic(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>New Album</Text>
          <TextInput
            style={styles.input}
            placeholder="Album name"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Description (optional)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <View style={styles.row}>
            <Text style={styles.label}>Public</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={onClose} disabled={saving}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.create, !name.trim() && styles.disabled]} onPress={create} disabled={!name.trim() || saving}>
              <Text style={styles.btnText}>Create</Text>
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
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, marginBottom: 12 },
  multiline: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { color: '#fff', fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  cancel: { backgroundColor: 'rgba(255,255,255,0.1)' },
  create: { backgroundColor: '#0a84ff' },
  disabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600' },
});

export default NewAlbumModal;


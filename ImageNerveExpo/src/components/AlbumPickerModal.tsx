import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { albumsAPI } from '../services/api';
import NewAlbumModal from './NewAlbumModal';

interface AlbumPickerModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onPick: (albumId: string) => void;
  defaultToMyPhotos?: boolean;
}

const AlbumPickerModal: React.FC<AlbumPickerModalProps> = ({ visible, userId, onClose, onPick, defaultToMyPhotos }) => {
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const MY_PHOTOS_ALBUM_NAME = 'My Photos';

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoading(true);
      try {
        const res = await albumsAPI.getUserAlbums(userId, false);
        // Exclude "My Photos" – it's auto-generated from face scans and not a valid target for adding photos
        const pickableAlbums = (res || []).filter((a: any) => a.name !== MY_PHOTOS_ALBUM_NAME);
        setAlbums(pickableAlbums);
        if (defaultToMyPhotos) {
          const my = res.find((a: any) => a.name === MY_PHOTOS_ALBUM_NAME);
          if (my) {
            onClose();
            setTimeout(() => onPick(my.id), 450);
            return;
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [visible, userId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Add to Album</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>×</Text></TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loading}><ActivityIndicator color="#fff" /></View>
          ) : (
            <FlatList
              data={albums}
              keyExtractor={(a) => a.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => { onPick(item.id); onClose(); }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemCount}>{item.photo_count ?? item.photo_ids?.length ?? 0}</Text>
                </TouchableOpacity>
              )}
              ListFooterComponent={
                <TouchableOpacity style={styles.newBtn} onPress={() => setShowNew(true)}>
                  <Text style={styles.newBtnText}>＋ New Album</Text>
                </TouchableOpacity>
              }
            />
          )}
        </View>
      </View>
      <NewAlbumModal
        visible={showNew}
        userId={userId}
        onClose={() => setShowNew(false)}
        onCreated={(album) => {
          setAlbums((prev) => [album, ...prev]);
          onPick(album.id);
          setShowNew(false);
          onClose();
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  close: { color: '#fff', fontSize: 24 },
  loading: { paddingVertical: 24 },
  item: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', justifyContent: 'space-between' },
  itemTitle: { color: '#fff', fontSize: 16 },
  itemCount: { color: 'rgba(255,255,255,0.6)' },
  newBtn: { padding: 16, alignItems: 'center' },
  newBtnText: { color: '#0a84ff', fontWeight: '700' },
});

export default AlbumPickerModal;


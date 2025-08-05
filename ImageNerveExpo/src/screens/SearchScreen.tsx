import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';

export const SearchScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.searchTitle}>Search</Text>
        
        <GlassCard style={styles.searchSection}>
          <TextInput
            style={styles.glassSearchInput}
            placeholder="Search for photos..."
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </GlassCard>
        
        <GlassCard style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Relevant Searches</Text>
          <View style={styles.relevantSearches}>
            <Text style={styles.searchSuggestion}>Family photos</Text>
            <Text style={styles.searchSuggestion}>Wedding</Text>
            <Text style={styles.searchSuggestion}>Vacation</Text>
            <Text style={styles.searchSuggestion}>Portraits</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  searchTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 30,
  },
  searchSection: {
    marginBottom: 24,
    padding: 20,
  },
  glassSearchInput: {
    fontSize: 16,
    color: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingsSection: {
    marginBottom: 24,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  relevantSearches: {
    paddingVertical: 8,
  },
  searchSuggestion: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
}); 
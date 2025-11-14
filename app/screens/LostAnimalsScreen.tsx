import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { lostAnimalsService, type LostAnimal as LostAnimalRecord } from '../services/lostAnimals';
import { cache } from '../services/cache';

type LostAnimalsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Reuse the service LostAnimal type to keep shapes aligned

const LostAnimalsScreen: React.FC = () => {
  const navigation = useNavigation<LostAnimalsScreenNavigationProp>();
  const [lostAnimals, setLostAnimals] = useState<LostAnimalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLostAnimals();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Deterministic refresh on focus (no arbitrary delay)
      loadLostAnimals();
      return () => {};
    }, [])
  );

  // Subscribe to lost-animal mutations to update list deterministically
  useEffect(() => {
    const unsubscribe = lostAnimalsService.subscribe((event: any) => {
      if (event?.type === 'created' && event?.record) {
        // Prepend the new record
        setLostAnimals((prev) => [event.record, ...prev]);
      } else if (event?.type === 'updated' && event?.record) {
        setLostAnimals((prev) => prev.map((a) => (a.id === event.record.id ? { ...a, ...event.record } : a)));
      } else if (event?.type === 'deleted' && event?.id) {
        setLostAnimals((prev) => prev.filter((a) => a.id !== event.id));
      } else {
        // Fallback: reload list
        loadLostAnimals();
      }
    });
    return unsubscribe;
  }, []);

  const loadLostAnimals = async () => {
    try {
      // Check cache first
      const cacheKey = 'lost_animals:active';
      const cached = cache.get<LostAnimalRecord[]>(cacheKey);
      
      if (cached) {
        setLostAnimals(cached);
        setLoading(false);
      }

      // Fetch fresh data
      const data = await lostAnimalsService.getActiveLostAnimals();
      setLostAnimals(data);
      
      // Update cache (5 minutes TTL)
      cache.set(cacheKey, data, 5 * 60 * 1000);
    } catch (error) {
      console.error('[LostAnimals] Error loading:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLostAnimals();
    setRefreshing(false);
  };

  const renderLostAnimalCard = ({ item }: { item: LostAnimalRecord }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('LostAnimalDetails', { lostAnimalId: item.id })}
    >
      <Image source={{ uri: item.photo_url_1 }} style={styles.cardImage} />
      
      {item.unviewed_matches_count > 0 && (
        <View style={styles.matchBadge}>
          <Ionicons name="notifications" size={16} color="#fff" />
          <Text style={styles.matchBadgeText}>{item.unviewed_matches_count}</Text>
        </View>
      )}

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.typeTag}>
            <Ionicons 
              name={item.animal_type === 'cat' ? 'paw' : 'paw-outline'} 
              size={14} 
              color="#fff" 
            />
            <Text style={styles.typeTagText}>
              {item.animal_type === 'cat' ? 'Cat' : 'Dog'}
            </Text>
          </View>
        </View>

        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#757575" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.last_seen_address}
            </Text>
          </View>
          
          {item.potential_matches_count > 0 && (
            <View style={styles.matchesRow}>
              <Ionicons name="search" size={14} color="#4CAF50" />
              <Text style={styles.matchesText}>
                {item.potential_matches_count} potential {item.potential_matches_count === 1 ? 'match' : 'matches'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lost & Found</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateLostAnimal')}
        >
          <Ionicons name="add-circle" size={28} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {loading && lostAnimals.length === 0 ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonImage} />
              <View style={styles.skeletonContent}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonText} />
                <View style={styles.skeletonText} />
              </View>
            </View>
          ))}
        </View>
      ) : lostAnimals.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-dislike-outline" size={64} color="#BDBDBD" />
          <Text style={styles.emptyTitle}>No Lost Animals</Text>
          <Text style={styles.emptyText}>
            Help reunite lost pets with their families by posting here
          </Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => navigation.navigate('CreateLostAnimal')}
          >
            <Text style={styles.emptyButtonText}>Post Lost Animal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={lostAnimals}
          renderItem={renderLostAnimalCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  addButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  matchBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF5722',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  typeTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#757575',
    flex: 1,
  },
  matchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchesText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  skeletonImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  skeletonContent: {
    padding: 16,
  },
  skeletonTitle: {
    height: 24,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 12,
    width: '60%',
  },
  skeletonText: {
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
    width: '100%',
  },
});

export default LostAnimalsScreen;

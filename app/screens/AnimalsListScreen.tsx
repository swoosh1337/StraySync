import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, Cat } from '../types';
import { catService } from '../services/supabase';
import { locationService } from '../services/location';
import { useSettings } from '../contexts/SettingsContext';
import { AnimalCardSkeleton } from '../components/SkeletonLoader';
import { cache, CACHE_KEYS } from '../services/cache';

type AnimalsListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

type AnimalFilter = 'all' | 'cats' | 'dogs';

interface AdvancedFilters {
  adoptable: boolean | null;
  gender: 'male' | 'female' | 'unknown' | null;
  healthStatus: 'healthy' | 'injured' | 'sick' | 'unknown' | null;
  neutered: boolean | null;
}

const AnimalsListScreen: React.FC = () => {
  const navigation = useNavigation<AnimalsListScreenNavigationProp>();
  const { searchRadius } = useSettings();
  const [animals, setAnimals] = useState<Cat[]>([]);
  const [filteredAnimals, setFilteredAnimals] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [animalFilter, setAnimalFilter] = useState<AnimalFilter>('all');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    adoptable: null,
    gender: null,
    healthStatus: null,
    neutered: null,
  });

  // Theme colors
  const THEME = {
    primary: '#D0F0C0',
    secondary: '#2E7D32',
    accent: '#388E3C',
    inactive: '#90A4AE',
    background: '#F5F5F5',
    card: '#FFFFFF',
    text: '#212121',
    lightText: '#757575',
    dogColor: '#8B4513', // Brown color for dogs
  };

  // Get user location on mount
  useEffect(() => {
    const getUserLocation = async () => {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setUserLocation(location);
      }
    };
    getUserLocation();
  }, []);

  const fetchAnimals = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first (unless force refresh)
      const cacheKey = CACHE_KEYS.ANIMALS_LIST(animalFilter);
      
      if (!forceRefresh) {
        const cachedData = cache.get<Cat[]>(cacheKey);
        if (cachedData) {
          setAnimals(cachedData);
          applySearch(cachedData, searchQuery);
          setLoading(false);
          return;
        }
      }
      
      setLoading(true);
      let fetchedAnimals: Cat[] = [];
      
      if (animalFilter === 'all') {
        fetchedAnimals = await catService.getCats();
      } else if (animalFilter === 'cats') {
        fetchedAnimals = await catService.getCatsOnly();
      } else if (animalFilter === 'dogs') {
        fetchedAnimals = await catService.getDogsOnly();
      }
      
      // Filter by distance if user location is available
      if (userLocation) {
        fetchedAnimals = fetchedAnimals.filter(animal => {
          const distance = locationService.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            animal.latitude,
            animal.longitude
          );
          return distance <= searchRadius;
        });
      }
      
      // Cache the results (2 minutes TTL for animals list)
      cache.set(cacheKey, fetchedAnimals, 2 * 60 * 1000);
      
      setAnimals(fetchedAnimals);
      applySearch(fetchedAnimals, searchQuery);
    } catch (error) {
      console.error('Error fetching animals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [animalFilter, searchQuery, userLocation, searchRadius]);

  // Load from cache on focus, only fetch if cache miss
  useFocusEffect(
    useCallback(() => {
      fetchAnimals(false); // Use cache if available
    }, [fetchAnimals])
  );

  useEffect(() => {
    fetchAnimals(false); // Use cache if available
  }, [fetchAnimals, animalFilter]);

  // Re-apply filters when advanced filters change
  useEffect(() => {
    applySearch(animals, searchQuery);
  }, [advancedFilters]);

  const applySearch = (animalsList: Cat[], query: string) => {
    let filtered = animalsList;

    // Apply text search
    if (query.trim()) {
      const lowerCaseQuery = query.toLowerCase();
      filtered = filtered.filter(animal => {
        const description = animal.description?.toLowerCase() || '';
        const name = animal.name?.toLowerCase() || '';
        const breed = animal.breed?.toLowerCase() || '';
        const color = animal.color?.toLowerCase() || '';
        const type = animal.animal_type?.toLowerCase() || '';
        const date = new Date(animal.spotted_at).toLocaleDateString();

        return (
          description.includes(lowerCaseQuery) ||
          name.includes(lowerCaseQuery) ||
          breed.includes(lowerCaseQuery) ||
          color.includes(lowerCaseQuery) ||
          type.includes(lowerCaseQuery) ||
          date.includes(lowerCaseQuery)
        );
      });
    }

    // Apply advanced filters
    if (advancedFilters.adoptable !== null) {
      filtered = filtered.filter(animal => animal.is_adoptable === advancedFilters.adoptable);
    }

    if (advancedFilters.gender !== null) {
      filtered = filtered.filter(animal => animal.gender === advancedFilters.gender);
    }

    if (advancedFilters.healthStatus !== null) {
      filtered = filtered.filter(animal => animal.health_status === advancedFilters.healthStatus);
    }

    if (advancedFilters.neutered !== null) {
      filtered = filtered.filter(animal => animal.is_neutered === advancedFilters.neutered);
    }

    setFilteredAnimals(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(() => {
      applySearch(animals, text);
    }, 300);
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnimals(true); // Force refresh, bypass cache
  };

  const handleAnimalPress = (animalId: string) => {
    navigation.navigate('CatDetails', { catId: animalId });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (advancedFilters.adoptable !== null) count++;
    if (advancedFilters.gender !== null) count++;
    if (advancedFilters.healthStatus !== null) count++;
    if (advancedFilters.neutered !== null) count++;
    return count;
  };

  const clearAllFilters = () => {
    setAdvancedFilters({
      adoptable: null,
      gender: null,
      healthStatus: null,
      neutered: null,
    });
    setShowFilterModal(false);
  };

  const applyFiltersAndClose = () => {
    setShowFilterModal(false);
    applySearch(animals, searchQuery);
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  };

  const renderFilterButtons = () => {
    return (
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            animalFilter === 'all' && styles.activeFilterButton,
          ]}
          onPress={() => setAnimalFilter('all')}
        >
          <Text style={[
            styles.filterButtonText,
            animalFilter === 'all' && styles.activeFilterButtonText,
          ]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            animalFilter === 'cats' && styles.activeFilterButton,
          ]}
          onPress={() => setAnimalFilter('cats')}
        >
          <Text style={[
            styles.filterButtonText,
            animalFilter === 'cats' && styles.activeFilterButtonText,
          ]}>Cats</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            animalFilter === 'dogs' && styles.activeFilterButton,
          ]}
          onPress={() => setAnimalFilter('dogs')}
        >
          <Text style={[
            styles.filterButtonText,
            animalFilter === 'dogs' && styles.activeFilterButtonText,
          ]}>Dogs</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderAnimalItem = ({ item }: { item: Cat }) => {
    const isDog = item.animal_type === 'dog';
    const iconColor = isDog ? THEME.dogColor : THEME.secondary;
    
    // Calculate distance if user location is available
    let distance: number | null = null;
    if (userLocation) {
      distance = locationService.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        item.latitude,
        item.longitude
      );
    }
    
    return (
      <TouchableOpacity
        style={styles.animalCard}
        onPress={() => handleAnimalPress(item.id)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.image_url }}
          style={styles.animalImage}
          resizeMode="cover"
        />
        <View style={styles.animalInfo}>
          <View style={styles.animalTypeContainer}>
            <Ionicons 
              name={isDog ? 'paw' : 'logo-octocat'} 
              size={16} 
              color={iconColor} 
            />
            <Text style={[styles.animalType, { color: iconColor }]}>
              {isDog ? 'Dog' : 'Cat'}
            </Text>
            {distance !== null && (
              <Text style={styles.distanceText}>
                • {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
              </Text>
            )}
          </View>
          <Text style={styles.animalDescription} numberOfLines={2}>
            {item.description || 'No description provided'}
          </Text>
          <Text style={styles.timeAgo}>{getTimeAgo(item.spotted_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="paw-outline" size={64} color={THEME.inactive} />
        <Text style={styles.emptyText}>
          {searchQuery
            ? 'No animals match your search'
            : userLocation
              ? `No animals within ${searchRadius}km`
              : 'No animals found'}
        </Text>
        <Text style={styles.emptySubtext}>
          {searchQuery
            ? 'Try a different search term or filter'
            : userLocation
              ? 'Try increasing the search radius in Settings'
              : 'Animals you add will appear here'}
        </Text>
      </View>
    );
  };

  const renderFilterModal = () => {
    return (
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Animals</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={THEME.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Adoptable Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Adoption Status</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.adoptable === null && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, adoptable: null })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.adoptable === null && styles.filterOptionTextActive,
                    ]}>Any</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.adoptable === true && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, adoptable: true })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.adoptable === true && styles.filterOptionTextActive,
                    ]}>Adoptable</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.adoptable === false && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, adoptable: false })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.adoptable === false && styles.filterOptionTextActive,
                    ]}>Not Adoptable</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Gender Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Gender</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.gender === null && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, gender: null })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.gender === null && styles.filterOptionTextActive,
                    ]}>Any</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.gender === 'male' && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, gender: 'male' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.gender === 'male' && styles.filterOptionTextActive,
                    ]}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.gender === 'female' && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, gender: 'female' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.gender === 'female' && styles.filterOptionTextActive,
                    ]}>Female</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.gender === 'unknown' && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, gender: 'unknown' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.gender === 'unknown' && styles.filterOptionTextActive,
                    ]}>Unknown</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Health Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Health Status</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.healthStatus === null && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, healthStatus: null })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.healthStatus === null && styles.filterOptionTextActive,
                    ]}>Any</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.healthStatus === 'healthy' && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, healthStatus: 'healthy' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.healthStatus === 'healthy' && styles.filterOptionTextActive,
                    ]}>Healthy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.healthStatus === 'injured' && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, healthStatus: 'injured' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.healthStatus === 'injured' && styles.filterOptionTextActive,
                    ]}>Injured</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.healthStatus === 'sick' && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, healthStatus: 'sick' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.healthStatus === 'sick' && styles.filterOptionTextActive,
                    ]}>Sick</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.healthStatus === 'unknown' && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, healthStatus: 'unknown' })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.healthStatus === 'unknown' && styles.filterOptionTextActive,
                    ]}>Unknown</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Neutered Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Neutered/Spayed</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.neutered === null && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, neutered: null })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.neutered === null && styles.filterOptionTextActive,
                    ]}>Any</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.neutered === true && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, neutered: true })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.neutered === true && styles.filterOptionTextActive,
                    ]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOptionButton,
                      advancedFilters.neutered === false && styles.filterOptionButtonActive,
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, neutered: false })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      advancedFilters.neutered === false && styles.filterOptionTextActive,
                    ]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearAllFilters}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={applyFiltersAndClose}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchAndFilterRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={THEME.lightText} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, breed, color..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor={THEME.lightText}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color={THEME.lightText} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.filterIconButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="options-outline" size={24} color={THEME.secondary} />
          {getActiveFilterCount() > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      {renderFilterButtons()}
      
      {userLocation && (
        <View style={styles.radiusInfo}>
          <Ionicons name="location" size={16} color={THEME.secondary} />
          <Text style={styles.radiusText}>
            Showing animals within {searchRadius}km of your location
          </Text>
        </View>
      )}
      
      {loading && !refreshing ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4, 5].map((index) => (
            <AnimalCardSkeleton key={index} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredAnimals}
          renderItem={renderAnimalItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[THEME.secondary]}
              tintColor={THEME.secondary}
            />
          }
          ListEmptyComponent={renderEmptyList}
        />
      )}

      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterIconButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF5722',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#212121',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'white',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    width: '30%',
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#D0F0C0',
  },
  filterButtonText: {
    color: '#757575',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  animalCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  animalImage: {
    width: 120,
    height: 120,
  },
  animalInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  animalTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  animalType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  animalDescription: {
    fontSize: 14,
    color: '#212121',
    marginBottom: 8,
    flex: 1,
  },
  timeAgo: {
    fontSize: 12,
    color: '#757575',
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#757575',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 8,
    textAlign: 'center',
  },
  radiusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  radiusText: {
    fontSize: 13,
    color: '#2E7D32',
    marginLeft: 6,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  modalScroll: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOptionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  filterOptionButtonActive: {
    backgroundColor: '#D0F0C0',
    borderColor: '#2E7D32',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default AnimalsListScreen; 
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, Cat } from '../types';
import { catService } from '../services/supabase';

type AnimalsListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

type AnimalFilter = 'all' | 'cats' | 'dogs';

const AnimalsListScreen: React.FC = () => {
  const navigation = useNavigation<AnimalsListScreenNavigationProp>();
  const [animals, setAnimals] = useState<Cat[]>([]);
  const [filteredAnimals, setFilteredAnimals] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [animalFilter, setAnimalFilter] = useState<AnimalFilter>('all');

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
  };

  const fetchAnimals = useCallback(async () => {
    try {
      setLoading(true);
      let fetchedAnimals: Cat[] = [];
      
      if (animalFilter === 'all') {
        fetchedAnimals = await catService.getCats();
      } else if (animalFilter === 'cats') {
        fetchedAnimals = await catService.getCatsOnly();
      } else if (animalFilter === 'dogs') {
        fetchedAnimals = await catService.getDogsOnly();
      }
      
      setAnimals(fetchedAnimals);
      applySearch(fetchedAnimals, searchQuery);
    } catch (error) {
      console.error('Error fetching animals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [animalFilter, searchQuery]);

  useEffect(() => {
    fetchAnimals();
  }, [fetchAnimals, animalFilter]);

  const applySearch = (animalsList: Cat[], query: string) => {
    if (!query.trim()) {
      setFilteredAnimals(animalsList);
      return;
    }
    
    const lowerCaseQuery = query.toLowerCase();
    const filtered = animalsList.filter(animal => {
      const description = animal.description?.toLowerCase() || '';
      const type = animal.animal_type?.toLowerCase() || '';
      const date = new Date(animal.spotted_at).toLocaleDateString();
      
      return (
        description.includes(lowerCaseQuery) ||
        type.includes(lowerCaseQuery) ||
        date.includes(lowerCaseQuery)
      );
    });
    
    setFilteredAnimals(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applySearch(animals, text);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnimals();
  };

  const handleAnimalPress = (animalId: string) => {
    navigation.navigate('CatDetails', { catId: animalId });
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
              name={item.animal_type === 'dog' ? 'paw' : 'logo-octocat'} 
              size={16} 
              color={THEME.secondary} 
            />
            <Text style={styles.animalType}>
              {item.animal_type === 'dog' ? 'Dog' : 'Cat'}
            </Text>
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
            : 'No animals found'}
        </Text>
        <Text style={styles.emptySubtext}>
          {searchQuery 
            ? 'Try a different search term or filter' 
            : 'Animals you add will appear here'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={THEME.lightText} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search animals..."
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
      
      {renderFilterButtons()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.secondary} />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
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
});

export default AnimalsListScreen; 
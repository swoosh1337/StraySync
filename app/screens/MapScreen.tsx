import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Cat, RootStackParamList } from '../types';
import { catService } from '../services/supabase';
import { locationService } from '../services/location';

type MapScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

type MapScreenProps = {
  route?: {
    params?: {
      forceRefresh?: () => void;
    };
  };
};

const MapScreen: React.FC<MapScreenProps> = ({ route }) => {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const mapRef = useRef<MapView>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [filteredCats, setFilteredCats] = useState<Cat[]>([]);
  const [animalFilter, setAnimalFilter] = useState<'all' | 'cats' | 'dogs'>('all');
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region>({
    latitude: 42.2746,
    longitude: -71.8063,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

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

  // Fetch cats from the database
  const fetchCats = async () => {
    try {
      setLoading(true);
      const catsData = await catService.getCats();
      setCats(catsData);
      applyFilter(catsData, animalFilter);
    } catch (error) {
      console.error('Error fetching cats:', error);
      Alert.alert('Error', 'Failed to load animals data');
    } finally {
      setLoading(false);
    }
  };

  // Apply filter to cats
  const applyFilter = (catsData: Cat[], filter: 'all' | 'cats' | 'dogs') => {
    if (filter === 'all') {
      setFilteredCats(catsData);
    } else if (filter === 'cats') {
      setFilteredCats(catsData.filter(cat => cat.animal_type !== 'dog'));
    } else if (filter === 'dogs') {
      setFilteredCats(catsData.filter(cat => cat.animal_type === 'dog'));
    }
  };

  // Handle filter change
  const handleFilterChange = (filter: 'all' | 'cats' | 'dogs') => {
    setAnimalFilter(filter);
    applyFilter(cats, filter);
  };

  // Get user's current location
  const getUserLocation = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setUserLocation(location);
        setRegion({
          ...location,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        
        // Animate to user location
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...location,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    } catch (error) {
      console.error('Error getting user location:', error);
    }
  };

  // Center map on user location
  const centerOnUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      getUserLocation();
    }
  };

  // Navigate to add cat screen with current location
  const handleAddCat = () => {
    if (userLocation) {
      navigation.navigate('AddCat', {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
    } else {
      navigation.navigate('AddCat');
    }
  };

  // Navigate to cat details screen
  const handleCatPress = (catId: string) => {
    navigation.navigate('CatDetails', { catId });
  };

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchCats();
      getUserLocation();
      return () => {};
    }, [])
  );

  // Initial setup
  useEffect(() => {
    fetchCats();
    getUserLocation();
  }, []);

  return (
    <View style={styles.container}>
      {loading && !cats.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.secondary} />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : (
        <>
          {/* Filter buttons */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                animalFilter === 'all' && styles.filterButtonActive,
              ]}
              onPress={() => handleFilterChange('all')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  animalFilter === 'all' && styles.filterButtonTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                animalFilter === 'cats' && styles.filterButtonActive,
              ]}
              onPress={() => handleFilterChange('cats')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  animalFilter === 'cats' && styles.filterButtonTextActive,
                ]}
              >
                Cats
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                animalFilter === 'dogs' && styles.filterButtonActive,
              ]}
              onPress={() => handleFilterChange('dogs')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  animalFilter === 'dogs' && styles.filterButtonTextActive,
                ]}
              >
                Dogs
              </Text>
            </TouchableOpacity>
          </View>

          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={true}
            rotateEnabled={true}
            onRegionChangeComplete={setRegion}
          >
            {filteredCats.map((cat) => (
              <Marker
                key={cat.id}
                coordinate={{
                  latitude: cat.latitude,
                  longitude: cat.longitude,
                }}
                onPress={() => handleCatPress(cat.id)}
              >
                <View style={styles.markerContainer}>
                  <MaterialCommunityIcons 
                    name="paw" 
                    size={30} 
                    color={cat.animal_type === 'dog' ? THEME.dogColor : THEME.secondary} 
                  />
                </View>
                <Callout onPress={() => handleCatPress(cat.id)}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>
                      {cat.name || (cat.animal_type === 'dog' ? 'Dog' : 'Cat')}
                    </Text>
                    {cat.image_url ? (
                      <Image 
                        source={{ uri: cat.image_url }} 
                        style={styles.calloutImage} 
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text style={styles.calloutDescription} numberOfLines={2}>
                      {cat.description || 'No description'}
                    </Text>
                    <Text style={styles.calloutAction}>Tap for details</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {/* Floating buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={centerOnUserLocation}
            >
              <Ionicons name="locate" size={24} color={THEME.secondary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.floatingButton, styles.addButton]}
              onPress={handleAddCat}
            >
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2E7D32',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
  },
  floatingButton: {
    backgroundColor: '#FFF',
    borderRadius: 30,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  addButton: {
    backgroundColor: '#2E7D32',
  },
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  calloutContainer: {
    width: 180,
    padding: 10,
  },
  calloutImage: {
    width: 160,
    height: 120,
    borderRadius: 8,
    marginVertical: 6,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#2E7D32',
  },
  calloutDescription: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 2,
  },
  calloutAction: {
    fontSize: 10,
    color: '#2E7D32',
    fontStyle: 'italic',
  },
  filterContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 20,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  filterButtonTextActive: {
    color: 'white',
  },
});

export default MapScreen; 
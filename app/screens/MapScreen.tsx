import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Cat, catService } from '../services/supabase';
import {
  LocationCoordinates,
  Region,
  locationService,
} from '../services/location';
import { notificationService } from '../services/notifications';
import { useSettings } from '../contexts/SettingsContext';
import * as Location from 'expo-location';
import { LoadingOverlay } from '../components';
import { useLoading } from '../hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';

type MapScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

// Filter options for animal types
type AnimalFilter = 'all' | 'cats' | 'dogs';

const MapScreen: React.FC = () => {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const { isLoading, withLoading } = useLoading();
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(
    null
  );
  const [region, setRegion] = useState<Region | null>(null);
  const { 
    notificationRadius, 
    notificationTimeFrame,
    isNotificationsEnabled 
  } = useSettings();
  const [lastCleanupTime, setLastCleanupTime] = useState<number>(0);
  const [animalFilter, setAnimalFilter] = useState<AnimalFilter>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Function to force a refresh - can be exposed via a ref if needed
  const forceRefresh = useCallback(() => {
    console.log('Force refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Fetch animals from the database based on filter
  const fetchAnimals = useCallback(async () => {
    try {
      console.log(`Fetching animals with filter: ${animalFilter}`);
      return await withLoading(async () => {
        let fetchedAnimals: Cat[] = [];
        
        try {
          // First try to get all animals
          fetchedAnimals = await catService.getCats();
          console.log(`Fetched ${fetchedAnimals.length} animals from database`);
          
          // Apply client-side filtering if needed
          if (animalFilter === 'cats') {
            fetchedAnimals = fetchedAnimals.filter(animal => 
              !animal.animal_type || animal.animal_type === 'cat'
            );
            console.log(`Filtered to ${fetchedAnimals.length} cats`);
          } else if (animalFilter === 'dogs') {
            fetchedAnimals = fetchedAnimals.filter(animal => 
              animal.animal_type === 'dog'
            );
            console.log(`Filtered to ${fetchedAnimals.length} dogs`);
          }
        } catch (error) {
          console.error('Error fetching animals:', error);
          fetchedAnimals = [];
        }
        
        // Ensure all animals have an animal_type
        fetchedAnimals = fetchedAnimals.map(animal => ({
          ...animal,
          animal_type: animal.animal_type || 'cat' // Default to 'cat' if not specified
        }));
        
        setCats(fetchedAnimals);
        
        return fetchedAnimals;
      });
    } catch (error) {
      console.error('Error fetching animals:', error);
      Alert.alert('Error', 'Failed to load animal sightings');
      return [];
    }
  }, [animalFilter, withLoading]);

  // Add a new cat directly to the state (for immediate display)
  const addCatToState = (newCat: Cat) => {
    console.log('Adding new cat directly to state:', newCat.id);
    setCats(prevCats => [...prevCats, newCat]);
    
    // If we have a map reference, adjust the map to show the new cat
    if (mapRef.current && currentLocation) {
      console.log(`Adjusting map to show new cat: ${newCat.id}`);
      
      // Create a region that includes both the user's location and the new cat
      const midLat = (currentLocation.latitude + newCat.latitude) / 2;
      const midLong = (currentLocation.longitude + newCat.longitude) / 2;
      
      // Calculate the span to include both points with some padding
      const latDelta = Math.abs(currentLocation.latitude - newCat.latitude) * 1.5 + 0.01;
      const longDelta = Math.abs(currentLocation.longitude - newCat.longitude) * 1.5 + 0.01;
      
      // Animate to the new region
      mapRef.current.animateToRegion({
        latitude: midLat,
        longitude: midLong,
        latitudeDelta: Math.max(0.01, latDelta),
        longitudeDelta: Math.max(0.01, longDelta)
      }, 1000);
    }
  };

  // Clean up old cat sightings
  const cleanupOldCatSightings = useCallback(async () => {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Only run cleanup once per day
    if (lastCleanupTime && now - lastCleanupTime < oneDay) {
      console.log('Skipping cleanup, last run less than 24 hours ago');
      return [];
    }
    
    try {
      console.log('Running cleanup of old cat sightings...');
      return await withLoading(async () => {
        const deletedCats = await catService.cleanupOldCatSightings();
        setLastCleanupTime(now);
        
        if (deletedCats.length > 0) {
          console.log(`Deleted ${deletedCats.length} old cat sightings`);
          
          // Refresh the cat list after cleanup
          await fetchAnimals();
          
          // Show notification about cleanup
          Alert.alert(
            'Cleanup Complete',
            `Removed ${deletedCats.length} old cat sightings that were more than 30 days old.`
          );
        } else {
          console.log('No cats were deleted during cleanup');
        }
        
        return deletedCats;
      });
    } catch (error) {
      console.error('Error cleaning up old cat sightings:', error);
      if (error instanceof Error) {
        Alert.alert('Error', `Failed to clean up old cat sightings: ${error.message}`);
      } else {
        Alert.alert('Error', 'Failed to clean up old cat sightings');
      }
      return [];
    }
  }, [lastCleanupTime, withLoading, fetchAnimals]);

  // Get the user's current location
  const getCurrentLocation = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setRegion(locationService.getRegion(location));
        
        // Center the map on the user's location
        mapRef.current?.animateToRegion(locationService.getRegion(location), 500);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get your current location');
    }
  };

  // Check for nearby cats and send notifications if enabled
  const checkForNearbyAnimals = async () => {
    if (currentLocation && isNotificationsEnabled) {
      await notificationService.checkForNearbyAnimals(
        currentLocation,
        notificationRadius,
        notificationTimeFrame
      );
    }
  };

  // Initialize map and load data
  useEffect(() => {
    const initializeMap = async () => {
      try {
        await withLoading(async () => {
          await getCurrentLocation();
          // Fetch animals immediately on first load
          const initialAnimals = await fetchAnimals();
          setCats(initialAnimals);
          setInitialLoadComplete(true);
          console.log(`Initial load complete with ${initialAnimals.length} animals`);
        });
      } catch (error) {
        console.error('Error initializing map:', error);
        Alert.alert('Error', 'Failed to initialize map. Please try again.');
      }
    };

    initializeMap();
    // Empty dependency array to ensure this only runs once on mount
  }, []);

  // Use useFocusEffect instead for more reliable focus handling
  useFocusEffect(
    useCallback(() => {
      console.log('Map screen focused (useFocusEffect), refreshing data...');
      
      let isMounted = true;
      
      const refreshData = async () => {
        if (!isMounted) return;
        
        try {
          // Check if we need to refresh the map (after adding a new animal)
          const needsRefresh = await AsyncStorage.getItem('mapNeedsRefresh');
          if (needsRefresh === 'true') {
            console.log('Map needs refresh flag detected, forcing refresh');
            // Clear the flag
            await AsyncStorage.removeItem('mapNeedsRefresh');
            
            // Immediately fetch new data without waiting for state update
            const refreshedAnimals = await fetchAnimals();
            if (isMounted) {
              setCats(refreshedAnimals);
              console.log(`Immediate refresh with ${refreshedAnimals.length} animals after adding new animal`);
            }
            
            // Also increment the trigger for any other components that depend on it
            setRefreshTrigger(prev => prev + 1);
            return; // Skip the normal refresh flow since we already did it
          }
          
          // Only do a normal refresh if we've already done the initial load
          // This prevents duplicate fetching on first app open
          if (initialLoadComplete) {
            console.log('Starting to refresh map data...');
            // Fetch animals with loading indicator
            const refreshedAnimals = await fetchAnimals();
            if (isMounted) {
              setCats(refreshedAnimals);
              console.log(`Refreshed map with ${refreshedAnimals.length} animals`);
            }
          }
          
          // Check for nearby cats for notifications
          if (currentLocation && isMounted) {
            checkForNearbyAnimals();
          }
        } catch (error) {
          console.error('Error refreshing map data:', error);
        }
      };
      
      // Execute refresh immediately
      refreshData();
      
      // Return cleanup function
      return () => {
        console.log('Map screen blurred (useFocusEffect cleanup)');
        isMounted = false;
      };
    }, [fetchAnimals, currentLocation, refreshTrigger])
  );
  
  // Set up cleanup interval - only run once on component mount
  useEffect(() => {
    console.log('Setting up cleanup interval...');
    
    // Run cleanup on initial load, but with a delay to avoid overwhelming the app on startup
    const initialCleanupTimeout = setTimeout(() => {
      cleanupOldCatSightings().catch(error => {
        console.error('Error during initial cleanup:', error);
      });
    }, 10000); // 10 second delay
    
    // Set up interval to run cleanup every hour instead of every 15 minutes
    const cleanupInterval = setInterval(() => {
      console.log('Running scheduled cleanup...');
      cleanupOldCatSightings().catch(error => {
        console.error('Error during scheduled cleanup:', error);
      });
    }, 60 * 60 * 1000); // 1 hour

    // Clean up interval and timeout when component unmounts
    return () => {
      clearInterval(cleanupInterval);
      clearTimeout(initialCleanupTimeout);
    };
  }, []);

  // Handle adding a new cat sighting
  const handleAddCat = () => {
    if (currentLocation) {
      navigation.navigate('AddCat', {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    } else {
      Alert.alert(
        'Location Not Available',
        'Please enable location services to add a cat sighting.'
      );
    }
  };

  // Handle viewing cat details
  const handleCatPress = (catId: string) => {
    try {
      console.log(`Cat marker pressed: ${catId}`);
      
      // Verify the cat exists in our current state before navigating
      const catExists = cats.some(cat => cat.id === catId);
      
      if (catExists) {
        console.log(`Navigating to details for cat: ${catId}`);
        navigation.navigate('CatDetails', { catId });
      } else {
        console.error(`Error: Attempted to view details for non-existent cat: ${catId}`);
        Alert.alert(
          'Error',
          'This cat sighting is no longer available. The map will refresh.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Refresh the map to ensure we have the latest data
                fetchAnimals();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error handling cat press:', error);
      Alert.alert('Error', 'Failed to view cat details. Please try again.');
    }
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    console.log('Manual refresh requested');
    try {
      // Increment the refresh trigger to force a refresh
      setRefreshTrigger(prev => prev + 1);
      
      // Fetch animals immediately
      const refreshedAnimals = await fetchAnimals();
      setCats(refreshedAnimals);
      console.log(`Manually refreshed with ${refreshedAnimals.length} animals`);
      
      // Get current location
      await getCurrentLocation();
      
      // Check for nearby animals
      if (currentLocation) {
        await checkForNearbyAnimals();
      }
    } catch (error) {
      console.error('Error during manual refresh:', error);
      Alert.alert('Error', 'Failed to refresh data');
    }
  };

  // Render markers for each cat
  const renderMarkers = () => {
    return cats.map((cat) => (
      <Marker
        key={cat.id}
        coordinate={{
          latitude: cat.latitude,
          longitude: cat.longitude,
        }}
        onPress={() => navigation.navigate('CatDetails', { catId: cat.id })}
      >
        <View style={styles.markerContainer}>
          <View style={[
            styles.markerIconContainer,
            cat.animal_type === 'dog' ? styles.dogMarker : styles.catMarker
          ]}>
            <Ionicons 
              name={cat.animal_type === 'dog' ? 'paw' : 'paw-outline'} 
              size={24} 
              color={cat.animal_type === 'dog' ? '#8B4513' : '#2E7D32'} 
            />
          </View>
        </View>
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            <Image
              source={{ uri: cat.image_url }}
              style={styles.calloutImage}
              resizeMode="cover"
            />
            <View style={styles.calloutTextContainer}>
              <Text style={styles.calloutTitle}>
                {cat.animal_type === 'dog' ? 'Stray Dog' : 'Stray Cat'}
              </Text>
              <Text style={styles.calloutDescription} numberOfLines={2}>
                {cat.description || 'No description provided'}
              </Text>
              <Text style={styles.calloutDate}>
                {new Date(cat.spotted_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </Callout>
      </Marker>
    ));
  };

  // Add this to the JSX where appropriate
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

  // Add a useEffect to refresh data when the filter changes
  useEffect(() => {
    console.log('Animal filter changed to:', animalFilter);
    fetchAnimals();
  }, [animalFilter, fetchAnimals]);

  return (
    <View style={styles.container}>
      {region && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={undefined}
          initialRegion={region}
          showsUserLocation
        >
          {renderMarkers()}
        </MapView>
      )}

      {/* Show loading indicator overlay while loading */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading animals...</Text>
          </View>
        </View>
      )}
      
      {/* Filter buttons */}
      {renderFilterButtons()}
      
      {/* Map control buttons - top right */}
      <View style={styles.mapControlsContainer}>
        {/* Location button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        {/* Refresh button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>
      
      {/* Add button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddCat}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  calloutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calloutImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 10,
  },
  calloutTextContainer: {
    flex: 1,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  calloutDescription: {
    fontSize: 14,
  },
  calloutDate: {
    fontSize: 12,
    color: '#666',
  },
  filterContainer: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  filterButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ccc',
    minWidth: 80,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  activeFilterButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  activeFilterButtonText: {
    color: 'white',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIconContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 5,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  catMarker: {
    borderColor: '#2E7D32',
  },
  dogMarker: {
    borderColor: '#8B4513',
  },
  mapControlsContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  controlButton: {
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default MapScreen; 
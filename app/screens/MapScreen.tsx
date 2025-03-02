import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
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

type MapScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

const MapScreen: React.FC = () => {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Fetch cats from the database
  const fetchCats = async () => {
    try {
      console.log('Fetching cats from database...');
      setLoading(true);
      const fetchedCats = await catService.getCats();
      console.log(`Fetched ${fetchedCats.length} cats from database`);
      
      // Update state with new cats
      setCats(fetchedCats);
      setLoading(false);
      
      return fetchedCats;
    } catch (error) {
      console.error('Error fetching cats:', error);
      Alert.alert('Error', 'Failed to load cat sightings');
      setLoading(false);
      return [];
    }
  };

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
    const now = Date.now();
    // Only run cleanup once per hour
    if (now - lastCleanupTime < 60 * 60 * 1000) {
      console.log('Skipping cleanup - last cleanup was less than an hour ago');
      return [];
    }
    
    try {
      console.log('Running cleanup of old cat sightings...');
      setLoading(true); // Show loading indicator during cleanup
      
      const deletedCatIds = await catService.cleanupOldCatSightings();
      setLastCleanupTime(now);
      
      if (deletedCatIds.length > 0) {
        console.log(`Removed ${deletedCatIds.length} old markers from map:`, deletedCatIds);
        
        // Immediately update the cats state to remove deleted cats
        setCats(prevCats => {
          const deletedIdsSet = new Set(deletedCatIds);
          const updatedCats = prevCats.filter(cat => !deletedIdsSet.has(cat.id));
          console.log(`Filtered out ${prevCats.length - updatedCats.length} deleted cats from map`);
          return updatedCats;
        });
        
        // Wait a moment before fetching fresh data to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fetch fresh data from the database
        await fetchCats();
      } else {
        console.log('No cats were deleted during cleanup');
      }
      
      return deletedCatIds;
    } catch (error) {
      console.error('Error during cleanup:', error);
      // Still try to refresh data even if cleanup failed
      try {
        await fetchCats();
      } catch (fetchError) {
        console.error('Error fetching cats after cleanup error:', fetchError);
      }
      return [];
    } finally {
      setLoading(false); // Hide loading indicator
    }
  }, [lastCleanupTime]);

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
  const checkForNearbyCats = async () => {
    if (isNotificationsEnabled && currentLocation) {
      await notificationService.checkForNearbyCats(
        currentLocation,
        notificationRadius,
        notificationTimeFrame
      );
    }
  };

  // Initialize the map and fetch data
  useEffect(() => {
    const initializeMap = async () => {
      setLoading(true);
      await getCurrentLocation();
      await fetchCats();
      setLoading(false);
    };

    initializeMap();

    // Set up location subscription
    let locationSubscription: Location.LocationSubscription | null = null;

    const subscribeToLocationUpdates = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 100, // Update every 100 meters
          },
          (location) => {
            const newLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            setCurrentLocation(newLocation);
            
            // Check for nearby cats when location updates
            if (isNotificationsEnabled) {
              notificationService.checkForNearbyCats(
                newLocation,
                notificationRadius,
                notificationTimeFrame
              );
            }
          }
        );
      }
    };

    subscribeToLocationUpdates();

    // Clean up subscription when component unmounts
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [notificationRadius, notificationTimeFrame, isNotificationsEnabled]);

  // Refresh data when the screen is focused
  useEffect(() => {
    if (isFocused) {
      console.log('Screen focused, refreshing data...');
      fetchCats();
      
      // Check for nearby cats for notifications
      checkForNearbyCats();
    }
  }, [isFocused, notificationRadius, notificationTimeFrame, isNotificationsEnabled]);
  
  // Set up cleanup interval
  useEffect(() => {
    console.log('Setting up cleanup interval...');
    
    // Run cleanup on initial load
    const initialCleanup = async () => {
      try {
        await cleanupOldCatSightings();
      } catch (error) {
        console.error('Error during initial cleanup:', error);
      }
    };
    
    initialCleanup();
    
    // Set up interval to run cleanup every 15 minutes
    const cleanupInterval = setInterval(() => {
      console.log('Running scheduled cleanup...');
      cleanupOldCatSightings().catch(error => {
        console.error('Error during scheduled cleanup:', error);
      });
    }, 15 * 60 * 1000); // 15 minutes

    // Clean up interval when component unmounts
    return () => {
      clearInterval(cleanupInterval);
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
                fetchCats();
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
    setLoading(true);
    
    try {
      // Get current location first
      await getCurrentLocation();
      
      // Force cleanup regardless of time since last cleanup
      console.log('Forcing cleanup during manual refresh');
      const deletedCatIds = await catService.cleanupOldCatSightings();
      setLastCleanupTime(Date.now());
      
      if (deletedCatIds.length > 0) {
        console.log(`Manual refresh removed ${deletedCatIds.length} old markers from map`);
        
        // Immediately update the cats state to remove deleted cats
        setCats(prevCats => {
          const deletedIdsSet = new Set(deletedCatIds);
          return prevCats.filter(cat => !deletedIdsSet.has(cat.id));
        });
      }
      
      // Wait a moment before fetching fresh data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Then fetch latest data
      await fetchCats();
      console.log('Manual refresh completed successfully');
    } catch (error) {
      console.error('Error during manual refresh:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {region && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={undefined}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton
        >
          {cats.map((cat) => (
            <Marker
              key={cat.id}
              coordinate={{
                latitude: cat.latitude,
                longitude: cat.longitude,
              }}
              onPress={() => handleCatPress(cat.id)}
            >
              <Ionicons name="paw" size={30} color="#FF5722" />
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>Stray Cat</Text>
                  <Text style={styles.calloutText}>
                    Spotted: {new Date(cat.spotted_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.calloutText}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      <TouchableOpacity style={styles.addButton} onPress={handleAddCat}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
      >
        <Ionicons name="locate" size={24} color="#4CAF50" />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={handleRefresh}
      >
        <Ionicons name="refresh" size={24} color="#4CAF50" />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4CAF50',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  locationButton: {
    position: 'absolute',
    bottom: 100,
    right: 30,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  callout: {
    width: 150,
    padding: 10,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  calloutText: {
    fontSize: 14,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 150,
    right: 30,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});

export default MapScreen; 
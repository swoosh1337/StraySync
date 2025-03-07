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
} from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
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
    } catch (error) {
      console.error('Error fetching cats:', error);
      Alert.alert('Error', 'Failed to load animals data');
    } finally {
      setLoading(false);
    }
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
            {cats.map((cat) => (
              <Marker
                key={cat.id}
                coordinate={{
                  latitude: cat.latitude,
                  longitude: cat.longitude,
                }}
                pinColor={cat.animal_type === 'dog' ? THEME.dogColor : THEME.secondary}
                onPress={() => handleCatPress(cat.id)}
              >
                <Callout onPress={() => handleCatPress(cat.id)}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>
                      {cat.name || (cat.animal_type === 'dog' ? 'Dog' : 'Cat')}
                    </Text>
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
  calloutContainer: {
    width: 160,
    padding: 8,
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
});

export default MapScreen; 
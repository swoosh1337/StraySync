import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Cat } from '../types';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { catService } from '../services/supabase';
import { locationService } from '../services/location';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CatDetailsScreenRouteProp = RouteProp<RootStackParamList, 'CatDetails'>;
type CatDetailsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CatDetails'
>;

const CatDetailsScreen: React.FC = () => {
  const route = useRoute<CatDetailsScreenRouteProp>();
  const navigation = useNavigation<CatDetailsScreenNavigationProp>();
  const { catId } = route.params;
  
  const [animal, setAnimal] = useState<Cat | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch animal details and check ownership
  useEffect(() => {
    const fetchAnimalDetails = async () => {
      try {
        setLoading(true);
        
        // Get current user ID
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || await AsyncStorage.getItem('anonymousUserId');
        console.log('Current user ID for ownership check:', currentUserId);
        setUserId(currentUserId);
        
        // Fetch animal details
        const fetchedAnimal = await catService.getCatById(catId);
        
        if (fetchedAnimal) {
          setAnimal(fetchedAnimal);
          setEditDescription(fetchedAnimal.description || '');
          
          // Check if current user is the owner
          if (currentUserId) {
            console.log('About to check ownership with user ID:', currentUserId);
            const ownershipCheck = await catService.isUserOwner(catId, currentUserId);
            console.log('Ownership check result:', ownershipCheck);
            setIsOwner(ownershipCheck);
          } else {
            console.log('No current user ID available for ownership check');
            setIsOwner(false);
          }
        } else {
          Alert.alert('Error', 'Animal not found');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error fetching animal details:', error);
        Alert.alert('Error', 'Failed to load animal details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnimalDetails();
  }, [catId, navigation]);
  
  // Get current location for distance calculation
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const location = await locationService.getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
        }
      } catch (error) {
        console.error('Error getting current location:', error);
      }
    };
    
    getCurrentLocation();
  }, []);
  
  // Calculate distance between current location and animal
  const getDistance = () => {
    if (!currentLocation || !animal) return 'Unknown distance';
    
    const distance = locationService.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      animal.latitude,
      animal.longitude
    );
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)} meters away`;
    } else {
      return `${distance.toFixed(1)} km away`;
    }
  };
  
  // Open directions in maps app
  const openDirections = async () => {
    if (!animal) return;
    
    try {
      // Get current location
      const currentLocation = await locationService.getCurrentLocation();
      
      if (!currentLocation) {
        Alert.alert('Error', 'Could not determine your current location');
        return;
      }
      
      // Encode destination name for URL
      const destinationName = animal.animal_type === 'dog' ? 'Stray Dog Location' : 'Stray Cat Location';
      const encodedDestName = encodeURIComponent(destinationName);
      
      // Construct URL for Google Maps
      const googleMapsUrl = Platform.select({
        ios: `comgooglemaps://?saddr=${currentLocation.latitude},${currentLocation.longitude}&daddr=${animal.latitude},${animal.longitude}&directionsmode=walking&q=${encodedDestName}`,
        android: `google.navigation:q=${animal.latitude},${animal.longitude}&mode=w`,
        default: `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${animal.latitude},${animal.longitude}&travelmode=walking&q=${encodedDestName}`,
      });
      
      // Check if Google Maps is installed
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
      
      if (canOpenGoogleMaps) {
        // Open Google Maps
        await Linking.openURL(googleMapsUrl);
        return;
      }
      
      // Fallback to Apple Maps on iOS or web URL on other platforms
      const appleMapsUrl = `http://maps.apple.com/?saddr=${currentLocation.latitude},${currentLocation.longitude}&daddr=${animal.latitude},${animal.longitude}&dirflg=w&q=${encodedDestName}`;
      const defaultMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${animal.latitude},${animal.longitude}&travelmode=walking&q=${encodedDestName}`;
      
      const mapsUrl = Platform.OS === 'ios' ? appleMapsUrl : defaultMapsUrl;
      
      await Linking.openURL(mapsUrl);
    } catch (error) {
      console.error('Error opening directions:', error);
      Alert.alert('Error', 'Could not open maps application');
    }
  };

  // Handle edit description
  const handleEditDescription = async () => {
    if (!animal) return;
    
    try {
      setIsEditModalVisible(false);
      
      const success = await catService.updateCatDescription(animal.id, editDescription);
      
      if (success) {
        setAnimal({
          ...animal,
          description: editDescription
        });
        Alert.alert('Success', 'Description updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update description');
      }
    } catch (error) {
      console.error('Error updating description:', error);
      Alert.alert('Error', 'Failed to update description');
    }
  };
  
  // Handle delete animal
  const handleDelete = async () => {
    if (!animal) return;
    
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete this ${animal.animal_type || 'animal'} sighting?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              
              const success = await catService.deleteCat(animal.id);
              
              if (success) {
                Alert.alert('Success', 'Animal sighting deleted successfully');
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Failed to delete animal sighting');
                setIsDeleting(false);
              }
            } catch (error) {
              console.error('Error deleting animal:', error);
              Alert.alert('Error', 'Failed to delete animal sighting');
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading animal details...</Text>
      </View>
    );
  }
  
  if (!animal) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Animal not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Image
        source={{ uri: animal.image_url }}
        style={styles.image}
        resizeMode="cover"
      />
      
      <View style={styles.infoContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            {animal.animal_type === 'dog' ? 'Stray Dog' : 'Stray Cat'}
          </Text>
          <Text style={styles.date}>
            Spotted on {new Date(animal.spotted_at).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={24} color="#4CAF50" />
            <Text style={styles.detailText}>{getDistance()}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={openDirections}
          >
            <Ionicons name="navigate" size={24} color="white" />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>
            {animal.description || 'No description provided'}
          </Text>
          
          {isOwner && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditModalVisible(true)}
            >
              <Ionicons name="pencil" size={20} color="#4CAF50" />
              <Text style={styles.editButtonText}>Edit Description</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.mapContainer}>
          <Text style={styles.sectionTitle}>Location</Text>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: animal.latitude,
              longitude: animal.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: animal.latitude,
                longitude: animal.longitude,
              }}
            >
              <Ionicons 
                name={animal.animal_type === 'dog' ? 'paw' : 'paw-outline'} 
                size={24} 
                color={animal.animal_type === 'dog' ? '#8B4513' : '#2E7D32'} 
              />
            </Marker>
          </MapView>
        </View>
        
        {isOwner && (
          <View style={styles.ownerActionsContainer}>
            <TouchableOpacity
              style={[styles.deleteButton, isDeleting && styles.disabledButton]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              <Ionicons name="trash" size={24} color="white" />
              <Text style={styles.deleteButtonText}>
                {isDeleting ? 'Deleting...' : 'Delete This Sighting'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Description</Text>
            
            <TextInput
              style={styles.modalInput}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              placeholder="Enter description"
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleEditDescription}
              >
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 10,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  image: {
    width: '100%',
    height: 300,
  },
  infoContainer: {
    padding: 15,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  date: {
    fontSize: 16,
    color: '#666',
  },
  detailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
  },
  directionsButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  directionsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  descriptionContainer: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 16,
    color: '#444',
  },
  editButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  map: {
    height: 200,
  },
  ownerActionsContainer: {
    marginTop: 20,
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
  },
  modalCancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  modalSaveButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
  },
  modalSaveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default CatDetailsScreen; 
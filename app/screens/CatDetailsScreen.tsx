import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Share,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { catService, supabase } from '../services/supabase';
import { locationService } from '../services/location/locationService';
import { formatDistanceToNow } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CatDetailsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CatDetails'
>;

type CatDetailsScreenRouteProp = RouteProp<RootStackParamList, 'CatDetails'>;

const CatDetailsScreen: React.FC = () => {
  const navigation = useNavigation<CatDetailsScreenNavigationProp>();
  const route = useRoute<CatDetailsScreenRouteProp>();
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(true);
  const [animal, setAnimal] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [distance, setDistance] = useState<string | null>(null);

  // Theme colors
  const THEME = {
    primary: '#D0F0C0',
    secondary: '#2E7D32',
    accent: '#388E3C',
    inactive: '#90A4AE',
    danger: '#D32F2F',
  };

  useEffect(() => {
    const fetchAnimalDetails = async () => {
      try {
        setLoading(true);
        
        // Get current user ID
        const { data } = await supabase.auth.getSession();
        let currentUserId = data.session?.user?.id;
        
        // For anonymous users, get stored ID
        if (!currentUserId) {
          try {
            const storedId = await AsyncStorage.getItem('anonymousUserId');
            if (storedId) {
              currentUserId = storedId;
              console.log('Retrieved anonymous ID from storage:', storedId);
            }
          } catch (error) {
            console.error('Error retrieving anonymous ID:', error);
          }
        }
        
        setUserId(currentUserId || null);
        
        // Get animal details
        const animalId = route.params?.catId || '';
        if (!animalId) {
          console.error('No animal ID provided');
          Alert.alert('Error', 'Animal not found');
          navigation.goBack();
          return;
        }
        
        const animalDetails = await catService.getCatById(animalId);
        if (!animalDetails) {
          console.error('Animal not found');
          Alert.alert('Error', 'Animal not found');
          navigation.goBack();
          return;
        }
        
        setAnimal(animalDetails);
        setEditedDescription(animalDetails.description || '');
        
        // Check if current user is the owner
        if (currentUserId) {
          const ownerStatus = await catService.isUserOwner(animalId, currentUserId);
          setIsOwner(ownerStatus);
        }
        
        // Get current location for distance calculation
        const location = await locationService.getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
          
          // Calculate distance - note that calculateDistance returns distance in kilometers
          const distanceInKm = locationService.calculateDistance(
            location.latitude,
            location.longitude,
            animalDetails.latitude,
            animalDetails.longitude
          );
          
          // Convert to meters for display if less than 1 km
          const distanceInMeters = distanceInKm * 1000;
          
          if (distanceInMeters < 1000) {
            setDistance(`${Math.round(distanceInMeters)} meters away`);
          } else {
            setDistance(`${distanceInKm.toFixed(1)} km away`);
          }
        }
      } catch (error) {
        console.error('Error fetching animal details:', error);
        Alert.alert('Error', 'Failed to load animal details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnimalDetails();
  }, [route.params?.catId]);

  const handleDelete = async () => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this animal sighting?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const animalId = route.params?.catId || '';
              if (!animalId) return;
              
              const success = await catService.deleteCat(animalId);
              if (success) {
                Alert.alert('Success', 'Animal sighting deleted successfully');
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Failed to delete animal sighting');
                setLoading(false);
              }
            } catch (error) {
              console.error('Error deleting animal:', error);
              Alert.alert('Error', 'Failed to delete animal sighting');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEditDescription = () => {
    setEditModalVisible(true);
  };

  const handleSaveDescription = async () => {
    try {
      setSavingDescription(true);
      const animalId = route.params?.catId || '';
      if (!animalId) return;
      
      const success = await catService.updateCatDescription(
        animalId,
        editedDescription
      );
      
      if (success) {
        setAnimal({ ...animal, description: editedDescription });
        setEditModalVisible(false);
        Alert.alert('Success', 'Description updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update description');
      }
    } catch (error) {
      console.error('Error updating description:', error);
      Alert.alert('Error', 'Failed to update description');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleShare = async () => {
    try {
      const message = `Check out this stray animal I found using the stray animal Finder app! ${
        animal?.description || ''
      }`;
      
      await Share.share({
        message,
        title: `stray animal Sighting`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share cat sighting');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  // Handle the "View on Full Map" button
  const handleViewOnMap = () => {
    if (animal) {
      // Use the locationService to open the map with directions
      locationService.openMapsWithDirections(
        animal.latitude,
        animal.longitude,
        'Cat Location'
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.secondary} />
        <Text style={styles.loadingText}>Loading animal details...</Text>
      </View>
    );
  }

  if (!animal) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={THEME.danger} />
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Animal Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: animal.image_url }}
            style={styles.animalImage}
            resizeMode="cover"
          />
          <View style={styles.imageOverlay}>
            <View style={styles.animalTypeTag}>
              <Ionicons
                name="logo-octocat"
                size={16}
                color="#fff"
              />
              <Text style={styles.animalTypeText}>
                Cat
              </Text>
            </View>
          </View>
        </View>

        {/* Animal Details */}
        <View style={styles.detailsContainer}>
          {/* Time and Distance */}
          <View style={styles.metaInfo}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={18} color={THEME.secondary} />
              <Text style={styles.metaText}>
                {formatDate(animal.spotted_at)}
              </Text>
            </View>
            {distance && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={18} color={THEME.secondary} />
                <Text style={styles.metaText}>{distance}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <View style={styles.descriptionHeader}>
              <Text style={styles.descriptionTitle}>Description</Text>
            </View>
            <Text style={styles.descriptionText}>
              {animal.description || 'No description provided.'}
            </Text>
          </View>

          {/* Location Map */}
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: animal.latitude,
                  longitude: animal.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: animal.latitude,
                    longitude: animal.longitude,
                  }}
                />
              </MapView>
              <TouchableOpacity 
                style={styles.viewOnMapButton}
                onPress={handleViewOnMap}
              >
                <Ionicons name="map" size={18} color="#fff" />
                <Text style={styles.viewOnMapText}>View on Full Map</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Owner actions */}
          {isOwner && (
            <View style={styles.ownerActionsContainer}>
              <TouchableOpacity
                style={styles.editDescriptionButton}
                onPress={handleEditDescription}
              >
                <Ionicons name="create-outline" size={22} color="#fff" />
                <Text style={styles.editButtonText}>Edit Description</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={22} color="#fff" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Description Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Description</Text>
            <TextInput
              style={styles.modalInput}
              value={editedDescription}
              onChangeText={setEditedDescription}
              multiline
              placeholder="Describe the animal..."
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveDescription}
                disabled={savingDescription}
              >
                {savingDescription ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  animalImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  animalTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 125, 50, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  animalTypeText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  detailsContainer: {
    padding: 16,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 6,
    color: '#666',
    fontSize: 14,
  },
  descriptionContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  mapSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  map: {
    width: '100%',
    height: 200,
  },
  viewOnMapButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  viewOnMapText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    height: 56,
    flex: 1,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 16,
    backgroundColor: '#f5f5f5',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelButton: {
    padding: 12,
    marginRight: 12,
  },
  modalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  ownerActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  editDescriptionButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    height: 56,
    flex: 1,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default CatDetailsScreen; 
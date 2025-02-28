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
import { RootStackParamList } from '../navigation';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { Cat, catService } from '../services/supabase';
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
  
  const [cat, setCat] = useState<Cat | null>(null);
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

  // Fetch cat details and check ownership
  useEffect(() => {
    const fetchCatDetails = async () => {
      try {
        setLoading(true);
        
        // Get current user or retrieve anonymous ID
        const { data } = await supabase.auth.getSession();
        let currentUserId = data.session?.user.id;
        
        if (!currentUserId) {
          // For anonymous users, get stored ID or create new one
          try {
            const storedId = await AsyncStorage.getItem('anonymousUserId');
            if (storedId) {
              currentUserId = storedId;
              console.log('Retrieved anonymous ID from storage:', storedId);
            } else {
              currentUserId = `anonymous-${Math.random().toString(36).substring(2, 9)}`;
              await AsyncStorage.setItem('anonymousUserId', currentUserId);
              console.log('Created and stored new anonymous ID:', currentUserId);
            }
          } catch (error) {
            console.error('Error with anonymous ID:', error);
            currentUserId = `anonymous-${Math.random().toString(36).substring(2, 9)}`;
          }
        }
        
        setUserId(currentUserId);
        
        // Get all cats and find the one with matching ID
        console.log(`Fetching details for cat ID: ${catId}`);
        const cats = await catService.getCats();
        console.log(`Retrieved ${cats.length} cats from database`);
        
        const foundCat = cats.find((c) => c.id === catId);
        
        if (foundCat) {
          console.log(`Found cat with ID ${catId}:`, JSON.stringify({
            id: foundCat.id,
            user_id: foundCat.user_id,
            latitude: foundCat.latitude,
            longitude: foundCat.longitude,
            spotted_at: foundCat.spotted_at,
            has_image: !!foundCat.image_url,
            description_length: foundCat.description?.length || 0
          }));
          
          setCat(foundCat);
          setEditDescription(foundCat.description || '');
          
          // Check if current user is the owner - works for both auth and anonymous
          console.log('Checking ownership - Cat user_id:', foundCat.user_id, 'Current user:', currentUserId);
          if (currentUserId && foundCat.user_id === currentUserId) {
            console.log('User is the owner of this cat');
            setIsOwner(true);
          } else {
            console.log('User is NOT the owner of this cat');
          }
        } else {
          console.error(`Cat with ID ${catId} not found in database`);
          Alert.alert(
            'Cat Not Found', 
            'This cat sighting may have been deleted or is no longer available.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        // Get current location for distance calculation
        try {
          const location = await locationService.getCurrentLocation();
          if (location) {
            setCurrentLocation(location);
          }
        } catch (locationError) {
          console.error('Error getting current location:', locationError);
          // Don't fail the whole operation if we can't get location
        }
      } catch (error) {
        console.error('Error fetching cat details:', error);
        Alert.alert(
          'Error', 
          'Failed to load cat details. Please try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCatDetails();
  }, [catId]);

  // Handle editing cat description
  const handleEditCat = async () => {
    if (!cat || !userId) return;
    
    try {
      const success = await catService.updateCat(cat.id, userId, {
        description: editDescription
      });
      
      if (success) {
        // Update local state
        setCat({
          ...cat,
          description: editDescription
        });
        
        Alert.alert('Success', 'Cat details updated successfully');
        setIsEditModalVisible(false);
      } else {
        Alert.alert('Error', 'Failed to update cat details');
      }
    } catch (error) {
      console.error('Error updating cat:', error);
      Alert.alert('Error', 'Failed to update cat details');
    }
  };

  // Handle deleting cat
  const handleDeleteCat = async () => {
    if (!cat || !userId) return;
    
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this cat sighting? This action cannot be undone.',
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
              const success = await catService.deleteCat(cat.id, userId);
              
              if (success) {
                Alert.alert('Success', 'Cat sighting deleted successfully');
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Failed to delete cat sighting');
                setIsDeleting(false);
              }
            } catch (error) {
              console.error('Error deleting cat:', error);
              Alert.alert('Error', 'Failed to delete cat sighting');
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  // Calculate distance between current location and cat location
  const getDistance = (): string => {
    if (!currentLocation || !cat) return 'Unknown';
    
    const distance = locationService.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      cat.latitude,
      cat.longitude
    );
    
    return distance < 1
      ? `${Math.round(distance * 1000)} meters`
      : `${distance.toFixed(1)} km`;
  };

  // Open directions in maps app
  const openDirections = () => {
    if (!cat) return;
    
    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
    });
    
    const latLng = `${cat.latitude},${cat.longitude}`;
    const label = 'Stray Cat Location';
    const url = Platform.select({
      ios: `${scheme}?q=${label}&ll=${latLng}`,
      android: `${scheme}0,0?q=${latLng}(${label})`,
    });
    
    if (url) {
      Linking.openURL(url).catch((err) =>
        Alert.alert('Error', 'Could not open maps application')
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading cat details...</Text>
      </View>
    );
  }

  if (!cat) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={50} color="#FF5722" />
        <Text style={styles.errorText}>Cat not found</Text>
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
        source={{ uri: cat.image_url }}
        style={styles.image}
        resizeMode="cover"
      />

      {isOwner && (
        <View style={styles.ownerActionsContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditModalVisible(true)}
          >
            <Ionicons name="create-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteCat}
            disabled={isDeleting}
          >
            <Ionicons name="trash-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Spotted on {new Date(cat.spotted_at).toLocaleDateString()} at{' '}
            {new Date(cat.spotted_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Distance: {getDistance()} from your location
          </Text>
        </View>

        {cat.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{cat.description}</Text>
          </View>
        )}

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={undefined}
            initialRegion={{
              latitude: cat.latitude,
              longitude: cat.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: cat.latitude,
                longitude: cat.longitude,
              }}
            >
              <Ionicons name="paw" size={30} color="#FF5722" />
            </Marker>
          </MapView>
        </View>

        <TouchableOpacity
          style={styles.directionsButton}
          onPress={openDirections}
        >
          <Ionicons name="navigate" size={20} color="white" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Cat Details</Text>
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.input}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Describe the cat (color, behavior, etc.)"
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleEditCat}
              >
                <Text style={styles.saveButtonText}>Save</Text>
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
  },
  descriptionContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginVertical: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
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
  directionsButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  directionsButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  ownerActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  editButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
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
  inputLabel: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  input: {
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
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 10,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default CatDetailsScreen; 
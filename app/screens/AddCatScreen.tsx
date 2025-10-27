import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  LayoutChangeEvent,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { catService, supabase } from '../services/supabase';
import { locationService } from '../services/location/locationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

type AddCatScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AddCat'
>;

type AddCatScreenRouteProp = RouteProp<RootStackParamList, 'AddCat'>;

const AddCatScreen: React.FC = () => {
  const navigation = useNavigation<AddCatScreenNavigationProp>();
  const route = useRoute<AddCatScreenRouteProp>();
  const scrollViewRef = useRef<ScrollView>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState({
    latitude: route.params?.latitude || 0,
    longitude: route.params?.longitude || 0,
  });
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputY, setInputY] = useState(0);
  const [animalType, setAnimalType] = useState<'cat' | 'dog'>('cat');
  const [locationName, setLocationName] = useState('Current Location');

  // Theme colors
  const THEME = {
    primary: '#D0F0C0',
    secondary: '#2E7D32',
    accent: '#388E3C',
    inactive: '#90A4AE',
  };

  // Check authentication - redirect to sign in if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      Alert.alert(
        'Sign In Required',
        'You need to sign in to add animal sightings.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack()
          },
          {
            text: 'Sign In',
            onPress: () => {
              navigation.goBack();
              // Navigate to SignIn screen after going back
              setTimeout(() => {
                navigation.navigate('SignIn');
              }, 100);
            }
          }
        ]
      );
    }
  }, [authLoading, user, navigation]);

  // Get the current user ID and location
  useEffect(() => {
    const initialize = async () => {
      // Require authenticated user's ID
      if (user?.id) {
        setUserId(user.id);
        console.log('Using authenticated user ID:', user.id);
      } else {
        // No user ID - should not happen due to auth check above, but handle it
        console.error('No user ID available in AddCatScreen');
        Alert.alert(
          'Authentication Required',
          'You must be signed in to add animals.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      // If location is 0,0, try to get current location
      if (location.latitude === 0 && location.longitude === 0) {
        console.log('No location provided, getting current location');
        const currentLocation = await locationService.getCurrentLocation();
        if (currentLocation) {
          console.log('Setting location to current location:', currentLocation);
          setLocation(currentLocation);
        } else {
          console.log('Failed to get current location, using default');
          // Set to a default location if we can't get the current location
          setLocation({
            latitude: 37.7749, // San Francisco by default
            longitude: -122.4194,
          });
        }
      }
    };
    
    initialize();

    // Set up keyboard listeners
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [user]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to select an image.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take a photo.');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleMarkerDrag = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
  };

  // Function to measure the position of the description input
  const measureInputPosition = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    // Set a fixed value that's reasonable rather than using the exact position
    // This prevents excessive scrolling
    setInputY(y + height / 2);
  };

  // Function to handle keyboard focus
  const handleDescriptionFocus = () => {
    // Small delay to ensure the scroll happens after the keyboard appears
    setTimeout(() => {
      if (scrollViewRef.current && inputY > 0) {
        // Scroll to a position that keeps the input visible but not at the very bottom
        scrollViewRef.current.scrollTo({ y: inputY - 150, animated: true });
      }
    }, 300);
  };

  // Add this to the JSX where appropriate
  const renderAnimalTypeSelector = () => {
    return (
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Animal Type</Text>
        <View style={styles.animalTypeButtons}>
          <TouchableOpacity
            style={[
              styles.animalTypeButton,
              animalType === 'cat' && styles.activeAnimalTypeButton,
            ]}
            onPress={() => setAnimalType('cat')}
          >
            <Ionicons
              name="logo-octocat"
              size={20}
              color={animalType === 'cat' ? THEME.secondary : '#757575'}
            />
            <Text
              style={[
                styles.animalTypeText,
                animalType === 'cat' && styles.activeAnimalTypeText,
              ]}
            >
              Cat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.animalTypeButton,
              animalType === 'dog' && styles.activeAnimalTypeButton,
            ]}
            onPress={() => setAnimalType('dog')}
          >
            <Ionicons
              name="paw"
              size={20}
              color={animalType === 'dog' ? THEME.secondary : '#757575'}
            />
            <Text
              style={[
                styles.animalTypeText,
                animalType === 'dog' && styles.activeAnimalTypeText,
              ]}
            >
              Dog
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Update the handleSubmit function to include the animal_type
  const handleSubmit = async () => {
    console.log('Submit button pressed');
    
    if (!imageUri) {
      Alert.alert('Error', 'Please take a photo or select an image');
      return;
    }

    setLoading(true);
    console.log(`Starting submission process for ${animalType}`);

    try {
      // Require authenticated user ID
      if (!userId) {
        console.error('No user ID available for submission');
        Alert.alert(
          'Authentication Required',
          'You must be signed in to add animals.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setLoading(false);
        return;
      }
      
      console.log('Using user ID:', userId);
      
      // Use the catService's uploadImage method instead of direct Supabase calls
      console.log('Uploading image using catService...');
      let imageUrl;
      
      try {
        imageUrl = await catService.uploadImage(imageUri, userId);
        console.log('Image uploaded successfully, URL:', imageUrl);
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
        setLoading(false);
        return;
      }
      
      if (!imageUrl) {
        console.error('No image URL returned from upload');
        Alert.alert('Upload Error', 'Failed to get image URL. Please try again.');
        setLoading(false);
        return;
      }
      
      // Prepare the cat data
      const catData = {
        user_id: userId,
        auth_user_id: userId, // Use authenticated user ID
        latitude: location.latitude,
        longitude: location.longitude,
        image_url: imageUrl,
        description: description || name || `A stray ${animalType} spotted at this location`,
        spotted_at: new Date().toISOString(),
        animal_type: animalType,
      };
      
      console.log('Animal data prepared:', JSON.stringify(catData, null, 2));
      
      // Add the cat to the database
      console.log('Attempting to add cat to database');
      const newCat = await catService.addCat(catData);
      
      if (newCat) {
        console.log('Successfully added animal:', newCat.id);
        
        // Set a flag in AsyncStorage to indicate a refresh is needed
        try {
          console.log('Setting mapNeedsRefresh flag to true');
          await AsyncStorage.setItem('mapNeedsRefresh', 'true');
          console.log('Successfully set mapNeedsRefresh flag');
        } catch (error) {
          console.error('Failed to set refresh flag:', error);
        }
        
        // Navigate back immediately, then show the alert
        // This ensures we return to the map screen before the alert is shown
        navigation.goBack();
        
        // Short timeout to ensure navigation completes before showing alert
        setTimeout(() => {
          Alert.alert(
            'Success',
            `Thank you for reporting this ${animalType} sighting!`
          );
        }, 100);
      } else {
        console.error('Failed to add animal to database');
        Alert.alert('Error', 'Failed to save animal sighting. Please try again.');
      }
    } catch (error) {
      console.error('Unhandled error in handleSubmit:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to dismiss keyboard
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <SafeAreaView style={styles.container}>
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add New {animalType === 'cat' ? 'Cat' : 'Dog'} Sighting</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Photo Section */}
            <View style={styles.photoContainer}>
              {imageUri ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                  <TouchableOpacity 
                    style={styles.changePhotoButton}
                    onPress={() => setImageUri(null)}
                  >
                    <Ionicons name="refresh" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={styles.photoButtonsContainer}>
                    <TouchableOpacity 
                      style={styles.cameraButton}
                      onPress={takePhoto}
                    >
                      <Ionicons name="camera" size={28} color="#fff" />
                      <Text style={styles.buttonText}>Camera</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.galleryButton}
                      onPress={pickImage}
                    >
                      <Ionicons name="images" size={28} color="#fff" />
                      <Text style={styles.buttonText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.photoPlaceholderText}>Take a photo or choose from gallery</Text>
                </View>
              )}
            </View>

            {/* Form Sections */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Cat Name/Description</Text>
              <TextInput
                style={styles.input}
                placeholder="E.g., Orange Tabby, Gray Kitten, etc."
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formSection} onLayout={measureInputPosition}>
              <Text style={styles.sectionTitle}>Detailed Description</Text>
              <TextInput
                ref={descriptionInputRef}
                style={styles.textArea}
                placeholder="Describe the cat's appearance, behavior, condition, etc."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={handleDescriptionFocus}
              />
            </View>

            {renderAnimalTypeSelector()}

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={20} color={THEME.secondary} style={styles.locationIcon} />
                <Text style={styles.locationText}>
                  {locationName}
                </Text>
                <Text style={styles.locationCoords}>
                  {location.latitude.toFixed(5)}° N, {location.longitude.toFixed(5)}° W
                </Text>
              </View>
              
              {/* Map with draggable marker */}
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                >
                  <Marker
                    coordinate={location}
                    draggable
                    onDragEnd={handleMarkerDrag}
                  />
                </MapView>
                <Text style={styles.dragPinText}>Drag the pin to adjust location</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                loading && styles.disabledButton
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  photoContainer: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#f0f0f0',
  },
  photoPreviewContainer: {
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  changePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  cameraButton: {
    width: 120,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#D0F0C0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  galleryButton: {
    width: 120,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#D0F0C0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  buttonText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  photoPlaceholderText: {
    color: '#666',
    fontSize: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  animalTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  animalTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    width: '48%',
    height: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeAnimalTypeButton: {
    backgroundColor: '#D0F0C0',
    borderColor: '#2E7D32',
  },
  animalTypeText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#757575',
    textAlign: 'center',
  },
  activeAnimalTypeText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  locationContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 28,
    color: '#333',
  },
  locationCoords: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
    marginLeft: 28,
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  dragPinText: {
    color: '#757575',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default AddCatScreen; 
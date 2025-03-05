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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { catService, supabase } from '../services/supabase';
import { locationService } from '../services/location';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Get the current user ID and location
  useEffect(() => {
    const initialize = async () => {
      // Get user ID or retrieve anonymous ID
      const { data } = await supabase.auth.getSession();
      let currentUserId = data.session?.user?.id;
      
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
  }, []);

  // Request permission to access the camera roll
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload images!'
        );
      }
    })();
  }, []);

  // Pick an image from the camera roll
  const pickImage = async () => {
    try {
      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Lower quality to reduce file size
        exif: false, // Don't include EXIF data to reduce size
      });

      console.log('Image picker result:', result.canceled ? 'Canceled' : 'Image selected');
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('Selected image size:', result.assets[0].fileSize || 'unknown');
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again or use the camera instead.');
    }
  };

  // Take a photo with the camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera permissions to take photos!'
        );
        return;
      }
      
      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Lower quality to reduce file size
        exif: false, // Don't include EXIF data to reduce size
      });

      console.log('Camera result:', result.canceled ? 'Canceled' : 'Photo taken');
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('Captured image size:', result.assets[0].fileSize || 'unknown');
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again or select from gallery instead.');
    }
  };

  // Update the marker location when the user drags it
  const handleMarkerDrag = (e: any) => {
    console.log('Marker dragged:', e.nativeEvent.coordinate);
    setLocation({
      latitude: e.nativeEvent.coordinate.latitude,
      longitude: e.nativeEvent.coordinate.longitude,
    });
  };

  // Add keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // We'll handle scrolling in the onFocus event of the TextInput
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Function to measure the position of the description input
  const measureInputPosition = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    // Set a fixed value that's reasonable rather than using the exact position
    // This prevents excessive scrolling
    setInputY(y + height / 2);
  };

  // Add a function to handle keyboard focus
  const handleDescriptionFocus = () => {
    // Add a small delay to ensure the scroll happens after the keyboard appears
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
      <View style={styles.animalTypeContainer}>
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
              name="paw"
              size={24}
              color={animalType === 'cat' ? 'white' : '#333'}
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
              size={24}
              color={animalType === 'dog' ? 'white' : '#333'}
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
      // Get current user ID
      const currentUserId = userId || 'anonymous';
      console.log('Using user ID:', currentUserId);
      
      // Use the catService's uploadImage method instead of direct Supabase calls
      console.log('Uploading image using catService...');
      let imageUrl;
      
      try {
        imageUrl = await catService.uploadImage(imageUri, currentUserId);
        console.log('Image uploaded successfully, URL:', imageUrl);
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        Alert.alert('Error', 'Failed to upload image. Please try again.');
        setLoading(false);
        return;
      }
      
      if (!imageUrl) {
        console.error('Failed to get URL for uploaded image');
        Alert.alert('Error', 'Failed to process image. Please try again.');
        setLoading(false);
        return;
      }
      
      // Prepare the animal data
      const animalData = {
        user_id: currentUserId,
        latitude: location.latitude,
        longitude: location.longitude,
        image_url: imageUrl,
        description: description || `A stray ${animalType} spotted at this location`,
        spotted_at: new Date().toISOString(),
        animal_type: animalType,
      };
      
      console.log('Animal data prepared:', JSON.stringify(animalData, null, 2));
      
      // Add the animal to the database
      console.log(`Attempting to add ${animalType} to database`);
      let newCat = null;
      
      try {
        newCat = await catService.addCat(animalData);
        console.log('Database response:', newCat ? 'Success' : 'Failed');
      } catch (dbError) {
        console.error('Error adding animal to database:', dbError);
        Alert.alert('Error', 'Failed to save animal data. Please try again.');
        setLoading(false);
        return;
      }
      
      if (newCat) {
        console.log('Successfully added animal:', newCat.id);
        Alert.alert(
          'Success', 
          `${animalType === 'cat' ? 'Cat' : 'Dog'} sighting added successfully!`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        console.error('Failed to add animal to database (null response)');
        Alert.alert('Error', 'Failed to save animal data. Please try again.');
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
        <ScrollView 
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={undefined}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker
                coordinate={location}
                draggable
                onDragEnd={handleMarkerDrag}
              >
                <Ionicons name="paw" size={30} color="#FF5722" />
              </Marker>
            </MapView>
            <Text style={styles.mapInstructions}>
              Drag the marker to the exact location where you spotted the {animalType}
            </Text>
          </View>

          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Add a Photo</Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.changeImageButton}
                  onPress={pickImage}
                >
                  <Text style={styles.changeImageText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageButtonsContainer}>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={24} color="white" />
                  <Text style={styles.imageButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={24} color="white" />
                  <Text style={styles.imageButtonText}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View 
            style={styles.formSection}
            onLayout={measureInputPosition}
          >
            <Text style={styles.sectionTitle}>Description (Optional)</Text>
            <TextInput
              ref={descriptionInputRef}
              style={styles.input}
              placeholder="Add any details about the cat (color, size, behavior, etc.)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={handleDescriptionFocus}
            />
          </View>

          {renderAnimalTypeSelector()}

          <TouchableOpacity
            style={[
              styles.submitButton,
              keyboardVisible && { marginBottom: 120 } // Reduced extra margin when keyboard is visible
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="paw" size={24} color="white" />
                <Text style={styles.submitButtonText}>Add {animalType === 'cat' ? 'Cat' : 'Dog'} Sighting</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mapContainer: {
    margin: 15,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  map: {
    height: 200,
  },
  mapInstructions: {
    backgroundColor: 'white',
    padding: 10,
    fontSize: 14,
    color: '#666',
  },
  imageSection: {
    margin: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 0.48,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  imageButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  changeImageButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  changeImageText: {
    color: 'white',
    fontWeight: '500',
  },
  formSection: {
    margin: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 15,
    minHeight: 150,
    textAlignVertical: 'top',
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginTop: 10,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginBottom: 80,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  animalTypeContainer: {
    margin: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginBottom: 20,
  },
  animalTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  animalTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    width: '48%',
    height: 50,
  },
  activeAnimalTypeButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  animalTypeText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeAnimalTypeText: {
    color: 'white',
  },
});

export default AddCatScreen; 
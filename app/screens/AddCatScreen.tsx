import React, { useState, useEffect } from 'react';
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
  
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState({
    latitude: route.params?.latitude || 0,
    longitude: route.params?.longitude || 0,
  });
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get the current user ID and location if needed
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

  // Submit the cat sighting
  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('Missing Photo', 'Please add a photo of the cat');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not available');
      return;
    }

    setLoading(true);
    console.log('=== STARTING CAT SUBMISSION PROCESS ===');
    console.log('Image URI:', imageUri.substring(0, 50) + '...');
    console.log('User ID:', userId);
    console.log('Location:', JSON.stringify(location));

    try {
      // First, try to compress the image if it's too large
      let finalImageUri = imageUri;
      let imageUrl = '';
      let uploadSuccess = false;
      
      // Upload the image to Supabase storage
      console.log('Uploading image to Supabase...');
      
      try {
        // First attempt - try the normal upload
        console.log('Attempting primary upload method...');
        imageUrl = await catService.uploadImage(finalImageUri, userId);
        
        if (imageUrl) {
          console.log('Image uploaded successfully:', imageUrl);
          console.log('Is placeholder image:', imageUrl.includes('placekitten.com') ? 'Yes' : 'No');
          uploadSuccess = true;
        } else {
          throw new Error('Failed to upload image');
        }
      } catch (uploadError) {
        console.error('Error during image upload:', uploadError);
        
        // Try with the fallback method
        console.log('Using fallback image service...');
        imageUrl = catService.uploadToPublicService();
        console.log('Fallback image URL:', imageUrl);
        uploadSuccess = true;
      }
      
      if (!uploadSuccess) {
        throw new Error('All image upload methods failed');
      }

      // Add the cat sighting to the database
      console.log('Adding cat to database...');
      try {
        const newCat = await catService.addCat({
          user_id: userId,
          latitude: location.latitude,
          longitude: location.longitude,
          image_url: imageUrl,
          description: description.trim() || 'Stray cat spotted',
          spotted_at: new Date().toISOString(),
        });

        if (newCat) {
          console.log('Cat added successfully:', newCat.id);
          
          // Show different messages based on whether we used a fallback image
          if (imageUrl.includes('placekitten.com')) {
            Alert.alert(
              'Partial Success',
              'Cat sighting was added but we had to use a placeholder image. The original image could not be uploaded.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          } else {
            Alert.alert(
              'Success',
              'Cat sighting added successfully!',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        } else {
          throw new Error('Failed to add cat sighting');
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save cat sighting to database');
      }
    } catch (error: any) {
      console.error('Error adding cat:', error);
      Alert.alert('Error', `Failed to add cat sighting: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
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
            Drag the marker to the exact location where you spotted the cat
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

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Description (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Add any details about the cat (color, size, behavior, etc.)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="paw" size={20} color="white" />
              <Text style={styles.submitButtonText}>Add Cat Sighting</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
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
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default AddCatScreen; 
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { lostAnimalsService } from '../services/lostAnimals';
import { locationService } from '../services/location/locationService';
import { useAuth } from '../contexts/AuthContext';

const CreateLostAnimalScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [animalType, setAnimalType] = useState<'cat' | 'dog'>('cat');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [lastSeenDate, setLastSeenDate] = useState(new Date());
  
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const pickImage = async (index: number) => {
    const { status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = [...photos];
      newPhotos[index] = result.assets[0].uri;
      setPhotos(newPhotos);
    }
  };

  const takePhoto = async (index: number) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = [...photos];
      newPhotos[index] = result.assets[0].uri;
      setPhotos(newPhotos);
    }
  };

  const handlePhotoOptions = (index: number) => {
    Alert.alert(
      'Add Photo',
      'Choose a method',
      [
        { text: 'Take Photo', onPress: () => takePhoto(index) },
        { text: 'Choose from Gallery', onPress: () => pickImage(index) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getCurrentLocation = async () => {
    try {
      const loc = await locationService.getCurrentLocation();
      if (loc) {
        setLocation(loc);
        
        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.latitude}&lon=${loc.longitude}`
          );
          const data = await response.json();
          
          if (data.display_name) {
            setLastSeenAddress(data.display_name);
          } else {
            setLastSeenAddress(`${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
          }
        } catch (geocodeError) {
          console.error('Geocoding error:', geocodeError);
          setLastSeenAddress(`${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
        }
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter the animal\'s name');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Information', 'Please provide a description');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Missing Photos', 'Please add at least one photo');
      return;
    }
    if (!contactName.trim()) {
      Alert.alert('Missing Information', 'Please enter your contact name');
      return;
    }
    if (!contactPhone.trim() && !contactEmail.trim()) {
      Alert.alert('Missing Information', 'Please provide at least one contact method');
      return;
    }
    if (!location) {
      Alert.alert('Missing Location', 'Please set the last seen location');
      return;
    }

    setLoading(true);

    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const url = await lostAnimalsService.uploadPhoto(photos[i], user!.id, i);
        if (url) {
          photoUrls.push(url);
        }
      }

      if (photoUrls.length === 0) {
        throw new Error('Failed to upload photos');
      }

      // Create post
      const result = await lostAnimalsService.createLostAnimal({
        animal_type: animalType,
        name: name.trim(),
        description: description.trim(),
        breed: breed.trim() || undefined,
        color: color.trim() || undefined,
        age: age.trim() || undefined,
        gender,
        photo_urls: photoUrls,
        last_seen_location: location,
        last_seen_address: lastSeenAddress.trim() || undefined,
        last_seen_date: lastSeenDate,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
      });

      if (result) {
        // Small delay to ensure database has propagated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        Alert.alert(
          'Posted Successfully',
          'Your lost animal post has been created. We\'ll notify you if we find any matches!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('[CreateLostAnimal] Error:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Lost Animal</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Animal Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Animal Type *</Text>
            <View style={styles.typeButtons}>
              <TouchableOpacity
                style={[styles.typeButton, animalType === 'cat' && styles.typeButtonActive]}
                onPress={() => setAnimalType('cat')}
              >
                <Ionicons name="paw" size={24} color={animalType === 'cat' ? '#fff' : '#4CAF50'} />
                <Text style={[styles.typeButtonText, animalType === 'cat' && styles.typeButtonTextActive]}>
                  Cat
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, animalType === 'dog' && styles.typeButtonActive]}
                onPress={() => setAnimalType('dog')}
              >
                <Ionicons name="paw-outline" size={24} color={animalType === 'dog' ? '#fff' : '#4CAF50'} />
                <Text style={[styles.typeButtonText, animalType === 'dog' && styles.typeButtonTextActive]}>
                  Dog
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos * (up to 3)</Text>
            <View style={styles.photosGrid}>
              {[0, 1, 2].map((index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.photoBox}
                  onPress={() => handlePhotoOptions(index)}
                >
                  {photos[index] ? (
                    <Image source={{ uri: photos[index] }} style={styles.photoImage} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera" size={32} color="#BDBDBD" />
                      <Text style={styles.photoPlaceholderText}>
                        {index === 0 ? 'Required' : 'Optional'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Name *"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description * (appearance, behavior, etc.)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
            <TextInput
              style={styles.input}
              placeholder="Breed (optional)"
              value={breed}
              onChangeText={setBreed}
            />
            <TextInput
              style={styles.input}
              placeholder="Color (optional)"
              value={color}
              onChangeText={setColor}
            />
          </View>

          {/* Last Seen */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Seen</Text>
            <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
              <Ionicons name="location" size={20} color="#4CAF50" />
              <Text style={styles.locationButtonText}>
                {location ? 'Location set' : 'Set current location *'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Address or landmark (optional)"
              value={lastSeenAddress}
              onChangeText={setLastSeenAddress}
            />
          </View>

          {/* Contact Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name *"
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Post Lost Animal</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  photosGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  photoBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: 8,
    marginBottom: 12,
  },
  locationButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CreateLostAnimalScreen;

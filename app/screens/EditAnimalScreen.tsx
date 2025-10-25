import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { catService } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

type EditAnimalScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'EditAnimal'
>;

type EditAnimalScreenRouteProp = RouteProp<RootStackParamList, 'EditAnimal'>;

const EditAnimalScreen: React.FC = () => {
  const navigation = useNavigation<EditAnimalScreenNavigationProp>();
  const route = useRoute<EditAnimalScreenRouteProp>();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [animal, setAnimal] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState({
    latitude: 0,
    longitude: 0,
  });
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  const THEME = {
    primary: '#D0F0C0',
    secondary: '#2E7D32',
    accent: '#388E3C',
    inactive: '#90A4AE',
  };

  useEffect(() => {
    const fetchAnimal = async () => {
      try {
        setLoading(true);
        const animalId = route.params?.animalId;

        if (!animalId) {
          Alert.alert('Error', 'Animal not found');
          navigation.goBack();
          return;
        }

        const animalData = await catService.getCatById(animalId);
        if (!animalData) {
          Alert.alert('Error', 'Animal not found');
          navigation.goBack();
          return;
        }

        // Check ownership
        if (!user?.id || animalData.auth_user_id !== user.id) {
          Alert.alert('Error', 'You can only edit your own animal sightings');
          navigation.goBack();
          return;
        }

        setAnimal(animalData);
        setDescription(animalData.description || '');
        setLocation({
          latitude: animalData.latitude,
          longitude: animalData.longitude,
        });
        setMapRegion({
          latitude: animalData.latitude,
          longitude: animalData.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        console.error('Error fetching animal:', error);
        Alert.alert('Error', 'Failed to load animal details');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchAnimal();
  }, [route.params?.animalId, user]);

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    try {
      setSaving(true);

      const success = await catService.updateAnimal(animal.id, {
        description: description.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (success) {
        Alert.alert('Success', 'Animal sighting updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to update animal sighting');
      }
    } catch (error) {
      console.error('Error updating animal:', error);
      Alert.alert('Error', 'Failed to update animal sighting');
    } finally {
      setSaving(false);
    }
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.secondary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the animal (color, size, behavior, etc.)"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Location Map */}
        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.hint}>Tap on the map to update the location</Text>
          <View style={styles.mapContainer}>
            {mapRegion && (
              <MapView
                ref={mapRef}
                style={styles.map}
                region={mapRegion}
                onRegionChangeComplete={setMapRegion}
                onPress={handleMapPress}
              >
                <Marker
                  coordinate={location}
                  draggable
                  onDragEnd={(e) => {
                    setLocation({
                      latitude: e.nativeEvent.coordinate.latitude,
                      longitude: e.nativeEvent.coordinate.longitude,
                    });
                  }}
                />
              </MapView>
            )}
          </View>
          <View style={styles.coordinatesContainer}>
            <Ionicons name="location-outline" size={16} color={THEME.secondary} />
            <Text style={styles.coordinates}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Animal Type Info */}
        <View style={styles.section}>
          <Text style={styles.label}>Animal Type</Text>
          <View style={styles.infoBox}>
            <Ionicons
              name={animal?.animal_type === 'dog' ? 'paw' : 'logo-octocat'}
              size={20}
              color={THEME.secondary}
            />
            <Text style={styles.infoText}>
              {animal?.animal_type === 'dog' ? 'Dog' : 'Cat'}
            </Text>
            <Text style={styles.infoSubtext}>(Cannot be changed)</Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
  coordinatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  coordinates: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  infoSubtext: {
    fontSize: 13,
    color: '#999',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#90A4AE',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default EditAnimalScreen;

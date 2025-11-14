import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { catService, supabase } from '../services/supabase';
import { locationService } from '../services/location/locationService';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { CommentsSection } from '../components/CommentsSection';
import { commentService } from '../services/comments';
import { COLORS } from '../styles/theme';
import { favoritesService } from '../services/favorites';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type CatDetailsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CatDetails'
>;

type CatDetailsScreenRouteProp = RouteProp<RootStackParamList, 'CatDetails'>;

const CatDetailsScreen: React.FC = () => {
  const navigation = useNavigation<CatDetailsScreenNavigationProp>();
  const route = useRoute<CatDetailsScreenRouteProp>();
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [animal, setAnimal] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [distance, setDistance] = useState<string | null>(null);
  const [hasHelped, setHasHelped] = useState(false);
  const [hasRescued, setHasRescued] = useState(false);
  const [recordingAction, setRecordingAction] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  const [commentCount, setCommentCount] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [rescuerName, setRescuerName] = useState('');
  const [rescuerPhone, setRescuerPhone] = useState('');
  const [rescuerEmail, setRescuerEmail] = useState('');
  const [rescueNotes, setRescueNotes] = useState('');
  
  // Bottom sheet ref and snap points
  const rescueBottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['90%'], []);
  
  // Backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );



  useEffect(() => {
    const fetchAnimalDetails = async () => {
      try {
        setLoading(true);

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
          
          // Invalidate animals list cache so it refreshes
          const { cache } = await import('../services/cache');
          cache.invalidatePattern('animals:list');
          console.log('[CatDetails] Invalidated animals list cache');
          
          // Go back immediately without alert to avoid showing error screen
          navigation.goBack();
          // Show toast-style message after navigation
          setTimeout(() => {
            Alert.alert('Animal Not Found', 'This animal may have been removed or is no longer available.');
          }, 300);
          return;
        }

        setAnimal(animalDetails);
        setEditedDescription(animalDetails.description || '');

        // Load comment count
        const count = await commentService.getCommentCount(animalId);
        setCommentCount(count);

        // Load favorite status and count
        if (user) {
          const favStatus = await favoritesService.isFavorited(animalId);
          setIsFavorited(favStatus);
        }
        const favCount = await favoritesService.getFavoriteCount(animalId);
        setFavoriteCount(favCount);

        // Debug: Log animal details (PII-safe, dev only)
        if (__DEV__) {
          // Redact sensitive fields before logging
          const safeDetails = {
            id: animalDetails.id,
            name: (animalDetails as any).name,
            breed: (animalDetails as any).breed,
            color: (animalDetails as any).color,
            age: (animalDetails as any).age,
            gender: (animalDetails as any).gender,
            health_status: (animalDetails as any).health_status,
            is_neutered: (animalDetails as any).is_neutered,
            is_adoptable: (animalDetails as any).is_adoptable,
            animal_type: (animalDetails as any).animal_type,
            description: animalDetails.description?.substring(0, 50) + '...',
            contact_info: (animalDetails as any).contact_info ? '[REDACTED]' : null,
            auth_user_id: (animalDetails as any).auth_user_id ? '[REDACTED]' : null,
          };
          console.log('[CatDetails] Animal data (PII redacted):', safeDetails);
        }

        // Check if current authenticated user is the owner
        if (user?.id) {
          // Check if user's auth ID matches the animal's auth_user_id
          const isUserOwner = (animalDetails as any).auth_user_id === user.id;
          if (__DEV__) {
            console.log('[CatDetails] Ownership check:', {
              userId: '[REDACTED]',
              animalAuthUserId: '[REDACTED]',
              isOwner: isUserOwner
            });
          }
          setIsOwner(isUserOwner);

          // Check if user has already helped or rescued this animal
          const actions = await catService.getAnimalActions(animalId);
          const userHelped = actions.some(
            (a) => a.user_id === user.id && a.action_type === 'helped'
          );
          const userRescued = actions.some(
            (a) => a.user_id === user.id && a.action_type === 'rescued'
          );
          setHasHelped(userHelped);
          setHasRescued(userRescued);
        } else {
          setIsOwner(false);
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
  }, [route.params?.catId, user]);

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
    navigation.navigate('EditAnimal', { animalId: route.params?.catId || '' });
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

  const handleHelped = async () => {
    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to record that you helped this animal.');
      return;
    }

    if (hasHelped) {
      Alert.alert('Already Recorded', 'You have already recorded helping this animal!');
      return;
    }

    try {
      setRecordingAction(true);
      const success = await catService.recordAction(
        user.id,
        animal.id,
        'helped'
      );

      if (success) {
        setHasHelped(true);
        Alert.alert(
          'Thank You!',
          'Your help has been recorded. Thank you for caring for this animal!'
        );
      } else {
        Alert.alert('Already Recorded', 'You have already recorded helping this animal.');
      }
    } catch (error) {
      console.error('Error recording help:', error);
      Alert.alert('Error', 'Failed to record your help. Please try again.');
    } finally {
      setRecordingAction(false);
    }
  };

  const handleRescued = async () => {
    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to record that you rescued this animal.');
      return;
    }

    if (hasRescued) {
      Alert.alert('Already Recorded', 'You have already recorded rescuing this animal!');
      return;
    }

    // Open bottom sheet to collect rescuer contact info
    rescueBottomSheetRef.current?.expand();
  };

  const confirmRescue = async () => {
    const name = rescuerName.trim();
    const phone = rescuerPhone.trim();
    const email = rescuerEmail.trim();

    if (!name) {
      Alert.alert('Name Required', 'Please provide your name so the owner can contact you.');
      return;
    }

    if (!phone && !email) {
      Alert.alert('Contact Required', 'Please provide at least a phone number or email.');
      return;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
    }

    try {
      setRecordingAction(true);
      rescueBottomSheetRef.current?.close();

      // Update animal with rescuer contact info
      const { error } = await supabase
        .from('animals')
        .update({
          rescuer_name: name,
          rescuer_phone: phone || null,
          rescuer_email: email || null,
          rescue_notes: rescueNotes || null,
        })
        .eq('id', animal.id);

      if (error) throw error;

      // Record the rescue action
      const success = await catService.recordAction(
        user!.id,
        animal.id,
        'rescued'
      );

      if (success) {
        setHasRescued(true);
        Alert.alert(
          'Amazing!',
          'Thank you for rescuing this animal! Your contact info has been saved so the owner can reach you.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Already Recorded', 'You have already recorded rescuing this animal.');
      }
    } catch (error) {
      console.error('Error recording rescue:', error);
      Alert.alert('Error', 'Failed to record the rescue. Please try again.');
    } finally {
      setRecordingAction(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to favorite animals');
      return;
    }

    try {
      const newStatus = await favoritesService.toggleFavorite(animal.id);
      setIsFavorited(newStatus);
      setFavoriteCount(prev => newStatus ? prev + 1 : prev - 1);
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const handleShare = async () => {
    try {
      const message = `Check out this stray animal I found using the  app! ${animal?.description || ''
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
        <ActivityIndicator size="large" color={COLORS.primaryDark} />
        <Text style={styles.loadingText}>Loading animal details...</Text>
      </View>
    );
  }

  if (!animal) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={COLORS.error} />
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
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
          
          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleToggleFavorite}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={28}
              color={isFavorited ? '#FF6B6B' : '#fff'}
            />
            {favoriteCount > 0 && (
              <View style={styles.favoriteCountBadge}>
                <Text style={styles.favoriteCountText}>{favoriteCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'details' && styles.activeTab]}
            onPress={() => setActiveTab('details')}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={activeTab === 'details' ? '#2E7D32' : '#666'}
            />
            <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
              Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'comments' && styles.activeTab]}
            onPress={() => setActiveTab('comments')}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={20}
              color={activeTab === 'comments' ? '#2E7D32' : '#666'}
            />
            <Text style={[styles.tabText, activeTab === 'comments' && styles.activeTabText]}>
              Comments {commentCount > 0 && `(${commentCount})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'details' ? (
          <View style={styles.detailsContainer}>
            {/* Time and Distance */}
            <View style={styles.metaInfo}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={18} color={COLORS.primaryDark} />
                <Text style={styles.metaText}>
                  {formatDate(animal.spotted_at)}
                </Text>
              </View>
              {distance && (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={18} color={COLORS.primaryDark} />
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

            {/* Rescuer Contact Info (for rescued animals) */}
            {animal.is_rescued && animal.rescuer_name && (
              <View style={styles.rescuerInfoContainer}>
                <View style={styles.rescuerHeader}>
                  <Ionicons name="heart-circle" size={24} color="#4CAF50" />
                  <Text style={styles.rescuerTitle}>Animal Rescued!</Text>
                </View>
                <Text style={styles.rescuerSubtitle}>
                  This animal has been rescued. Contact the rescuer if this is your lost pet:
                </Text>
                <View style={styles.rescuerDetails}>
                  <View style={styles.rescuerRow}>
                    <Ionicons name="person" size={18} color="#4CAF50" />
                    <Text style={styles.rescuerLabel}>Rescuer:</Text>
                    <Text style={styles.rescuerValue}>{animal.rescuer_name}</Text>
                  </View>
                  {animal.rescuer_phone && (
                    <TouchableOpacity 
                      style={styles.rescuerRow}
                      onPress={() => {
                        const phoneUrl = `tel:${animal.rescuer_phone}`;
                        Alert.alert(
                          'Call Rescuer',
                          `Call ${animal.rescuer_name}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Call', onPress: () => Linking.openURL(phoneUrl) }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="call" size={18} color="#4CAF50" />
                      <Text style={styles.rescuerLabel}>Phone:</Text>
                      <Text style={[styles.rescuerValue, styles.rescuerLink]}>{animal.rescuer_phone}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
                    </TouchableOpacity>
                  )}
                  {animal.rescuer_email && (
                    <TouchableOpacity 
                      style={styles.rescuerRow}
                      onPress={() => {
                        const emailUrl = `mailto:${animal.rescuer_email}`;
                        Linking.openURL(emailUrl);
                      }}
                    >
                      <Ionicons name="mail" size={18} color="#4CAF50" />
                      <Text style={styles.rescuerLabel}>Email:</Text>
                      <Text style={[styles.rescuerValue, styles.rescuerLink]}>{animal.rescuer_email}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
                    </TouchableOpacity>
                  )}
                  {animal.rescue_notes && (
                    <View style={styles.rescuerNotesContainer}>
                      <Ionicons name="document-text" size={18} color="#4CAF50" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rescuerLabel}>Notes:</Text>
                        <Text style={styles.rescuerNotes}>{animal.rescue_notes}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Animal Details */}
            {(animal.name || animal.breed || animal.color || animal.age || animal.gender || animal.health_status || animal.is_neutered || animal.is_adoptable) && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Animal Details</Text>
                <View style={styles.detailsGrid}>
                  {animal.name && (
                    <View style={styles.detailRow}>
                      <Ionicons name="pricetag-outline" size={18} color={COLORS.primaryDark} />
                      <Text style={styles.detailLabel}>Name:</Text>
                      <Text style={styles.detailValue}>{animal.name}</Text>
                    </View>
                  )}
                  {animal.breed && (
                    <View style={styles.detailRow}>
                      <Ionicons name="paw-outline" size={18} color={COLORS.primaryDark} />
                      <Text style={styles.detailLabel}>Breed:</Text>
                      <Text style={styles.detailValue}>{animal.breed}</Text>
                    </View>
                  )}
                  {animal.color && (
                    <View style={styles.detailRow}>
                      <Ionicons name="color-palette-outline" size={18} color={COLORS.primaryDark} />
                      <Text style={styles.detailLabel}>Color:</Text>
                      <Text style={styles.detailValue}>{animal.color}</Text>
                    </View>
                  )}
                  {animal.age && (
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={18} color={COLORS.primaryDark} />
                      <Text style={styles.detailLabel}>Age:</Text>
                      <Text style={styles.detailValue}>{animal.age}</Text>
                    </View>
                  )}
                  {animal.gender && (
                    <View style={styles.detailRow}>
                      <Ionicons name={animal.gender === 'male' ? 'male' : animal.gender === 'female' ? 'female' : 'help-circle-outline'} size={18} color={COLORS.primaryDark} />
                      <Text style={styles.detailLabel}>Gender:</Text>
                      <Text style={styles.detailValue}>{animal.gender.charAt(0).toUpperCase() + animal.gender.slice(1)}</Text>
                    </View>
                  )}
                  {animal.health_status && (
                    <View style={styles.detailRow}>
                      <Ionicons name="fitness-outline" size={18} color={COLORS.primaryDark} />
                      <Text style={styles.detailLabel}>Health:</Text>
                      <Text style={styles.detailValue}>{animal.health_status.charAt(0).toUpperCase() + animal.health_status.slice(1)}</Text>
                    </View>
                  )}
                  {animal.is_neutered && (
                    <View style={styles.detailRow}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.primaryDark} />
                      <Text style={styles.detailValue}>Neutered/Spayed</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Adoption Information */}
            {animal.is_adoptable && (
              <View style={styles.adoptionCard}>
                <View style={styles.adoptionHeader}>
                  <Ionicons name="heart" size={24} color="#FF9800" />
                  <Text style={styles.adoptionTitle}>Available for Adoption!</Text>
                </View>
                <Text style={styles.adoptionText}>
                  This animal is looking for a loving home.
                </Text>
                {animal.contact_info && (
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={18} color={COLORS.primaryDark} />
                    <Text style={styles.contactText}>{animal.contact_info}</Text>
                  </View>
                )}
              </View>
            )}

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

            {/* Help/Rescue Actions (for all authenticated users) */}
            {user && !animal.is_rescued && (
              <View style={styles.actionButtonsContainer}>
                <Text style={styles.actionTitle}>Did you interact with this animal?</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.helpButton,
                      hasHelped && styles.helpButtonActive,
                      recordingAction && styles.buttonDisabled,
                    ]}
                    onPress={handleHelped}
                    disabled={recordingAction || hasHelped}
                  >
                    <Ionicons
                      name={hasHelped ? 'checkmark-circle' : 'hand-left-outline'}
                      size={22}
                      color={hasHelped ? '#4CAF50' : '#fff'}
                    />
                    <Text style={[styles.helpButtonText, hasHelped && styles.helpButtonTextActive]}>
                      {hasHelped ? 'Helped ✓' : 'I Helped'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.rescueButton,
                      hasRescued && styles.rescueButtonActive,
                      recordingAction && styles.buttonDisabled,
                    ]}
                    onPress={handleRescued}
                    disabled={recordingAction || hasRescued}
                  >
                    {recordingAction ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name={hasRescued ? 'checkmark-circle' : 'heart-outline'}
                          size={22}
                          color={hasRescued ? '#4CAF50' : '#fff'}
                        />
                        <Text style={[styles.rescueButtonText, hasRescued && styles.rescueButtonTextActive]}>
                          {hasRescued ? 'Rescued ✓' : 'I Rescued'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.actionHint}>
                  {hasHelped || hasRescued
                    ? 'Thank you for helping animals in need!'
                    : 'Let others know you helped or rescued this animal'}
                </Text>
              </View>
            )}

            {/* Owner actions */}
            {isOwner && (
              <View style={styles.ownerActionsContainer}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEditDescription}
                >
                  <Ionicons name="create-outline" size={22} color="#fff" />
                  <Text style={styles.editButtonText}>Edit</Text>
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
        ) : null}
      </ScrollView>
      
      {activeTab === 'comments' && (
        <View style={styles.commentsContainer}>
          <CommentsSection animalId={animal.id} />
        </View>
      )}

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

      {/* Rescue Contact Bottom Sheet */}
      <BottomSheet
        ref={rescueBottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        enableDynamicSizing={false}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          <Ionicons name="heart-circle" size={48} color="#4CAF50" style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={styles.sheetTitle}>Rescue Contact Info</Text>
          <Text style={styles.sheetSubtitle}>
            Provide your contact info so the owner can reach you if this is their lost pet
          </Text>

          <Text style={styles.inputLabel}>Your Name *</Text>
          <TextInput
            style={styles.sheetInput}
            value={rescuerName}
            onChangeText={setRescuerName}
            placeholder="Enter your name"
            autoCapitalize="words"
            editable={!recordingAction}
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.sheetInput}
            value={rescuerPhone}
            onChangeText={setRescuerPhone}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            editable={!recordingAction}
          />

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.sheetInput}
            value={rescuerEmail}
            onChangeText={setRescuerEmail}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!recordingAction}
          />

          <Text style={styles.inputLabel}>Notes (Optional)</Text>
          <TextInput
            style={[styles.sheetInput, { height: 80 }]}
            value={rescueNotes}
            onChangeText={setRescueNotes}
            placeholder="Where did you take the animal? Any other details..."
            multiline
            textAlignVertical="top"
            editable={!recordingAction}
          />

          <Text style={styles.sheetHint}>
            * At least name and one contact method required
          </Text>

          <View style={styles.sheetButtons}>
            <TouchableOpacity
              style={[styles.sheetCancelButton, recordingAction && styles.buttonDisabled]}
              onPress={() => !recordingAction && rescueBottomSheetRef.current?.close()}
              disabled={recordingAction}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetConfirmButton}
              onPress={confirmRescue}
              disabled={recordingAction}
            >
              {recordingAction ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sheetConfirmText}>Confirm Rescue</Text>
              )}
            </TouchableOpacity>
          </View>

          {recordingAction && (
            <View pointerEvents="auto" style={styles.processingOverlay} />
          )}
        </BottomSheetScrollView>
      </BottomSheet>
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
  editIconButton: {
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
  rescuerInfoContainer: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  rescuerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rescuerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  rescuerSubtitle: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 16,
    lineHeight: 20,
  },
  rescuerDetails: {
    gap: 12,
  },
  rescuerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  rescuerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
  },
  rescuerValue: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
  },
  rescuerLink: {
    color: '#2E7D32',
    textDecorationLine: 'underline',
  },
  rescuerNotesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  rescuerNotes: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginTop: 4,
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
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  sheetInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
  },
  sheetHint: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  sheetCancelText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetConfirmButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: '#212121',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    fontSize: 16,
    backgroundColor: '#f5f5f5',
    marginBottom: 16,
  },
  modalHint: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 20,
    fontStyle: 'italic',
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
    justifyContent: 'center',
    alignItems: 'stretch',
    marginTop: 16,
    marginBottom: 24,
    gap: 12,
    paddingHorizontal: 16,
  },
  editButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    height: 56,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonsContainer: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  helpButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  helpButtonActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  helpButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
  helpButtonTextActive: {
    color: '#4CAF50',
  },
  rescueButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rescueButtonActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  rescueButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
  rescueButtonTextActive: {
    color: '#4CAF50',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  detailsSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    minWidth: 60,
  },
  detailValue: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  adoptionCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  adoptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  adoptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F57C00',
  },
  adoptionText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 12,
    lineHeight: 22,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  contactText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  commentsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5F5F5',
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  favoriteCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  favoriteCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default CatDetailsScreen; 

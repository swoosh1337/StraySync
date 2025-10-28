import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { lostAnimalsService, LostAnimal } from '../services/lostAnimals';
import { useAuth } from '../contexts/AuthContext';

type LostAnimalDetailsRouteProp = RouteProp<RootStackParamList, 'LostAnimalDetails'>;

const LostAnimalDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<LostAnimalDetailsRouteProp>();
  const { user } = useAuth();
  const { lostAnimalId } = route.params;

  const [lostAnimal, setLostAnimal] = useState<LostAnimal | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    loadLostAnimal();
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoadingMatches(true);
      const matchesData = await lostAnimalsService.getMatches(lostAnimalId);
      setMatches(matchesData);
      
      // Mark all unviewed matches as viewed
      const unviewedMatches = matchesData.filter((m: any) => !m.viewed);
      for (const match of unviewedMatches) {
        await lostAnimalsService.markMatchViewed(match.id);
      }
    } catch (error) {
      console.error('[LostAnimalDetails] Error loading matches:', error);
    } finally {
      setLoadingMatches(false);
    }
  };

  const loadLostAnimal = async () => {
    try {
      // For now, get from the list - in production you'd have a getById method
      const animals = await lostAnimalsService.getActiveLostAnimals();
      const animal = animals.find(a => a.id === lostAnimalId);
      setLostAnimal(animal || null);
    } catch (error) {
      console.error('[LostAnimalDetails] Error loading:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsFound = async () => {
    if (!lostAnimal) return;

    Alert.alert(
      'Mark as Found?',
      'This will mark your lost animal as found and stop matching.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Found',
          style: 'default',
          onPress: async () => {
            await lostAnimalsService.markAsFound(lostAnimal.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!lostAnimal) return;

    Alert.alert(
      'Delete Post?',
      'This will permanently delete your lost animal post. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await lostAnimalsService.deleteLostAnimal(lostAnimal.id);
              Alert.alert('Deleted', 'Your post has been deleted');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleContact = (type: 'phone' | 'email') => {
    if (!lostAnimal) return;

    if (type === 'phone' && lostAnimal.contact_phone) {
      Linking.openURL(`tel:${lostAnimal.contact_phone}`);
    } else if (type === 'email' && lostAnimal.contact_email) {
      Linking.openURL(`mailto:${lostAnimal.contact_email}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!lostAnimal) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF5722" />
        <Text style={styles.errorText}>Lost animal not found</Text>
      </View>
    );
  }

  const photos = [
    lostAnimal.photo_url_1,
    lostAnimal.photo_url_2,
    lostAnimal.photo_url_3,
  ].filter(Boolean);

  const isOwner = user?.id === lostAnimal.user_id;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Photo Gallery */}
        <View style={styles.photoSection}>
          <Image
            source={{ uri: photos[currentPhotoIndex] }}
            style={styles.mainPhoto}
            resizeMode="cover"
          />
          
          {photos.length > 1 && (
            <View style={styles.photoIndicators}>
              {photos.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.photoIndicator,
                    index === currentPhotoIndex && styles.photoIndicatorActive,
                  ]}
                  onPress={() => setCurrentPhotoIndex(index)}
                />
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.name}>{lostAnimal.name}</Text>
              <View style={styles.typeTag}>
                <Ionicons
                  name={lostAnimal.animal_type === 'cat' ? 'paw' : 'paw-outline'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.typeTagText}>
                  {lostAnimal.animal_type === 'cat' ? 'Cat' : 'Dog'}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{lostAnimal.description}</Text>
          </View>

          {/* Details */}
          {(lostAnimal.breed || lostAnimal.color || lostAnimal.age) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>
              {lostAnimal.breed && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Breed:</Text>
                  <Text style={styles.detailValue}>{lostAnimal.breed}</Text>
                </View>
              )}
              {lostAnimal.color && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Color:</Text>
                  <Text style={styles.detailValue}>{lostAnimal.color}</Text>
                </View>
              )}
              {lostAnimal.age && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Age:</Text>
                  <Text style={styles.detailValue}>{lostAnimal.age}</Text>
                </View>
              )}
            </View>
          )}

          {/* Last Seen */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Seen</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color="#4CAF50" />
              <Text style={styles.locationText}>
                {lostAnimal.last_seen_address || 'Location provided'}
              </Text>
            </View>
            <Text style={styles.dateText}>
              {new Date(lostAnimal.last_seen_date).toLocaleDateString()}
            </Text>
          </View>

          {/* Potential Matches */}
          {isOwner && matches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Potential Matches ({matches.length})
              </Text>
              <Text style={styles.matchesSubtitle}>
                AI found these possible sightings of {lostAnimal.name}
              </Text>
              {matches.map((match: any) => (
                <TouchableOpacity
                  key={match.id}
                  style={styles.matchCard}
                  onPress={() => navigation.navigate('CatDetails', { catId: match.sighting_id })}
                >
                  {match.sighting?.image_url && (
                    <Image
                      source={{ uri: match.sighting.image_url }}
                      style={styles.matchImage}
                    />
                  )}
                  <View style={styles.matchContent}>
                    <View style={styles.matchHeader}>
                      <Text style={styles.matchConfidence}>
                        {match.confidence_score}% Match
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color="#757575" />
                    </View>
                    <Text style={styles.matchReason} numberOfLines={2}>
                      {match.match_reason}
                    </Text>
                    <Text style={styles.matchDate}>
                      Spotted {new Date(match.sighting?.spotted_at).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isOwner && loadingMatches && (
            <View style={styles.section}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.loadingText}>Checking for matches...</Text>
            </View>
          )}

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.contactName}>{lostAnimal.contact_name}</Text>
            
            <View style={styles.contactButtons}>
              {lostAnimal.contact_phone && (
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => handleContact('phone')}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.contactButtonText}>Call</Text>
                </TouchableOpacity>
              )}
              {lostAnimal.contact_email && (
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => handleContact('email')}
                >
                  <Ionicons name="mail" size={20} color="#fff" />
                  <Text style={styles.contactButtonText}>Email</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Owner Actions */}
          {isOwner && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.foundButton}
                onPress={handleMarkAsFound}
              >
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.foundButtonText}>Mark as Found</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Ionicons name="trash" size={20} color="#FF5722" />
                <Text style={styles.deleteButtonText}>Delete Post</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#FF5722',
    marginTop: 16,
  },
  photoSection: {
    position: 'relative',
    height: 300,
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  photoIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  photoIndicatorActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    alignSelf: 'flex-start',
  },
  typeTagText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  matchesSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
  },
  matchCard: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  matchImage: {
    width: 100,
    height: 100,
    backgroundColor: '#E0E0E0',
  },
  matchContent: {
    flex: 1,
    padding: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchConfidence: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  matchReason: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 8,
    lineHeight: 20,
  },
  matchDate: {
    fontSize: 12,
    color: '#757575',
  },
  loadingText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
  },
  description: {
    fontSize: 16,
    color: '#424242',
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: '#757575',
    width: 80,
  },
  detailValue: {
    fontSize: 16,
    color: '#212121',
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#212121',
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#757575',
  },
  contactName: {
    fontSize: 16,
    color: '#212121',
    marginBottom: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  foundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  foundButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#FF5722',
  },
  deleteButtonText: {
    color: '#FF5722',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LostAnimalDetailsScreen;

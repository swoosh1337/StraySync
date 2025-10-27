import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { catService, profileService } from '../services/supabase';
import { Cat } from '../types';
import { RootStackParamList } from '../navigation';
import { AnimalCardSkeleton } from '../components/SkeletonLoader';
import { favoritesService } from '../services/favorites';
import { notificationService } from '../services/notifications';

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

// Available animal emojis for profile picture
const ANIMAL_EMOJIS = [
  '🐱', '🐶', '🐾', '🦊', '🐰', '🐻',
  '🐼', '🦁', '🐯', '🐨', '🐷', '🐸',
];

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, profile, profileLoading, signOut, refreshProfile } = useAuth();
  const [myAnimals, setMyAnimals] = useState<Cat[]>([]);
  const [favoriteAnimals, setFavoriteAnimals] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'sightings' | 'favorites'>('sightings');
  const [showRescuedFavorites, setShowRescuedFavorites] = useState(true);

  // Log profile state on every render (only in DEV)
  if (__DEV__) {
    console.log('🎭 [ProfileScreen] Profile:', profile ? 'Loaded' : (profileLoading ? 'Loading...' : 'Not loaded'));
    console.log('User ID:', user?.id);
  }

  // Stats state
  const [helpedCount, setHelpedCount] = useState(0);
  const [rescuedCount, setRescuedCount] = useState(0);

  // Username editing state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Emoji avatar selection state
  const [isSelectingEmoji, setIsSelectingEmoji] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(profile?.avatar_url || '🐾');

  // Sync selectedEmoji with profile when profile changes
  useEffect(() => {
    console.log('🔄 [ProfileScreen] useEffect triggered - profile.avatar_url:', profile?.avatar_url);
    if (profile?.avatar_url) {
      console.log('Setting selectedEmoji to:', profile.avatar_url);
      setSelectedEmoji(profile.avatar_url);
    } else {
      console.log('No avatar_url in profile, keeping default');
    }
  }, [profile?.avatar_url]);

  const fetchMyAnimals = async () => {
    if (!user?.id) {
      setMyAnimals([]);
      setHelpedCount(0);
      setRescuedCount(0);
      setLoading(false);
      return;
    }

    try {
      // Fetch animals, stats, and favorites in parallel
      const [animals, stats, favorites] = await Promise.all([
        catService.getUserAnimals(user.id),
        catService.getUserStats(user.id),
        favoritesService.getUserFavorites(),
      ]);

      setMyAnimals(animals);
      setFavoriteAnimals(favorites);
      setHelpedCount(stats.helped);
      setRescuedCount(stats.rescued);
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load your data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyAnimals();
  }, [user]);

  // Subscribe to favorite animal updates for notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = notificationService.subscribeToFavoriteUpdates(
      user.id,
      (animal) => {
        // Refresh favorites when an animal is rescued
        fetchMyAnimals();
      }
    );

    return () => {
      notificationService.unsubscribeFromUpdates(channel);
    };
  }, [user]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchMyAnimals();
    }, [user])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMyAnimals();
  };

  const handleDeleteAnimal = (animalId: string) => {
    Alert.alert(
      'Delete Animal',
      'Are you sure you want to delete this animal sighting?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) {
              Alert.alert('Error', 'You must be signed in to delete animals.');
              return;
            }

            try {
              const success = await catService.deleteCat(animalId);
              if (success) {
                Alert.alert('Success', 'Animal sighting deleted successfully.');
                fetchMyAnimals();
              } else {
                Alert.alert('Error', 'Failed to delete animal. Please try again.');
              }
            } catch (error) {
              console.error('Error deleting animal:', error);
              Alert.alert('Error', 'An error occurred while deleting.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            Alert.alert('Signed Out', 'You have been successfully signed out.');
          } catch (error) {
            console.error('Error signing out:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleEditUsername = () => {
    setNewUsername(profile?.display_name || '');
    setIsEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    console.log('📝 [ProfileScreen] handleSaveUsername called');
    if (!user?.id) {
      console.log('⚠️ No user ID found');
      Alert.alert('Error', 'You must be logged in to update your username.');
      return;
    }

    if (!profile) {
      console.log('⚠️ Profile not loaded yet');
      Alert.alert('Please Wait', 'Your profile is still loading. Please try again in a moment.');
      return;
    }

    const trimmedUsername = newUsername.trim();
    console.log('New username:', trimmedUsername);

    // Validation
    if (trimmedUsername.length < 2) {
      Alert.alert('Invalid Username', 'Username must be at least 2 characters long.');
      return;
    }
    if (trimmedUsername.length > 30) {
      Alert.alert('Invalid Username', 'Username must be less than 30 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedUsername)) {
      Alert.alert('Invalid Username', 'Username can only contain letters, numbers, spaces, dashes, and underscores.');
      return;
    }

    try {
      setSavingUsername(true);
      console.log('Calling profileService.updateProfile...');

      const success = await profileService.updateProfile(user.id, {
        display_name: trimmedUsername,
      });

      console.log('Update success:', success);
      if (success) {
        // Refresh profile to get updated data
        console.log('Calling refreshProfile...');
        if (refreshProfile) {
          await refreshProfile();
          console.log('refreshProfile completed');
        } else {
          console.log('⚠️ refreshProfile not available');
        }
        console.log('Current profile state:', profile);
        setIsEditingUsername(false);
        Alert.alert('Success', 'Username updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update username. Please try again in a moment.');
      }
    } catch (error) {
      console.error('❌ Error updating username:', error);
      Alert.alert('Error', 'An error occurred while updating your username.');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSelectEmoji = async (emoji: string) => {
    console.log('🖼️ [ProfileScreen] handleSelectEmoji called, emoji:', emoji);
    if (!user?.id) {
      console.log('⚠️ No user ID found');
      Alert.alert('Error', 'You must be logged in to update your profile picture.');
      return;
    }

    if (!profile) {
      console.log('⚠️ Profile not loaded yet');
      Alert.alert('Please Wait', 'Your profile is still loading. Please try again in a moment.');
      return;
    }

    try {
      console.log('Calling profileService.updateProfile...');

      const success = await profileService.updateProfile(user.id, {
        avatar_url: emoji,
      });

      console.log('Update success:', success);
      if (success) {
        // Update local state immediately for better UX
        console.log('Setting local selectedEmoji state to:', emoji);
        setSelectedEmoji(emoji);

        // Refresh profile to get updated data from database
        console.log('Calling refreshProfile...');
        if (refreshProfile) {
          await refreshProfile();
          console.log('refreshProfile completed');
        } else {
          console.log('⚠️ refreshProfile not available');
        }

        console.log('Current profile state:', profile);
        setIsSelectingEmoji(false);
        Alert.alert('Success', 'Profile picture updated!');
      } else {
        Alert.alert('Error', 'Failed to update profile picture. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error updating emoji:', error);
      Alert.alert('Error', 'An error occurred while updating your profile picture.');
    }
  };

  const renderAnimalItem = ({ item }: { item: Cat }) => {
    const animalType = item.animal_type === 'dog' ? 'Dog' : 'Cat';
    const isRescued = item.is_rescued || item.status === 'rescued';
    const statusIcon =
      item.status === 'rescued'
        ? 'heart'
        : item.status === 'helped'
          ? 'checkmark-circle'
          : 'paw';
    const statusColor =
      item.status === 'rescued'
        ? '#4CAF50'
        : item.status === 'helped'
          ? '#2196F3'
          : '#757575';

    return (
      <TouchableOpacity
        style={[styles.animalCard, isRescued && styles.rescuedCard]}
        onPress={() => navigation.navigate('CatDetails', { catId: item.id })}
      >
        <Image
          source={{ uri: item.image_url }}
          style={[styles.animalImage, isRescued && styles.rescuedImage]}
        />
        {isRescued && (
          <View style={styles.rescuedBadge}>
            <Ionicons name="heart" size={14} color="#fff" />
            <Text style={styles.rescuedBadgeText}>Rescued!</Text>
          </View>
        )}
        <View style={styles.animalInfo}>
          <Text style={styles.animalType}>{animalType}</Text>
          <Text style={styles.animalDescription} numberOfLines={2}>
            {item.description || 'No description'}
          </Text>
          <Text style={styles.animalDate}>
            Spotted: {new Date(item.spotted_at).toLocaleDateString()}
          </Text>
          {isRescued && (
            <Text style={styles.rescuedNote}>
              🎉 This animal has been rescued!
            </Text>
          )}
        </View>
        <View style={styles.animalActions}>
          <View style={styles.statusIconContainer}>
            <Ionicons name={statusIcon} size={24} color={statusColor} />
          </View>
          {activeTab === 'sightings' && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteAnimal(item.id)}
            >
              <Ionicons name="trash-outline" size={24} color="#FF5722" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-circle-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Please sign in to view your profile</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setIsSelectingEmoji(true)}
          >
            <Text style={styles.avatarEmoji}>
              {profile?.avatar_url || selectedEmoji || '🐾'}
            </Text>
            <View style={styles.editAvatarBadge}>
              <Ionicons name="pencil" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.profileText}>
            <View style={styles.usernameRow}>
              <Text style={styles.profileName}>
                {profileLoading ? 'Loading...' : (profile?.display_name || 'User')}
              </Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditUsername}
              >
                <Ionicons name="pencil" size={16} color="#4CAF50" />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileEmail}>{user.email}</Text>
            {profile?.is_supporter && (
              <View style={styles.supporterBadge}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.supporterText}>Supporter</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={24} color="#FF5722" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{myAnimals.length}</Text>
          <Text style={styles.statLabel}>Sightings</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{helpedCount}</Text>
          <Text style={styles.statLabel}>Helped</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{rescuedCount}</Text>
          <Text style={styles.statLabel}>Rescued</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.profileTab, activeTab === 'sightings' && styles.activeProfileTab]}
          onPress={() => setActiveTab('sightings')}
        >
          <Ionicons
            name="paw"
            size={20}
            color={activeTab === 'sightings' ? '#4CAF50' : '#666'}
          />
          <Text style={[styles.profileTabText, activeTab === 'sightings' && styles.activeProfileTabText]}>
            My Sightings ({myAnimals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.profileTab, activeTab === 'favorites' && styles.activeProfileTab]}
          onPress={() => setActiveTab('favorites')}
        >
          <Ionicons
            name="heart"
            size={20}
            color={activeTab === 'favorites' ? '#4CAF50' : '#666'}
          />
          <Text style={[styles.profileTabText, activeTab === 'favorites' && styles.activeProfileTabText]}>
            Favorites ({favoriteAnimals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter for rescued animals in favorites */}
      {activeTab === 'favorites' && favoriteAnimals.length > 0 && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowRescuedFavorites(!showRescuedFavorites)}
          >
            <Ionicons
              name={showRescuedFavorites ? 'eye' : 'eye-off'}
              size={18}
              color="#666"
            />
            <Text style={styles.filterButtonText}>
              {showRescuedFavorites ? 'Hide' : 'Show'} Rescued Animals
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map((index) => (
            <AnimalCardSkeleton key={index} />
          ))}
        </View>
      ) : activeTab === 'sightings' ? (
        myAnimals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="paw-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No animal sightings yet</Text>
            <Text style={styles.emptySubtext}>
              Start adding animals you've spotted!
            </Text>
          </View>
        ) : (
          <FlatList
            data={myAnimals}
            renderItem={renderAnimalItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#4CAF50']}
              />
            }
          />
        )
      ) : (
        (() => {
          // Filter favorites based on rescued toggle
          const filteredFavorites = showRescuedFavorites
            ? favoriteAnimals
            : favoriteAnimals.filter((animal) => !(animal.is_rescued) && animal.status !== 'rescued');

          return filteredFavorites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>
                {favoriteAnimals.length === 0 ? 'No favorites yet' : 'No active favorites'}
              </Text>
              <Text style={styles.emptySubtext}>
                {favoriteAnimals.length === 0
                  ? 'Tap the heart icon on animals to save them here!'
                  : 'All your favorited animals have been rescued! 🎉'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredFavorites}
              renderItem={renderAnimalItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={['#4CAF50']}
                />
              }
            />
          );
        })()
      )}

      {/* Username Edit Modal */}
      <Modal
        visible={isEditingUsername}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditingUsername(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Username</Text>
              <TouchableOpacity onPress={() => setIsEditingUsername(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.usernameInput}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              maxLength={30}
              autoFocus
            />
            <Text style={styles.inputHint}>
              2-30 characters. Letters, numbers, spaces, dashes, and underscores only.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsEditingUsername(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, savingUsername && styles.saveButtonDisabled]}
                onPress={handleSaveUsername}
                disabled={savingUsername}
              >
                {savingUsername ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Emoji Selection Modal */}
      <Modal
        visible={isSelectingEmoji}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSelectingEmoji(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Profile Picture</Text>
              <TouchableOpacity onPress={() => setIsSelectingEmoji(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.emojiHint}>Tap an animal to set as your profile picture</Text>
            <ScrollView contentContainerStyle={styles.emojiGrid}>
              {ANIMAL_EMOJIS.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.emojiButton,
                    (profile?.avatar_url === emoji || selectedEmoji === emoji) &&
                    styles.emojiButtonSelected,
                  ]}
                  onPress={() => handleSelectEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileHeader: {
    backgroundColor: 'white',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileText: {
    marginLeft: 15,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  supporterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  supporterText: {
    fontSize: 11,
    color: '#F57C00',
    fontWeight: '600',
    marginLeft: 4,
  },
  signOutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 20,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listHeader: {
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  listContent: {
    padding: 10,
  },
  animalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  animalImage: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  animalInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  animalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  animalType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  animalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  animalDate: {
    fontSize: 12,
    color: '#999',
  },
  animalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  statusIconContainer: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    backgroundColor: '#f0f0f0',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  usernameInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  inputHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emojiHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  emojiButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiButtonSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  emojiText: {
    fontSize: 32,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginTop: 16,
  },
  profileTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeProfileTab: {
    borderBottomColor: '#4CAF50',
  },
  profileTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeProfileTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  rescuedCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#F1F8F4',
  },
  rescuedImage: {
    opacity: 0.8,
  },
  rescuedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    zIndex: 1,
  },
  rescuedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  rescuedNote: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

export default ProfileScreen;

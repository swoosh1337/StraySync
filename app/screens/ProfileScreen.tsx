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
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [myAnimals, setMyAnimals] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Log profile state on every render
  console.log('🎭 [ProfileScreen] Render - Current profile:', profile);
  console.log('User ID:', user?.id);

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
      setLoading(false);
      return;
    }

    try {
      const animals = await catService.getUserAnimals(user.id);
      setMyAnimals(animals);
    } catch (error) {
      console.error('Error fetching user animals:', error);
      Alert.alert('Error', 'Failed to load your animals. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyAnimals();
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

      // Add a small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 100));

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

      // Add a small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 100));

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
        style={styles.animalCard}
        onPress={() => navigation.navigate('CatDetails', { catId: item.id })}
      >
        <Image source={{ uri: item.image_url }} style={styles.animalImage} />
        <View style={styles.animalInfo}>
          <View style={styles.animalHeader}>
            <Text style={styles.animalType}>{animalType}</Text>
            <Ionicons name={statusIcon} size={20} color={statusColor} />
          </View>
          <Text style={styles.animalDescription} numberOfLines={2}>
            {item.description || 'No description'}
          </Text>
          <Text style={styles.animalDate}>
            Spotted: {new Date(item.spotted_at).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteAnimal(item.id)}
        >
          <Ionicons name="trash-outline" size={24} color="#FF5722" />
        </TouchableOpacity>
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
                {profile?.display_name || 'User'}
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
          <Text style={styles.statNumber}>
            {myAnimals.filter((a) => a.status === 'helped').length}
          </Text>
          <Text style={styles.statLabel}>Helped</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {myAnimals.filter((a) => a.status === 'rescued').length}
          </Text>
          <Text style={styles.statLabel}>Rescued</Text>
        </View>
      </View>

      {/* My Animals List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>My Animal Sightings</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : myAnimals.length === 0 ? (
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
  deleteButton: {
    padding: 12,
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
});

export default ProfileScreen;

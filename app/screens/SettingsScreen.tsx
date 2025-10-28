import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSettings } from '../contexts/SettingsContext';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { cleanupService } from '../services/cleanup';
import { useAuth } from '../contexts/AuthContext';

// Safely import RevenueCat (may not be available in Expo Go)
let Purchases: any = null;
try {
  Purchases = require('react-native-purchases').default;
} catch (e) {
  console.warn('[Settings] RevenueCat not available (Expo Go)');
}

type SettingsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { user, profile } = useAuth();
  const {
    notificationRadius,
    setNotificationRadius,
    notificationTimeFrame,
    setNotificationTimeFrame,
    isNotificationsEnabled,
    setIsNotificationsEnabled,
    isBackgroundTrackingEnabled,
    setIsBackgroundTrackingEnabled,
    searchRadius,
    setSearchRadius,
  } = useSettings();

  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [isSupporter, setIsSupporter] = useState(false);

  // Check supporter status
  useEffect(() => {
    if (profile?.is_supporter) {
      setIsSupporter(true);
    }
  }, [profile]);

  // Convert kilometers to miles for display
  const kmToMiles = (km: number) => {
    return (km * 0.621371).toFixed(1);
  };

  // Request notification permissions
  const requestNotificationPermission = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive alerts about nearby cats.'
        );
        return false;
      }
    }

    return true;
  };

  // Request location permissions
  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable location services in your device settings to use this feature.'
      );
      return false;
    }

    return true;
  };

  // Handle toggling notifications
  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const hasPermission = await requestNotificationPermission();
      if (hasPermission) {
        setIsNotificationsEnabled(true);
      }
    } else {
      setIsNotificationsEnabled(false);
    }
  };

  // Handle toggling background tracking
  const handleToggleBackgroundTracking = async (value: boolean) => {
    if (value) {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        Alert.alert(
          'Background Location',
          'This will allow the app to track your location in the background to notify you about nearby cats.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Enable',
              onPress: () => setIsBackgroundTrackingEnabled(true),
            },
          ]
        );
      }
    } else {
      setIsBackgroundTrackingEnabled(false);
    }
  };



  // Add these functions to handle button presses
  const handleSupportPress = () => {
    // List of organizations that support stray animals
    const supportOptions = [
      { name: 'ASPCA', url: 'https://www.aspca.org/donate' },
      { name: 'Best Friends Animal Society', url: 'https://bestfriends.org/donate' },
      { name: 'Alley Cat Allies', url: 'https://www.alleycat.org/ways-to-give/' },
      { name: 'Local Animal Shelter', url: 'https://www.petfinder.com/animal-shelters-and-rescues/search/' }
    ];

    // Show an alert with options
    Alert.alert(
      'Support Stray Animals',
      'Choose an organization to donate to:',
      [
        ...supportOptions.map(option => ({
          text: option.name,
          onPress: () => Linking.openURL(option.url)
        })),
        {
          text: 'Cancel',
          style: 'cancel' as const
        }
      ]
    );
  };

  const handleContactPress = () => {
    // Options for contacting - removing email, keeping only website
    const contactOptions = [
      {
        name: 'Website',
        action: () => Linking.openURL('https://stray-sync-landing.vercel.app/')
          .catch(err => {
            Alert.alert('Error', 'Could not open the website. Please try again later.');
          })
      },
    ];

    // Show an alert with options
    Alert.alert(
      'Visit Our Website',
      'Would you like to visit our website?',
      [
        ...contactOptions.map(option => ({
          text: option.name,
          onPress: option.action
        })),
        {
          text: 'Cancel',
          style: 'cancel' as const
        }
      ]
    );
  };

  // Donation tiers
  const donationTiers = [
    {
      id: 'tier1',
      productId: 'com.straysync.donation.tier1',
      price: '$0.99',
      name: 'Cat Lover',
      icon: '🐱',
      color: '#81C784',
      benefits: ['Support development', 'Remove ads (coming soon)'],
    },
    {
      id: 'tier2',
      productId: 'com.straysync.donation.tier2',
      price: '$4.99',
      name: 'Animal Guardian',
      icon: '🐾',
      color: '#66BB6A',
      benefits: ['Support development', 'Remove ads (coming soon)'],
      popular: true,
    },
    {
      id: 'tier3',
      productId: 'com.straysync.donation.tier3',
      price: '$9.99',
      name: 'Rescue Hero',
      icon: '⭐',
      color: '#4CAF50',
      benefits: ['Support development', 'Remove ads (coming soon)'],
    },
  ];

  const handleDonation = async (tierId: string, productId: string) => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to support the app',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => {
              // Navigate to sign in - already handled by AuthContext
            }
          }
        ]
      );
      return;
    }

    try {
      setPurchaseLoading(tierId);

      // In development, show a success message
      if (__DEV__) {
        Alert.alert(
          '🎉 Thank You!',
          'Donation feature is in development mode.\n\nYour support will help us:\n• Keep the app free\n• Add more features\n• Help more stray animals',
          [{ text: 'OK' }]
        );
        setPurchaseLoading(null);
        return;
      }

      // Production: Use RevenueCat
      if (!Purchases) {
        Alert.alert(
          'Not Available',
          'In-app purchases require a production build. Donations are coming soon!',
          [{ text: 'OK' }]
        );
        return;
      }

      const purchaseResult = await Purchases.purchasePackage({
        identifier: productId,
      } as any);

      if (purchaseResult) {
        Alert.alert(
          '🎉 Thank You!',
          'Your support helps us make StraySync better for everyone and helps save more stray animals!',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Purchase error:', error);

      if (error.code !== 'USER_CANCELLED') {
        Alert.alert(
          'Purchase Failed',
          'Something went wrong. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setPurchaseLoading(null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="notifications-outline" size={24} color="#4CAF50" />
            <Text style={styles.settingLabel}>Enable Notifications</Text>
          </View>
          <Switch
            value={isNotificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={isNotificationsEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={[styles.settingRow, !isNotificationsEnabled && styles.disabled]}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="location-outline" size={24} color="#4CAF50" />
            <Text style={styles.settingLabel}>Notification Radius</Text>
          </View>
          <Text style={styles.settingValue}>
            {notificationRadius.toFixed(1)} km ({kmToMiles(notificationRadius)} mi)
          </Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={5}
          step={0.1}
          value={notificationRadius}
          onValueChange={setNotificationRadius}
          minimumTrackTintColor="#4CAF50"
          maximumTrackTintColor="#d3d3d3"
          thumbTintColor="#4CAF50"
          disabled={!isNotificationsEnabled}
        />

        <View style={[styles.settingRow, !isNotificationsEnabled && styles.disabled]}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="time-outline" size={24} color="#4CAF50" />
            <Text style={styles.settingLabel}>Time Frame</Text>
          </View>
          <Text style={styles.settingValue}>
            {notificationTimeFrame} {notificationTimeFrame === 1 ? 'hour' : 'hours'}
          </Text>
        </View>

        <View style={styles.timeFrameButtons}>
          {[1, 6, 12, 24, 48, 72].map((hours) => (
            <TouchableOpacity
              key={hours}
              style={[
                styles.timeFrameButton,
                notificationTimeFrame === hours && styles.selectedTimeFrame,
                !isNotificationsEnabled && styles.disabledButton,
              ]}
              onPress={() => setNotificationTimeFrame(hours)}
              disabled={!isNotificationsEnabled}
            >
              <Text
                style={[
                  styles.timeFrameButtonText,
                  notificationTimeFrame === hours && styles.selectedTimeFrameText,
                ]}
              >
                {hours} {hours === 1 ? 'hr' : 'hrs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location & Search</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="search-outline" size={24} color="#4CAF50" />
            <Text style={styles.settingLabel}>Search Radius</Text>
          </View>
          <Text style={styles.settingValue}>
            {searchRadius.toFixed(0)} km ({kmToMiles(searchRadius)} mi)
          </Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={5}
          maximumValue={200}
          step={5}
          value={searchRadius}
          onValueChange={setSearchRadius}
          minimumTrackTintColor="#4CAF50"
          maximumTrackTintColor="#d3d3d3"
          thumbTintColor="#4CAF50"
        />

        <Text style={styles.helperText}>
          Only animals within this radius from your location will be shown on the map.
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="navigate-outline" size={24} color="#4CAF50" />
            <Text style={styles.settingLabel}>Background Location Tracking</Text>
          </View>
          <Switch
            value={isBackgroundTrackingEnabled}
            onValueChange={handleToggleBackgroundTracking}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={isBackgroundTrackingEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>

        {/* {isBackgroundTrackingEnabled && (
          <Text style={styles.warningText}>
            Background location tracking will use more battery but will allow you to
            receive notifications even when the app is closed.
          </Text>
        )} */}
      </View>

      {/* Support the App Section */}
      <View style={styles.section}>
        <View style={styles.donationHeader}>
          <Text style={styles.sectionTitle}>Support the App</Text>
          {isSupporter && (
            <View style={styles.supporterBadge}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.supporterBadgeText}>Supporter</Text>
            </View>
          )}
        </View>

        <Text style={styles.donationDescription}>
          Your support keeps StraySync free and helps us save more animals!
        </Text>

        {donationTiers.map((tier) => (
          <TouchableOpacity
            key={tier.id}
            style={[
              styles.donationCard,
              { borderColor: tier.color },
              tier.popular && styles.popularCard,
            ]}
            onPress={() => handleDonation(tier.id, tier.productId)}
            disabled={purchaseLoading !== null}
            activeOpacity={0.7}
          >
            {tier.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
              </View>
            )}

            <View style={styles.donationCardHeader}>
              <View style={styles.donationIconContainer}>
                <Text style={styles.donationIcon}>{tier.icon}</Text>
              </View>
              <View style={styles.donationInfo}>
                <Text style={styles.donationName}>{tier.name}</Text>
                <Text style={[styles.donationPrice, { color: tier.color }]}>
                  {tier.price}
                </Text>
              </View>
              {purchaseLoading === tier.id ? (
                <ActivityIndicator size="small" color={tier.color} />
              ) : (
                <Ionicons name="chevron-forward" size={24} color={tier.color} />
              )}
            </View>

            <View style={styles.benefitsList}>
              {tier.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color={tier.color} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.donationFooter}>
          One-time donation • All proceeds support development and animal welfare
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.aboutContainer}>
          <Text style={styles.appName}>StraySync</Text>
          <Text style={styles.appVersion}>Version 1.1.0</Text>
          <Text style={styles.appDescription}>
            Help locate and track stray animals in your area. Take photos, mark
            locations, and get notifications when you're near a stray animal.
          </Text>

          <TouchableOpacity
            style={[styles.aboutButton, { backgroundColor: '#2E7D32' }]}
            onPress={handleSupportPress}
          >
            <Ionicons name="heart" size={20} color="white" />
            <Text style={styles.aboutButtonText}>Support Stray Animals</Text>
          </TouchableOpacity>

          {/* <TouchableOpacity 
            style={[styles.aboutButton, { backgroundColor: '#388E3C' }]} 
            onPress={handleContactPress}
          >
            <Ionicons name="globe" size={20} color="white" />
            <Text style={styles.aboutButtonText}>Visit Website</Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    margin: 15,
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
  },
  settingValue: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 10,
  },
  timeFrameButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  timeFrameButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 10,
    width: '30%',
    alignItems: 'center',
  },
  selectedTimeFrame: {
    backgroundColor: '#4CAF50',
  },
  timeFrameButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  selectedTimeFrameText: {
    color: 'white',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  warningText: {
    fontSize: 14,
    color: '#FF5722',
    marginTop: 5,
    fontStyle: 'italic',
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginTop: -5,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  aboutContainer: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  appVersion: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  appDescription: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  aboutButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 10,
    width: '80%',
  },
  aboutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  cleanupButtonText: {
    color: '#FF5722',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  donationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  supporterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  supporterBadgeText: {
    color: '#F57F17',
    fontSize: 12,
    fontWeight: '600',
  },
  donationDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  donationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  popularCard: {
    borderWidth: 3,
    backgroundColor: '#F1F8F4',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  donationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  donationIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  donationIcon: {
    fontSize: 28,
  },
  donationInfo: {
    flex: 1,
  },
  donationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  donationPrice: {
    fontSize: 20,
    fontWeight: '700',
  },
  benefitsList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  donationFooter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default SettingsScreen; 
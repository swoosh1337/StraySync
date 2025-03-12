import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSettings } from '../contexts/SettingsContext';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type SettingsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const {
    notificationRadius,
    setNotificationRadius,
    notificationTimeFrame,
    setNotificationTimeFrame,
    isNotificationsEnabled,
    setIsNotificationsEnabled,
    isBackgroundTrackingEnabled,
    setIsBackgroundTrackingEnabled,
  } = useSettings();

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
      'Support Stray Animalsr',
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
        <Text style={styles.sectionTitle}>Location</Text>
        
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
        
        {isBackgroundTrackingEnabled && (
          <Text style={styles.warningText}>
            Background location tracking will use more battery but will allow you to
            receive notifications even when the app is closed.
          </Text>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <View style={styles.aboutContainer}>
          <Text style={styles.appName}>StraySync</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
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
          
          <TouchableOpacity 
            style={[styles.aboutButton, { backgroundColor: '#388E3C' }]} 
            onPress={handleContactPress}
          >
            <Ionicons name="globe" size={20} color="white" />
            <Text style={styles.aboutButtonText}>Visit Website</Text>
          </TouchableOpacity>
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
});

export default SettingsScreen; 
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MapScreen from '../screens/MapScreen';
import AddCatScreen from '../screens/AddCatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CatDetailsScreen from '../screens/CatDetailsScreen';
import AnimalsListScreen from '../screens/AnimalsListScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

// types for navigation parameters
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  CatDetails: { catId: string };
  AddCat: { latitude?: number; longitude?: number } | undefined;
};

export type MainTabParamList = {
  Map: { forceRefresh?: () => void } | undefined;
  Animals: undefined;
  Settings: undefined;
};

// Theme colors
const THEME = {
  primary: '#D0F0C0',
  secondary: '#2E7D32',
  accent: '#388E3C',
  inactive: '#90A4AE',
};

// Current onboarding version - increment this when making significant changes to the app
// that would require users to see the onboarding again
const ONBOARDING_VERSION = '1.0';

// create the navigators
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// main tab navigator
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = 'map';
          
          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Animals') {
            iconName = focused ? 'paw' : 'paw-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: THEME.secondary,
        tabBarInactiveTintColor: THEME.inactive,
        tabBarStyle: {
          backgroundColor: THEME.primary,
        },
        headerStyle: {
          backgroundColor: THEME.primary,
        },
        headerTintColor: THEME.secondary,
      })}
    >
      <Tab.Screen 
        name="Map" 
        component={MapScreen} 
        options={{
          title: "Map",
        }}
      />
      <Tab.Screen 
        name="Animals" 
        component={AnimalsListScreen}
        options={{
          title: "Animals",
        }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

// root stack navigator
const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    // Check if onboarding has been completed for the current version
    const checkOnboarding = async () => {
      try {
        const completedVersion = await AsyncStorage.getItem('onboardingCompletedVersion');
        // Show onboarding if it's never been completed or if the completed version is older
        setOnboardingCompleted(completedVersion === ONBOARDING_VERSION);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Default to not showing onboarding if there's an error
        setOnboardingCompleted(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#D0F0C0' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={onboardingCompleted ? 'Main' : 'Onboarding'}>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CatDetails"
        component={CatDetailsScreen}
        options={{ 
          title: "Animal Details",
          headerStyle: {
            backgroundColor: THEME.primary,
          },
          headerTintColor: THEME.secondary,
        }}
      />
      <Stack.Screen
        name="AddCat"
        component={AddCatScreen}
        options={{ 
          title: "Add Animal",
          headerStyle: {
            backgroundColor: THEME.primary,
          },
          headerTintColor: THEME.secondary,
        }}
      />
    </Stack.Navigator>
  );
};

// main app container
const Navigation = () => {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
};

export default Navigation; 
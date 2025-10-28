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
import SignInScreen from '../screens/SignInScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditAnimalScreen from '../screens/EditAnimalScreen';
import PetALogScreen from '../screens/PetALogScreen';
import LostAnimalsScreen from '../screens/LostAnimalsScreen';
import CreateLostAnimalScreen from '../screens/CreateLostAnimalScreen';
import LostAnimalDetailsScreen from '../screens/LostAnimalDetailsScreen';
import { useAuth } from '../contexts/AuthContext';

// types for navigation parameters
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  SignIn: undefined;
  CatDetails: { catId: string };
  AddCat: { latitude?: number; longitude?: number } | undefined;
  EditAnimal: { animalId: string };
  LostAnimals: undefined;
  CreateLostAnimal: undefined;
  LostAnimalDetails: { lostAnimalId: string };
};

export type MainTabParamList = {
  Map: { forceRefresh?: () => void } | undefined;
  Animals: undefined;
  PetALog: undefined;
  Profile: undefined;
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
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = 'map';

          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Animals') {
            iconName = focused ? 'paw' : 'paw-outline';
          } else if (route.name === 'PetALog') {
            iconName = focused ? 'albums' : 'albums-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
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
      <Tab.Screen
        name="PetALog"
        component={PetALogScreen}
        options={{
          title: "Pet-a-log",
        }}
      />
      {user && (
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: "Profile",
          }}
        />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

// root stack navigator
const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // Check if onboarding has been completed for the current version
    const checkOnboarding = async () => {
      try {
        const completedVersion = await AsyncStorage.getItem('onboardingCompletedVersion');
        // Show onboarding if it's never been completed or if the completed version is older
        const completed = completedVersion === ONBOARDING_VERSION;
        setOnboardingCompleted(completed);
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

  // Determine which screen to show
  const getInitialRoute = (): keyof RootStackParamList => {
    if (!onboardingCompleted) {
      return 'Onboarding';
    }
    if (!user) {
      return 'SignIn';
    }
    return 'Main';
  };

  if (isLoading || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#D0F0C0' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  // Conditionally render screens based on auth state
  if (!onboardingCompleted) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SignIn" component={SignInScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen
        name="CatDetails"
        component={CatDetailsScreen}
        options={{
          headerShown: true,
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
          headerShown: true,
          title: "Add Animal",
          headerStyle: {
            backgroundColor: THEME.primary,
          },
          headerTintColor: THEME.secondary,
        }}
      />
      <Stack.Screen
        name="EditAnimal"
        component={EditAnimalScreen}
        options={{
          headerShown: true,
          title: "Edit Animal",
          headerStyle: {
            backgroundColor: THEME.primary,
          },
          headerTintColor: THEME.secondary,
        }}
      />
      <Stack.Screen
        name="LostAnimals"
        component={LostAnimalsScreen}
        options={{
          headerShown: true,
          title: "Lost & Found",
          headerStyle: {
            backgroundColor: THEME.primary,
          },
          headerTintColor: THEME.secondary,
        }}
      />
      <Stack.Screen
        name="CreateLostAnimal"
        component={CreateLostAnimalScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="LostAnimalDetails"
        component={LostAnimalDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

// main app container
const Navigation = ({ navigationRef }: { navigationRef?: any }) => {
  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  );
};

export default Navigation; 
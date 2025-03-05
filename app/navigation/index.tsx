import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

import MapScreen from '../screens/MapScreen';
import AddCatScreen from '../screens/AddCatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CatDetailsScreen from '../screens/CatDetailsScreen';
import AnimalsListScreen from '../screens/AnimalsListScreen';

// types for navigation parameters
export type RootStackParamList = {
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
  return (
    <Stack.Navigator>
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
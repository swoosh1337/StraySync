import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Import screens (we'll create these next)
import MapScreen from '../screens/MapScreen';
import AddCatScreen from '../screens/AddCatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CatDetailsScreen from '../screens/CatDetailsScreen';

// Define the types for our navigation parameters
export type RootStackParamList = {
  Main: undefined;
  CatDetails: { catId: string };
  AddCat: { latitude?: number; longitude?: number } | undefined;
};

export type MainTabParamList = {
  Map: undefined;
  Settings: undefined;
};

// Create the navigators
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main tab navigator
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'map';
          
          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen 
        name="Map" 
        component={MapScreen} 
        options={{ title: 'Stray Cat Finder' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

// Root stack navigator
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Main"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CatDetails"
          component={CatDetailsScreen}
          options={{ title: 'Cat Details' }}
        />
        <Stack.Screen
          name="AddCat"
          component={AddCatScreen}
          options={{ title: 'Add Cat Sighting' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 
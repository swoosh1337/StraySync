import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';

const { width, height } = Dimensions.get('window');

// Current onboarding version - must match the version in navigation/index.tsx
const ONBOARDING_VERSION = '1.0';

// Define slide type
type Slide = {
  id: string;
  title: string;
  description: string;
  icon: 'paw' | 'map-marker' | 'camera' | 'bell';
};

// Onboarding data
const slides: Slide[] = [
  {
    id: '1',
    title: 'Welcome to StraySync',
    description: 'Help stray animals in your community by reporting sightings and connecting with others.',
    icon: 'paw',
  },
  {
    id: '2',
    title: 'Explore the Map',
    description: 'View all reported animals on the map. Filter between cats and dogs to find specific animals.',
    icon: 'map-marker',
  },
  {
    id: '3',
    title: 'Report Stray Animals',
    description: 'Easily report stray animals by taking a photo and marking their location on the map.',
    icon: 'camera',
  },
  {
    id: '4',
    title: 'Get Notifications',
    description: 'Receive alerts when new animals are reported near you to help them faster.',
    icon: 'bell',
  },
];

// Theme colors
const THEME = {
  primary: '#D0F0C0',
  secondary: '#2E7D32',
  accent: '#388E3C',
  inactive: '#90A4AE',
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#212121',
  lightText: '#757575',
};

type OnboardingScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

const OnboardingScreen: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation<OnboardingScreenNavigationProp>();

  // Function to handle completing the onboarding
  const handleOnboardingComplete = async () => {
    try {
      // Save that onboarding has been completed with the current version
      await AsyncStorage.setItem('onboardingCompletedVersion', ONBOARDING_VERSION);
      // Navigate to Sign In screen (user must authenticate before accessing main app)
      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn' }],
      });
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  // Function to handle skip button press
  const handleSkip = () => {
    handleOnboardingComplete();
  };

  // Function to handle next button press
  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleOnboardingComplete();
    }
  };

  // Render individual slide
  const renderSlide = ({ item, index }: { item: Slide; index: number }) => {
    return (
      <View style={styles.slideContainer}>
        <View style={styles.imageContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name={item.icon} size={80} color={THEME.secondary} />
          </View>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  // Render pagination dots
  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === currentIndex ? styles.paginationDotActive : null,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.primary} />
      
      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>
      
      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / width
          );
          setCurrentIndex(index);
        }}
      />
      
      {/* Pagination */}
      {renderPagination()}
      
      {/* Next/Done button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={currentIndex === slides.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={20}
            color="#FFF"
            style={styles.buttonIcon}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.primary,
  },
  slideContainer: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  imageContainer: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  image: {
    width: width * 0.8,
    height: height * 0.3,
  },
  textContainer: {
    flex: 0.4,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: THEME.secondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: THEME.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.inactive,
    marginHorizontal: 5,
  },
  paginationDotActive: {
    backgroundColor: THEME.secondary,
    width: 20,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  button: {
    backgroundColor: THEME.secondary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 10,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipButtonText: {
    color: THEME.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingScreen; 
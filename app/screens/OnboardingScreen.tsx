import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  FlatList,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { RootStackParamList } from '../types';
import OnboardingSlide from '../components/onboarding/OnboardingSlide';

const { width } = Dimensions.get('window');

// Current onboarding version - must match the version in navigation/index.tsx
const ONBOARDING_VERSION = '2.0';

// Define slide type
type Slide = {
  id: string;
  title: string;
  description: string;
  illustrationType: 'map' | 'stickers' | 'camera' | 'lost-poster' | 'community' | 'welcome';
  mascotPose: 'laying' | 'sitting-down' | 'sitting-up' | 'playing' | 'standing' | 'happy' | 'hunting';
  mascotPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
};

// Onboarding data with new Duolingo-style screens - each with unique mascot!
const slides: Slide[] = [
  {
    id: '1',
    title: 'Welcome to StraySync',
    description: 'Join thousands helping stray animals find safety, care, and loving homes.',
    illustrationType: 'welcome',
    mascotPose: 'happy',
    mascotPosition: 'bottom-right',
  },
  {
    id: '2',
    title: 'Explore Your Area',
    description: 'See stray animals spotted near you on an interactive map. Filter by type, health status, and more.',
    illustrationType: 'map',
    mascotPose: 'hunting',
    mascotPosition: 'bottom-right',
  },
  {
    id: '3',
    title: 'Collect Your Adventures',
    description: 'Build your Pet-a-log! Snap photos of animals you meet and create your personal sticker collection.',
    illustrationType: 'stickers',
    mascotPose: 'playing',
    mascotPosition: 'bottom-left',
  },
  {
    id: '4',
    title: 'Help Strays in Need',
    description: 'Report stray animals with a photo and location. Help your community keep track and provide care.',
    illustrationType: 'camera',
    mascotPose: 'standing',
    mascotPosition: 'bottom-left',
  },
  {
    id: '5',
    title: 'Find Lost Pets',
    description: 'Create and share lost pet posters. Connect with others who may have seen your missing companion.',
    illustrationType: 'lost-poster',
    mascotPose: 'sitting-down',
    mascotPosition: 'bottom-right',
  },
  {
    id: '6',
    title: 'Join the Community',
    description: 'Connect with animal lovers, rescue organizations, and shelters working to help strays.',
    illustrationType: 'community',
    mascotPose: 'sitting-up',
    mascotPosition: 'bottom-left',
  },
  {
    id: '7',
    title: "You're All Set!",
    description: 'Start making a difference in the lives of stray animals in your area today.',
    illustrationType: 'welcome',
    mascotPose: 'laying',
    mascotPosition: 'center',
  },
];

type OnboardingScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

const OnboardingScreen: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const ratingPromptShown = useRef(false);
  const navigation = useNavigation<OnboardingScreenNavigationProp>();

  // Request rating when user reaches the last page
  const requestRatingIfNeeded = async (pageIndex: number) => {
    // Show rating prompt when user reaches the last page (index 6) and hasn't been prompted yet
    if (pageIndex === 6 && !ratingPromptShown.current) {
      ratingPromptShown.current = true;

      try {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (isAvailable) {
          // Small delay to let the page settle
          setTimeout(async () => {
            try {
              await StoreReview.requestReview();
              console.log('[Onboarding] Rating prompt shown');
            } catch (error) {
              console.log('[Onboarding] Rating prompt error:', error);
            }
          }, 800);
        }
      } catch (error) {
        console.log('[Onboarding] Store review not available');
      }
    }
  };

  // Function to handle completing the onboarding
  const handleOnboardingComplete = async () => {
    try {
      // Save that onboarding has been completed with the current version
      await AsyncStorage.setItem('onboardingCompletedVersion', ONBOARDING_VERSION);

      // Track onboarding completion for rating
      import('../services/rating').then(({ ratingService }) => {
        ratingService.incrementActions();
      });

      // The parent RootNavigator will detect the AsyncStorage change
      // and automatically re-render with the correct screen
      console.log('Onboarding completed, app will re-render automatically');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  // Function to handle skip button press
  const handleSkip = () => {
    handleOnboardingComplete();
  };

  // Render individual slide using OnboardingSlide component
  const renderSlide = ({ item, index }: { item: Slide; index: number }) => {
    const isLastSlide = index === slides.length - 1;

    return (
      <OnboardingSlide
        title={item.title}
        description={item.description}
        illustrationType={item.illustrationType}
        mascotPose={item.mascotPose}
        mascotPosition={item.mascotPosition}
        currentIndex={index}
        totalSlides={slides.length}
        onSkip={handleSkip}
        onGetStarted={handleOnboardingComplete}
        showSkip={!isLastSlide}
        showCTA={isLastSlide}
        ctaText="Get Started"
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

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
          requestRatingIfNeeded(index);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});

export default OnboardingScreen; 
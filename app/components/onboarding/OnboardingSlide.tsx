import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import AnimatedMascot from './AnimatedMascot';
import SimplifiedIllustration from './SimplifiedIllustration';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type IllustrationType = 'map' | 'stickers' | 'camera' | 'lost-poster' | 'community' | 'welcome';
type MascotPose = 'laying' | 'sitting-down' | 'sitting-up';
type MascotPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

interface OnboardingSlideProps {
  title: string;
  description: string;
  illustrationType: IllustrationType;
  mascotPose?: MascotPose;
  mascotPosition?: MascotPosition;
  currentIndex: number;
  totalSlides: number;
  onSkip?: () => void;
  onGetStarted?: () => void;
  showSkip?: boolean;
  showCTA?: boolean;
  ctaText?: string;
}

const OnboardingSlide: React.FC<OnboardingSlideProps> = ({
  title,
  description,
  illustrationType,
  mascotPose = 'sitting-up',
  mascotPosition = 'bottom-left',
  currentIndex,
  totalSlides,
  onSkip,
  onGetStarted,
  showSkip = true,
  showCTA = false,
  ctaText = 'Get Started',
}) => {
  // Animation values
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);

  useEffect(() => {
    // Stagger text animations
    titleOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    titleTranslateY.value = withDelay(700, withSpring(0, { damping: 15 }));

    descriptionOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    descriptionTranslateY.value = withDelay(900, withSpring(0, { damping: 15 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const descriptionStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
    transform: [{ translateY: descriptionTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      {showSkip && onSkip && (
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {/* Title */}
        <Animated.Text style={[styles.title, titleStyle]}>
          {title}
        </Animated.Text>

        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <SimplifiedIllustration type={illustrationType} delay={500} />
        </View>

        {/* Description */}
        <Animated.Text style={[styles.description, descriptionStyle]}>
          {description}
        </Animated.Text>

        {/* CTA Button */}
        {showCTA && onGetStarted && (
          <TouchableOpacity style={styles.ctaButton} onPress={onGetStarted}>
            <Text style={styles.ctaText}>{ctaText}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Animated Mascot */}
      {mascotPose && (
        <AnimatedMascot
          pose={mascotPose}
          animation="slideInBottom"
          delay={100}
          size={120}
          position={mascotPosition}
        />
      )}

      {/* Progress Dots */}
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSlides }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === currentIndex && styles.progressDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    backgroundColor: '#F8F9FA',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
  },
  illustrationContainer: {
    width: '100%',
    minHeight: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 32,
  },
  description: {
    fontSize: 18,
    lineHeight: 26,
    color: '#555',
    textAlign: 'center',
    maxWidth: 320,
  },
  ctaButton: {
    marginTop: 40,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BDBDBD',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#4CAF50',
  },
});

export default OnboardingSlide;

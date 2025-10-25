import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, Image } from 'react-native';

interface SplashScreenProps {
  onFinish?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);

  // Handle animation sequence
  useEffect(() => {
    // Start animations
    const fadeIn = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    });
    
    const scale = Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    });
    
    // Run fade in and scale animations in parallel
    Animated.parallel([fadeIn, scale]).start();

    // Set timeout for the splash screen duration
    const timer = setTimeout(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimationComplete(true);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim]);

  // Call onFinish when animation completes
  useEffect(() => {
    if (isAnimationComplete && onFinish) {
      onFinish();
    }
  }, [isAnimationComplete, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* New stray animal icon */}
        <Image 
          source={require('../../assets/stary-icon-removebg-preview.png')} 
          style={styles.catIcon} 
          resizeMode="contain"
        />
        <Text style={styles.title}>Stray Animal Finder</Text>
        <Text style={styles.subtitle}>Help find stray animals in your area</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D0F0C0', // Light mint green background
  },
  logoContainer: {
    alignItems: 'center',
  },
  catIcon: {
    width: 220,
    height: 220,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32', // Darker green for the title
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#388E3C', // Medium green for the subtitle
    textAlign: 'center',
  },
});

export default SplashScreen; 
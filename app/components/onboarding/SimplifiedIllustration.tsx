import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';

type IllustrationType = 'map' | 'stickers' | 'camera' | 'lost-poster' | 'community' | 'welcome';

interface SimplifiedIllustrationProps {
  type: IllustrationType;
  delay?: number;
}

const SimplifiedIllustration: React.FC<SimplifiedIllustrationProps> = ({
  type,
  delay = 500,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 15 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 15 }));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const renderIllustration = () => {
    switch (type) {
      case 'map':
        return <MapIllustration delay={delay} />;
      case 'stickers':
        return <StickersIllustration delay={delay} />;
      case 'camera':
        return <CameraIllustration delay={delay} />;
      case 'lost-poster':
        return <LostPosterIllustration delay={delay} />;
      case 'community':
        return <CommunityIllustration delay={delay} />;
      case 'welcome':
        return <WelcomeIllustration delay={delay} />;
      default:
        return null;
    }
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {renderIllustration()}
    </Animated.View>
  );
};

// Map Illustration
const MapIllustration: React.FC<{ delay: number }> = ({ delay }) => {
  return (
    <View style={styles.mapContainer}>
      <View style={styles.mapBackground}>
        {/* Animated map markers */}
        <AnimatedMarker delay={delay + 600} top={30} left={40} color="#FF5722" />
        <AnimatedMarker delay={delay + 700} top={60} left={140} color="#4CAF50" />
        <AnimatedMarker delay={delay + 800} top={100} left={80} color="#2196F3" />
        <AnimatedMarker delay={delay + 900} top={80} left={200} color="#FFC107" />
      </View>
    </View>
  );
};

const AnimatedMarker: React.FC<{ delay: number; top: number; left: number; color: string }> = ({
  delay,
  top,
  left,
  color,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSequence(withSpring(1.3, { damping: 10 }), withSpring(1, { damping: 15 }))
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.marker, { top, left, backgroundColor: color }, animatedStyle]}>
      <Ionicons name="paw" size={16} color="#fff" />
    </Animated.View>
  );
};

// Stickers Illustration
const StickersIllustration: React.FC<{ delay: number }> = ({ delay }) => {
  return (
    <View style={styles.stickersContainer}>
      <AnimatedSticker delay={delay + 600} rotation={-10} left={20} />
      <AnimatedSticker delay={delay + 700} rotation={5} left={120} />
      <AnimatedSticker delay={delay + 800} rotation={-5} left={220} />
    </View>
  );
};

const AnimatedSticker: React.FC<{ delay: number; rotation: number; left: number }> = ({
  delay,
  rotation,
  left,
}) => {
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(delay, withSpring(0, { damping: 15 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotation}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.stickerFrame, { left }, animatedStyle]}>
      <Ionicons name="image" size={32} color="#4CAF50" />
    </Animated.View>
  );
};

// Camera Illustration
const CameraIllustration: React.FC<{ delay: number }> = ({ delay }) => {
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(delay + 600, withSpring(0, { damping: 15 }));
    opacity.value = withDelay(delay + 600, withTiming(1, { duration: 300 }));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.cameraContainer}>
      <Animated.View style={[styles.iconCircle, { backgroundColor: '#4CAF50' }, animatedStyle]}>
        <Ionicons name="camera" size={48} color="#fff" />
      </Animated.View>
      <View style={[styles.iconCircle, { backgroundColor: '#2196F3', marginTop: 20 }]}>
        <Ionicons name="location" size={48} color="#fff" />
      </View>
    </View>
  );
};

// Lost Poster Illustration
const LostPosterIllustration: React.FC<{ delay: number }> = ({ delay }) => {
  const translateX = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(delay + 600, withSpring(0, { damping: 15 }));
    opacity.value = withDelay(delay + 600, withTiming(1, { duration: 300 }));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.posterContainer, animatedStyle]}>
      <View style={styles.posterHeader}>
        <Ionicons name="alert-circle" size={32} color="#FF5722" />
      </View>
      <View style={styles.posterImage}>
        <Ionicons name="image" size={48} color="#BDBDBD" />
      </View>
      <View style={styles.posterLines}>
        <View style={[styles.posterLine, { width: '80%' }]} />
        <View style={[styles.posterLine, { width: '60%' }]} />
        <View style={[styles.posterLine, { width: '70%' }]} />
      </View>
    </Animated.View>
  );
};

// Community Illustration
const CommunityIllustration: React.FC<{ delay: number }> = ({ delay }) => {
  return (
    <View style={styles.communityContainer}>
      <FloatingHeart delay={delay + 600} left={50} top={20} />
      <FloatingHeart delay={delay + 700} left={150} top={60} />
      <FloatingHeart delay={delay + 800} left={250} top={30} />

      <View style={styles.avatarsRow}>
        <View style={[styles.avatar, { backgroundColor: '#FF5722' }]}>
          <Ionicons name="person" size={24} color="#fff" />
        </View>
        <View style={[styles.avatar, { backgroundColor: '#4CAF50' }]}>
          <Ionicons name="person" size={24} color="#fff" />
        </View>
        <View style={[styles.avatar, { backgroundColor: '#2196F3' }]}>
          <Ionicons name="person" size={24} color="#fff" />
        </View>
      </View>
    </View>
  );
};

const FloatingHeart: React.FC<{ delay: number; left: number; top: number }> = ({
  delay,
  left,
  top,
}) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-15, { duration: 1500 }),
          withTiming(0, { duration: 1500 })
        ),
        -1,
        true
      )
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.heart, { left, top }, animatedStyle]}>
      <Ionicons name="heart" size={24} color="#FF5722" />
    </Animated.View>
  );
};

// Welcome Illustration
const WelcomeIllustration: React.FC<{ delay: number }> = ({ delay }) => {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay + 600,
      withSequence(withSpring(1.2, { damping: 10 }), withSpring(1, { damping: 15 }))
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.welcomeContainer, animatedStyle]}>
      <Ionicons name="paw" size={80} color="#4CAF50" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  mapContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBackground: {
    width: 300,
    height: 150,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  marker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  stickersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
  },
  stickerFrame: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  posterContainer: {
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 3,
    borderColor: '#FF5722',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  posterHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  posterImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  posterLines: {
    alignItems: 'center',
    gap: 8,
  },
  posterLine: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  communityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
    position: 'relative',
  },
  avatarsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  heart: {
    position: 'absolute',
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 150,
    backgroundColor: '#E8F5E9',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
});

export default SimplifiedIllustration;

import React, { useEffect } from 'react';
import { StyleSheet, Image, ImageSourcePropType } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

type MascotPose = 'laying' | 'sitting-down' | 'sitting-up' | 'playing' | 'standing' | 'happy' | 'hunting';
type AnimationType = 'slideInBottom' | 'slideInSide' | 'bounce' | 'breathe';

interface AnimatedMascotProps {
  pose: MascotPose;
  animation?: AnimationType;
  delay?: number;
  size?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

// Import mascot images
const MASCOT_IMAGES = {
  laying: require('../../../assets/cat_laying.png'),
  'sitting-down': require('../../../assets/cat_sitting_looking_down.png'),
  'sitting-up': require('../../../assets/catt_sitting_looking_up.png'),
  playing: require('../../../assets/cat_playing.png'),
  standing: require('../../../assets/cat_standing.png'),
  happy: require('../../../assets/cat_happy.png'),
  hunting: require('../../../assets/cat_hunting_mode.png'),
};

const AnimatedMascot: React.FC<AnimatedMascotProps> = ({
  pose,
  animation = 'slideInBottom',
  delay = 0,
  size = 150,
  position = 'bottom-left',
}) => {
  const translateY = useSharedValue(100);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    // Reset values
    translateY.value = 100;
    translateX.value = position.includes('right') ? 100 : -100;
    opacity.value = 0;
    scale.value = 0.8;

    // Animate based on type
    if (animation === 'slideInBottom') {
      translateY.value = withDelay(
        delay,
        withSpring(0, {
          damping: 15,
          stiffness: 100,
        })
      );
      translateX.value = 0;
      opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
      scale.value = withDelay(
        delay,
        withSequence(
          withSpring(1.1, { damping: 10 }),
          withSpring(1, { damping: 15 })
        )
      );
    } else if (animation === 'slideInSide') {
      translateX.value = withDelay(
        delay,
        withSpring(0, {
          damping: 15,
          stiffness: 100,
        })
      );
      translateY.value = 0;
      opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
      scale.value = withDelay(delay, withSpring(1, { damping: 15 }));
    } else if (animation === 'bounce') {
      translateY.value = withDelay(
        delay,
        withSequence(
          withSpring(-20, { damping: 8 }),
          withSpring(0, { damping: 12 })
        )
      );
      translateX.value = 0;
      opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
      scale.value = withDelay(delay, withSpring(1, { damping: 15 }));
    } else if (animation === 'breathe') {
      translateY.value = 0;
      translateX.value = 0;
      opacity.value = withTiming(1, { duration: 300 });

      // Subtle breathing animation loop
      scale.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(
            500,
            withSequence(
              withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
              withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            )
          )
        )
      );
    }
  }, [animation, delay, position]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  // Get position styles
  const getPositionStyle = () => {
    switch (position) {
      case 'top-left':
        return { top: 20, left: 20 };
      case 'top-right':
        return { top: 20, right: 20 };
      case 'bottom-left':
        return { bottom: 40, left: 20 };
      case 'bottom-right':
        return { bottom: 40, right: 20 };
      case 'center':
        return {
          top: '50%',
          left: '50%',
          marginLeft: -size / 2,
          marginTop: -size / 2,
        };
      default:
        return { bottom: 40, left: 20 };
    }
  };

  return (
    <Animated.View
      style={[
        styles.mascotContainer,
        getPositionStyle(),
        animatedStyle,
      ]}
    >
      <Image
        source={MASCOT_IMAGES[pose]}
        style={[styles.mascotImage, { width: size, height: size }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  mascotContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  mascotImage: {
    width: 150,
    height: 150,
  },
});

export default AnimatedMascot;

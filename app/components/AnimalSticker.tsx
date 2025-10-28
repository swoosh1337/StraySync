import React from 'react';
import { StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { AnimalSticker as AnimalStickerType } from '../types/petalog';

type AnimalStickerProps = {
  sticker: AnimalStickerType;
  onUpdate: (updates: Partial<AnimalStickerType>) => void;
  onTap?: () => void;
};

const AnimalSticker: React.FC<AnimalStickerProps> = ({
  sticker,
  onUpdate,
  onTap,
}) => {
  // Animated values for gesture handling
  const translateX = useSharedValue(sticker.position.x);
  const translateY = useSharedValue(sticker.position.y);
  const scale = useSharedValue(sticker.scale);
  const rotation = useSharedValue(sticker.rotation);

  // Context values for gestures
  const savedTranslateX = useSharedValue(sticker.position.x);
  const savedTranslateY = useSharedValue(sticker.position.y);
  const savedScale = useSharedValue(sticker.scale);
  const savedRotation = useSharedValue(sticker.rotation);

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      // Save final position - use runOnJS to call the callback
      runOnJS(onUpdate)({
        position: {
          x: translateX.value,
          y: translateY.value,
        },
      });
    });

  // Pinch gesture for scaling
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * event.scale, 3));
    })
    .onEnd(() => {
      // Save final scale - use runOnJS to call the callback
      runOnJS(onUpdate)({
        scale: scale.value,
      });
    });

  // Rotation gesture
  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      savedRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = savedRotation.value + (event.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      // Normalize rotation to 0-360
      const normalizedRotation = ((rotation.value % 360) + 360) % 360;
      rotation.value = normalizedRotation;
      // Use runOnJS to call the callback
      runOnJS(onUpdate)({
        rotation: normalizedRotation,
      });
    });

  // Tap gesture for opening edit modal
  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (onTap) {
        // Use runOnJS to call the callback
        runOnJS(onTap)();
      }
    });

  // Combine all gestures
  const composedGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotationGesture,
    tapGesture
  );

  // Animated style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotateZ: `${rotation.value}deg` },
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.stickerContainer, animatedStyle]}>
        <Image
          source={{ uri: sticker.imageUri }}
          style={styles.stickerImage}
          resizeMode="contain"
        />
        {sticker.name && (
          <Animated.Text style={styles.stickerName}>
            {sticker.name}
          </Animated.Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  stickerContainer: {
    position: 'absolute',
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  stickerName: {
    position: 'absolute',
    bottom: -20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default AnimalSticker;

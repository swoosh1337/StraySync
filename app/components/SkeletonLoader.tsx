import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

interface AnimalCardSkeletonProps {
  style?: any;
}

export const AnimalCardSkeleton: React.FC<AnimalCardSkeletonProps> = ({ style }) => {
  return (
    <View style={[styles.cardContainer, style]}>
      <SkeletonLoader width={140} height={140} borderRadius={12} style={styles.imageSkeleton} />
      <View style={styles.contentSkeleton}>
        <SkeletonLoader width="60%" height={16} style={styles.titleSkeleton} />
        <SkeletonLoader width="80%" height={14} style={styles.subtitleSkeleton} />
        <SkeletonLoader width="40%" height={12} style={styles.dateSkeleton} />
      </View>
    </View>
  );
};

interface ProfileSkeletonProps {
  style?: any;
}

export const ProfileSkeleton: React.FC<ProfileSkeletonProps> = ({ style }) => {
  return (
    <View style={[styles.profileContainer, style]}>
      <SkeletonLoader width={100} height={100} borderRadius={50} style={styles.avatarSkeleton} />
      <SkeletonLoader width="60%" height={20} style={styles.nameSkeleton} />
      <SkeletonLoader width="80%" height={16} style={styles.emailSkeleton} />
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <SkeletonLoader width={60} height={24} />
          <SkeletonLoader width={80} height={14} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.statItem}>
          <SkeletonLoader width={60} height={24} />
          <SkeletonLoader width={80} height={14} style={{ marginTop: 4 }} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E0E0E0',
  },
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  imageSkeleton: {
    marginRight: 12,
  },
  contentSkeleton: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSkeleton: {
    marginBottom: 8,
  },
  subtitleSkeleton: {
    marginBottom: 8,
  },
  dateSkeleton: {
    marginTop: 'auto',
  },
  profileContainer: {
    alignItems: 'center',
    padding: 20,
  },
  avatarSkeleton: {
    marginBottom: 16,
  },
  nameSkeleton: {
    marginBottom: 8,
  },
  emailSkeleton: {
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
  },
});

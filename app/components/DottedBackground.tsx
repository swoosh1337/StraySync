import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface DottedBackgroundProps {
  dotSize?: number;
  dotSpacing?: number;
  dotColor?: string;
  backgroundColor?: string;
}

const DottedBackground: React.FC<DottedBackgroundProps> = ({
  dotSize = 1.5,
  dotSpacing = 20,
  dotColor = '#E0E0E0',
  backgroundColor = '#FFFFFF',
}) => {
  // Calculate number of dots needed based on screen size
  // We'll use a large canvas to ensure coverage
  const canvasWidth = 1000;
  const canvasHeight = 2000;

  const dots: JSX.Element[] = [];
  let id = 0;

  // Generate dots in a grid pattern
  for (let y = 0; y < canvasHeight; y += dotSpacing) {
    for (let x = 0; x < canvasWidth; x += dotSpacing) {
      dots.push(
        <Circle
          key={`dot-${id++}`}
          cx={x}
          cy={y}
          r={dotSize}
          fill={dotColor}
          opacity={0.4}
        />
      );
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        {dots}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default DottedBackground;

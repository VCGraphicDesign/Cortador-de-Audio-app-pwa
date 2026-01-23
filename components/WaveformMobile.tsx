
import React from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Rect, Line, G, Path } from 'react-native-svg';

interface WaveformMobileProps {
  duration: number;
  region: { start: number; end: number };
  currentTime: number;
  onRegionChange: (region: { start: number; end: number }) => void;
  onSeek: (time: number) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVEFORM_WIDTH = SCREEN_WIDTH - 70; // Margen del contenedor
const WAVEFORM_HEIGHT = 100;

const WaveformMobile: React.FC<WaveformMobileProps> = ({ 
  duration, 
  region, 
  currentTime, 
  onRegionChange, 
  onSeek 
}) => {
  
  const timeToX = (time: number) => (time / duration) * WAVEFORM_WIDTH;
  const xToTime = (x: number) => (x / WAVEFORM_WIDTH) * duration;

  const startX = timeToX(region.start);
  const endX = timeToX(region.end);
  const currentX = timeToX(currentTime);

  const createPanResponder = (type: 'start' | 'end' | 'seek') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const touchX = gestureState.moveX - 35; // Compensar padding
      const newTime = Math.max(0, Math.min(xToTime(touchX), duration));

      if (type === 'start') {
        if (newTime < region.end - 0.5) {
          onRegionChange({ ...region, start: newTime });
        }
      } else if (type === 'end') {
        if (newTime > region.start + 0.5) {
          onRegionChange({ ...region, end: newTime });
        }
      } else {
        onSeek(newTime);
      }
    },
  });

  const startPan = createPanResponder('start').panHandlers;
  const endPan = createPanResponder('end').panHandlers;
  const seekPan = createPanResponder('seek').panHandlers;

  return (
    <View style={styles.container}>
      <Svg width={WAVEFORM_WIDTH} height={WAVEFORM_HEIGHT}>
        {/* Fondo de la onda */}
        <Rect x="0" y="45" width={WAVEFORM_WIDTH} height="10" fill="#334155" rx="5" />
        
        {/* Zona Seleccionada */}
        <Rect 
          x={startX} 
          y="0" 
          width={endX - startX} 
          height={WAVEFORM_HEIGHT} 
          fill="rgba(56, 189, 248, 0.1)" 
        />
        
        {/* Línea de reproducción */}
        <Line x1={currentX} y1="0" x2={currentX} y2={WAVEFORM_HEIGHT} stroke="#fbbf24" strokeWidth="2" />

        {/* Manejador de Inicio */}
        <G translate={`${startX}, 0`} {...startPan}>
            <Rect x="-10" y="0" width="20" height={WAVEFORM_HEIGHT} fill="transparent" />
            <Rect x="-2" y="0" width="4" height={WAVEFORM_HEIGHT} fill="white" />
            <Path d="M 0 0 L 12 0 L 0 15 Z" fill="white" />
        </G>

        {/* Manejador de Fin */}
        <G translate={`${endX}, 0`} {...endPan}>
            <Rect x="-10" y="0" width="20" height={WAVEFORM_HEIGHT} fill="transparent" />
            <Rect x="-2" y="0" width="4" height={WAVEFORM_HEIGHT} fill="white" />
            <Path d="M 0 0 L -12 0 L 0 15 Z" fill="white" />
        </G>

        {/* Area Invisible para Seek */}
        <Rect 
            x="0" y="20" 
            width={WAVEFORM_WIDTH} height="60" 
            fill="transparent" 
            {...seekPan}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: WAVEFORM_HEIGHT,
    width: WAVEFORM_WIDTH,
    alignSelf: 'center',
    overflow: 'visible',
  },
});

export default WaveformMobile;
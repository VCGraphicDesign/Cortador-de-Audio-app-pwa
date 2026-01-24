import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Play, Pause, Download, RotateCcw } from 'lucide-react-native';
import WaveformMobile from './WaveformMobile';
import { audioBufferToWav, audioBufferToMp3 } from '../utils/audioUtils';

interface AudioTrimmerProps {
  audioData: {
    uri: string;
    name: string;
    duration: number;
  };
  onReset: () => void;
}

const AudioTrimmer: React.FC<AudioTrimmerProps> = ({ audioData, onReset }) => {
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [isPlaying, setIsPlaying] = useState(false);
  const [region, setRegion] = useState({ start: 0, end: audioData.duration });
  const [currentTime, setCurrentTime] = useState(0);
  const [fadeInDuration, setFadeInDuration] = useState<number>(0);
  const [fadeOutDuration, setFadeOutDuration] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('mp3');
  const [processing, setProcessing] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadSound();
    return () => {
      unloadSound();
    };
  }, []);

  const loadSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioData.uri },
        { shouldPlay: false }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentTime(status.positionMillis / 1000);
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const unloadSound = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
  };

  const togglePlayback = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      if (currentTime >= region.end || currentTime < region.start) {
        await soundRef.current.setPositionAsync(region.start * 1000);
      }
      await soundRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = async (time: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(time * 1000);
      setCurrentTime(time);
    }
  };

  const shareFile = async (uri: string) => {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
          await Sharing.shareAsync(uri);
      } else {
          Alert.alert('Error', 'No se puede compartir en este dispositivo');
      }
  };

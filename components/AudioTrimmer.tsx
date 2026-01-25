import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Download, Pause, Play, RotateCcw } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import WaveformMobile from './WaveformMobile';

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
  const [exportFormat, setExportFormat] = useState<'wav'>('wav');
  const [processing, setProcessing] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadSound();
    return () => { unloadSound(); };
  }, []);

  const loadSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioData.uri }, { shouldPlay: false });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentTime(status.positionMillis / 1000);
          if (status.didJustFinish) setIsPlaying(false);
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const unloadSound = async () => {
    if (soundRef.current) await soundRef.current.unloadAsync();
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

  const saveToGallery = async (fileUri: string, filename: string) => {
    try {
      if (!permissionResponse?.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          Alert.alert('Permisos necesarios', 'Se necesitan permisos para guardar archivos de audio.');
          return;
        }
      }

      const asset = await MediaLibrary.createAssetAsync(fileUri);

      try {
        const album = await MediaLibrary.getAlbumAsync('Audio Recortado');
        if (album === null) {
          await MediaLibrary.createAlbumAsync('Audio Recortado', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch (albumError) {
        console.warn('No se pudo crear album, pero el archivo se guardo', albumError);
      }

      Alert.alert('Exito', 'Audio guardado: ' + filename, [
        { text: 'Compartir', onPress: () => shareFile(fileUri) },
        { text: 'OK' }
      ]);

    } catch (error) {
      console.error('Error guardando:', error);
      Alert.alert('Error', 'No se pudo guardar el archivo');
    }
  };

  const downloadProcessedAudio = async () => {
    try {
      setProcessing(true);

      const nameParts = audioData.name.split('.');
      if (nameParts.length > 1) nameParts.pop();
      const baseName = nameParts.join('.');
      const fileName = baseName + '_cut.' + exportFormat;
      const downloadPath = ((FileSystem as any).cacheDirectory || '') + fileName;

      // Importar dinámicamente el procesador
      const { processAudio } = await import('../utils/audioProcessor');

      // Procesar el audio con recorte y fades
      await processAudio({
        inputUri: audioData.uri,
        outputUri: downloadPath,
        startTime: region.start,
        endTime: region.end,
        fadeInDuration: fadeInDuration,
        fadeOutDuration: fadeOutDuration,
        format: exportFormat
      });

      await saveToGallery(downloadPath, fileName);

    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'No se pudo procesar el archivo: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m + ':' + s.toString().padStart(2, '0');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.fileName} numberOfLines={1}>{audioData.name}</Text>
        <WaveformMobile duration={audioData.duration} region={region} currentTime={currentTime} onRegionChange={setRegion} onSeek={handleSeek} />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(region.start)}</Text>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(region.end)}</Text>
        </View>
        <View style={styles.fadeControls}>
          <TouchableOpacity style={[styles.fadeButton, fadeInDuration > 0 && styles.fadeButtonActive]} onPress={() => setFadeInDuration(prev => prev > 0 ? 0 : 2)}>
            <Text style={[styles.fadeButtonText, fadeInDuration > 0 && styles.fadeButtonTextActive]}>Fade In: 2s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fadeButton, fadeOutDuration > 0 && styles.fadeButtonActive]} onPress={() => setFadeOutDuration(prev => prev > 0 ? 0 : 2)}>
            <Text style={[styles.fadeButtonText, fadeOutDuration > 0 && styles.fadeButtonTextActive]}>Fade Out: 2s</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.btnPlay} onPress={togglePlayback}>
          {isPlaying ? <Pause color="white" size={28} /> : <Play color="white" size={28} fill="white" />}
        </TouchableOpacity>
        <View style={styles.downloadContainer}>
          <View style={styles.formatSelector}>
            <TouchableOpacity style={[styles.formatButton, exportFormat === 'wav' && styles.formatButtonActive]} onPress={() => setExportFormat('wav')}>
              <Text style={[styles.formatButtonText, exportFormat === 'wav' && styles.formatButtonTextActive]}>WAV</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btnDownload} onPress={downloadProcessedAudio} disabled={processing}>
            {processing ? <ActivityIndicator color="white" /> : (
              <>
                <Download color="white" size={24} />
                <Text style={styles.btnText}>Descargar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
        <RotateCcw size={16} color="#64748b" />
        <Text style={styles.resetText}>Elegir otro archivo</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, width: '100%', maxWidth: 500 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 20 },
  fileName: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  timeText: { color: '#94a3b8', fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }), fontSize: 12 },
  fadeControls: { flexDirection: 'row', gap: 10, marginTop: 20 },
  fadeButton: { flex: 1, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' },
  fadeButtonActive: { backgroundColor: '#166534' },
  fadeButtonText: { color: '#94a3b8', fontSize: 12 },
  fadeButtonTextActive: { color: 'white', fontWeight: 'bold' },
  buttonRow: { flexDirection: 'row', gap: 10, height: 60 },
  btnPlay: { width: 60, height: 60, backgroundColor: '#3b82f6', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  downloadContainer: { flex: 1, borderRadius: 30, flexDirection: 'row', overflow: 'hidden' },
  formatSelector: { flexDirection: 'row', backgroundColor: '#0369a1', padding: 4, gap: 4 },
  formatButton: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 8, justifyContent: 'center' },
  formatButtonActive: { backgroundColor: '#fbbf24' },
  formatButtonText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  formatButtonTextActive: { color: '#166534' },
  btnDownload: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#0284c7', paddingLeft: 20 },
  btnDownloadDisabled: { backgroundColor: '#64748b' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  resetText: { color: '#64748b', fontSize: 14 }
});

export default AudioTrimmer;

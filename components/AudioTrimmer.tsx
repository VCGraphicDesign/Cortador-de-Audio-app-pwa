import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Alert,
  Platform
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [region, setRegion] = useState({ start: 0, end: audioData.duration });
  const [currentTime, setCurrentTime] = useState(0);
  const [fadeInDuration, setFadeInDuration] = useState<number>(0);
  const [fadeOutDuration, setFadeOutDuration] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('mp3');
  
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
          const seconds = status.positionMillis / 1000;
          setCurrentTime(seconds);
          
          if (seconds >= region.end) {
            sound.setPositionAsync(region.start * 1000);
            if (!status.shouldPlay) setIsPlaying(false);
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

  const handleExport = async () => {
    try {
      Alert.alert(
        "Descargar Audio",
        `Se descargara el segmento seleccionado (${(region.end - region.start).toFixed(1)}s).`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Descargar", onPress: async () => {
            await downloadProcessedAudio();
          }}
        ]
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo descargar el archivo.");
    }
  };

  const downloadProcessedAudio = async () => {
    try {
      Alert.alert("Procesando", "Recortando y aplicando fades...");
      
      // Solicitar permisos
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Error", "Se necesitan permisos para guardar archivos.");
        return;
      }

      // Leer el archivo de audio
      const audioBase64 = await FileSystem.readAsStringAsync(audioData.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convertir base64 a ArrayBuffer
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBuffer = bytes.buffer;

      // Procesar audio con fades y recorte según el formato
      let processedAudio: ArrayBuffer;
      if (exportFormat === 'mp3') {
        processedAudio = audioBufferToMp3(
          audioBuffer,
          44100, // sample rate
          2, // stereo
          region.start,
          region.end,
          fadeInDuration,
          fadeOutDuration
        );
      } else {
        processedAudio = audioBufferToWav(
          audioBuffer,
          44100, // sample rate
          2, // stereo
          region.start,
          region.end,
          fadeInDuration,
          fadeOutDuration
        );
      }

      // Convertir ArrayBuffer a base64 para guardar
      const uint8Array = new Uint8Array(processedAudio);
      const base64Processed = btoa(String.fromCharCode(...uint8Array));

      // Crear nombre de archivo
      const nameParts = audioData.name.split('.');
      nameParts.pop();
      const baseName = nameParts.join('.');
      const fileName = `${baseName}_recortado.${exportFormat}`;
      
      const downloadDir = FileSystem.documentDirectory + 'Downloads/';
      const downloadPath = downloadDir + fileName;
      
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      
      // Guardar archivo procesado
      await FileSystem.writeAsStringAsync(downloadPath, base64Processed, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Guardar en la galería
      await MediaLibrary.saveToLibraryAsync(downloadPath);
      
      Alert.alert("Éxito", `Archivo guardado como: ${fileName}`);
      
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert("Error", "No se pudo procesar el archivo.");
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.fileName} numberOfLines={1}>{audioData.name}</Text>
        
        <WaveformMobile 
          duration={audioData.duration}
          region={region}
          currentTime={currentTime}
          onRegionChange={setRegion}
          onSeek={handleSeek}
        />

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(audioData.duration)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>INICIO</Text>
            <Text style={styles.statValue}>{region.start.toFixed(1)}s</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>FINAL</Text>
            <Text style={styles.statValue}>{region.end.toFixed(1)}s</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>RECORTE</Text>
            <Text style={styles.statValue}>{(region.end - region.start).toFixed(1)}s</Text>
          </View>
        </View>

        <View style={styles.fadeRow}>
          <TouchableOpacity 
            style={[styles.fadeButton, fadeInDuration > 0 && styles.fadeButtonActive]}
            onPress={() => setFadeInDuration(prev => prev > 0 ? 0 : 2)}
          >
            <Text style={[styles.fadeButtonText, fadeInDuration > 0 && styles.fadeButtonTextActive]}>
              Fade In: 2s
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.fadeButton, fadeOutDuration > 0 && styles.fadeButtonActive]}
            onPress={() => setFadeOutDuration(prev => prev > 0 ? 0 : 2)}
          >
            <Text style={[styles.fadeButtonText, fadeOutDuration > 0 && styles.fadeButtonTextActive]}>
              Fade Out: 2s
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.btnPlay} onPress={togglePlayback}>
          {isPlaying ? <Pause color="white" size={28} /> : <Play color="white" size={28} fill="white" />}
        </TouchableOpacity>
        
        <View style={styles.downloadContainer}>
          <View style={styles.formatSelector}>
            <TouchableOpacity 
              style={[styles.formatButton, exportFormat === 'mp3' && styles.formatButtonActive]}
              onPress={() => setExportFormat('mp3')}
            >
              <Text style={[styles.formatButtonText, exportFormat === 'mp3' && styles.formatButtonTextActive]}>
                MP3
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.formatButton, exportFormat === 'wav' && styles.formatButtonActive]}
              onPress={() => setExportFormat('wav')}
            >
              <Text style={[styles.formatButtonText, exportFormat === 'wav' && styles.formatButtonTextActive]}>
                WAV
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btnDownload} onPress={handleExport}>
            <Download color="white" size={24} />
            <Text style={styles.btnText}>Descargar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={onReset} style={styles.resetBtn}>
        <RotateCcw size={16} color="#64748b" />
        <Text style={styles.resetText}>Cargar otro</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 450,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  fileName: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    color: '#475569',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fadeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  fadeButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  fadeButtonActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  fadeButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fadeButtonTextActive: {
    color: 'white',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnPlay: {
    width: 80,
    height: 64,
    backgroundColor: '#334155',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadContainer: {
    flex: 1,
    backgroundColor: '#0284c7',
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  formatSelector: {
    flexDirection: 'row',
    backgroundColor: '#0369a1',
    padding: 4,
    gap: 4,
  },
  formatButton: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 8,
  },
  formatButtonActive: {
    backgroundColor: '#fbbf24',
  },
  formatButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formatButtonTextActive: {
    color: '#166534',
  },
  btnDownload: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0284c7',
    paddingLeft: 20,
  },
  btnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  resetText: {
    color: '#64748b',
    fontSize: 14,
  }
});

export default AudioTrimmer;
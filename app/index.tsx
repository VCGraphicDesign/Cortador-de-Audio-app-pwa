
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { AlertCircle, Scissors, Upload } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AudioTrimmer from '../components/AudioTrimmer';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [audioData, setAudioData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const pickDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Carga ligera para obtener metadatos
        const { sound } = await Audio.Sound.createAsync({ uri: asset.uri });
        const status = await sound.getStatusAsync();

        if (status.isLoaded) {
          setAudioData({
            uri: asset.uri,
            name: asset.name,
            duration: status.durationMillis ? status.durationMillis / 1000 : 0,
          });
        }
        await sound.unloadAsync();
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar el archivo. Intenta con otro formato.");
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setAudioData(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Scissors size={24} color="#38bdf8" />
          <View>
            <Text style={styles.headerTitle}>Cortador de Audio Pro</Text>
            <Text style={styles.headerSubtitle}>Directo en tu Dispositivo</Text>
          </View>
        </View>
      </View>

      <View style={styles.main}>
        {!audioData && !loading && (
          <View style={styles.uploadCard}>
            <View style={styles.iconCircle}>
              <Upload size={48} color="#38bdf8" />
            </View>
            <Text style={styles.cardTitle}>Sube tu Audio</Text>
            <Text style={styles.cardText}>
              Selecciona un archivo de tu dispositivo para empezar a editar sin límites.
            </Text>

            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={pickDocument}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonPrimaryText}>Seleccionar Archivo</Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#fca5a5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        )}

        {loading && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.statusText}>Preparando entorno...</Text>
          </View>
        )}

        {audioData && !loading && (
          <AudioTrimmer
            audioData={audioData}
            onReset={resetApp}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  main: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    backgroundColor: '#1e293b',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconCircle: {
    width: 90,
    height: 90,
    backgroundColor: '#0f172a',
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cardText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonPrimary: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    color: '#38bdf8',
    marginTop: 16,
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  }
});
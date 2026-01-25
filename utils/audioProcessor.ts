import * as FileSystem from 'expo-file-system';

export interface ProcessAudioOptions {
  inputUri: string;
  outputUri: string;
  startTime: number;
  endTime: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  format: 'mp3' | 'wav';
}

export const processAudio = async (options: ProcessAudioOptions): Promise<string> => {
  const { inputUri, outputUri, startTime, endTime, fadeInDuration, fadeOutDuration } = options;

  try {
    // Leer el archivo de audio como base64
    const audioBase64 = await FileSystem.readAsStringAsync(inputUri, {
      encoding: 'base64',
    });

    // Convertir base64 a ArrayBuffer
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    // Detectar si es WAV o MP3
    const isWav = await isWavFile(inputUri);

    if (isWav) {
      // Procesar WAV
      const processedBuffer = await processWavAudio(
        arrayBuffer,
        startTime,
        endTime,
        fadeInDuration,
        fadeOutDuration
      );

      // Guardar el archivo procesado
      const processedBase64 = arrayBufferToBase64(processedBuffer);
      await FileSystem.writeAsStringAsync(outputUri, processedBase64, {
        encoding: 'base64',
      });

      return outputUri;
    } else {
      // Para MP3, por ahora solo copiamos (requiere librería nativa para decodificar)
      await FileSystem.copyAsync({ from: inputUri, to: outputUri });
      return outputUri;
    }
  } catch (error) {
    console.error('Error procesando audio:', error);
    throw error;
  }
};

const isWavFile = async (uri: string): Promise<boolean> => {
  try {
    const header = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
      length: 12,
    });
    const decoded = atob(header);
    return decoded.startsWith('RIFF') && decoded.includes('WAVE');
  } catch {
    return false;
  }
};

const processWavAudio = async (
  arrayBuffer: ArrayBuffer,
  startTime: number,
  endTime: number,
  fadeInDuration: number,
  fadeOutDuration: number
): Promise<ArrayBuffer> => {
  const dataView = new DataView(arrayBuffer);

  // Leer header WAV
  const numChannels = dataView.getUint16(22, true);
  const sampleRate = dataView.getUint32(24, true);
  const bitsPerSample = dataView.getUint16(34, true);
  const bytesPerSample = bitsPerSample / 8;

  // Encontrar el chunk de datos
  let dataOffset = 12;
  while (dataOffset < arrayBuffer.byteLength) {
    const chunkId = String.fromCharCode(
      dataView.getUint8(dataOffset),
      dataView.getUint8(dataOffset + 1),
      dataView.getUint8(dataOffset + 2),
      dataView.getUint8(dataOffset + 3)
    );
    const chunkSize = dataView.getUint32(dataOffset + 4, true);

    if (chunkId === 'data') {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  // Calcular muestras
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const totalSamples = endSample - startSample;

  const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
  const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);

  // Crear nuevo buffer
  const newDataSize = totalSamples * numChannels * bytesPerSample;
  const newBufferSize = 44 + newDataSize;
  const newBuffer = new ArrayBuffer(newBufferSize);
  const newView = new DataView(newBuffer);

  // Escribir header WAV
  writeString(newView, 0, 'RIFF');
  newView.setUint32(4, newBufferSize - 8, true);
  writeString(newView, 8, 'WAVE');
  writeString(newView, 12, 'fmt ');
  newView.setUint32(16, 16, true);
  newView.setUint16(20, 1, true);
  newView.setUint16(22, numChannels, true);
  newView.setUint32(24, sampleRate, true);
  newView.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  newView.setUint16(32, numChannels * bytesPerSample, true);
  newView.setUint16(34, bitsPerSample, true);
  writeString(newView, 36, 'data');
  newView.setUint32(40, newDataSize, true);

  // Copiar y procesar muestras
  let writeOffset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const readOffset = dataOffset + (startSample + i) * numChannels * bytesPerSample;

    for (let ch = 0; ch < numChannels; ch++) {
      let sample: number;

      if (bytesPerSample === 2) {
        sample = dataView.getInt16(readOffset + ch * 2, true);
      } else {
        sample = dataView.getInt8(readOffset + ch);
      }

      // Aplicar fade in
      if (i < fadeInSamples) {
        const fadeMultiplier = i / fadeInSamples;
        sample = Math.floor(sample * fadeMultiplier);
      }

      // Aplicar fade out
      if (i >= totalSamples - fadeOutSamples) {
        const fadeMultiplier = (totalSamples - i) / fadeOutSamples;
        sample = Math.floor(sample * fadeMultiplier);
      }

      if (bytesPerSample === 2) {
        newView.setInt16(writeOffset, sample, true);
        writeOffset += 2;
      } else {
        newView.setInt8(writeOffset, sample);
        writeOffset += 1;
      }
    }
  }

  return newBuffer;
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

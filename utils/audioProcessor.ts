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
    // Usar fetch para leer el archivo local como ArrayBuffer (más eficiente y sin deprecated warnings)
    const response = await fetch(inputUri);
    const arrayBuffer = await response.arrayBuffer();

    // Detectar si es WAV mirando los primeros bytes
    const isWav = isWavHeader(arrayBuffer);

    if (isWav) {
      // Procesar WAV
      const processedBuffer = await processWavAudio(
        arrayBuffer,
        startTime,
        endTime,
        fadeInDuration,
        fadeOutDuration
      );

      // Para guardar, FileSystem.writeAsStringAsync requiere base64.
      // Convertimos el buffer procesado a base64.
      const processedBase64 = arrayBufferToBase64(processedBuffer);
      await FileSystem.writeAsStringAsync(outputUri, processedBase64, {
        encoding: 'base64',
      });

      return outputUri;
    } else {
      // Si no es WAV, copiamos
      await FileSystem.copyAsync({ from: inputUri, to: outputUri });
      return outputUri;
    }
  } catch (error) {
    console.error('Error procesando audio:', error);
    throw error;
  }
};

const isWavHeader = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 12) return false;
  const view = new DataView(buffer);

  // RIFF
  if (view.getUint8(0) !== 0x52 || view.getUint8(1) !== 0x49 ||
    view.getUint8(2) !== 0x46 || view.getUint8(3) !== 0x46) return false;

  // WAVE
  if (view.getUint8(8) !== 0x57 || view.getUint8(9) !== 0x41 ||
    view.getUint8(10) !== 0x56 || view.getUint8(11) !== 0x45) return false;

  return true;
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

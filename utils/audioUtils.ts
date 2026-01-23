// Utilidades de audio para React Native

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Procesamiento de audio con fades
export const getProcessedSamples = (
  audioData: ArrayBuffer,
  sampleRate: number,
  channels: number,
  optStart: number,
  optEnd: number,
  fadeInDuration: number,
  fadeOutDuration: number
) => {
  const startOffset = Math.floor(optStart * sampleRate);
  const endOffset = Math.floor(optEnd * sampleRate);
  const frameCount = endOffset - startOffset;
  const numChannels = channels;

  const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
  const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);

  // Convertir ArrayBuffer a Float32Array
  const rawData = new Float32Array(audioData);
  const processedChannels: Float32Array[] = [];

  for (let c = 0; c < numChannels; c++) {
    const output = new Float32Array(frameCount);

    for (let i = 0; i < frameCount; i++) {
      let sample = rawData[startOffset + i + c];

      // Calculate Fade Multiplier
      let multiplier = 1.0;

      // Fade In
      if (i < fadeInSamples && fadeInSamples > 0) {
        multiplier = i / fadeInSamples;
      }

      // Fade Out
      const distFromEnd = frameCount - 1 - i;
      if (distFromEnd < fadeOutSamples && fadeOutSamples > 0) {
        multiplier *= distFromEnd / fadeOutSamples;
      }

      sample = sample * multiplier;
      output[i] = Math.max(-1, Math.min(1, sample));
    }
    processedChannels.push(output);
  }

  return { processedChannels, frameCount, sampleRate, numChannels };
};

export const audioBufferToWav = (
  audioData: ArrayBuffer,
  sampleRate: number,
  channels: number,
  optStart: number,
  optEnd: number,
  fadeInDuration: number = 0,
  fadeOutDuration: number = 0
): ArrayBuffer => {
  const { processedChannels, frameCount, numChannels } = getProcessedSamples(
    audioData, sampleRate, channels, optStart, optEnd, fadeInDuration, fadeOutDuration
  );

  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write interleaved 16-bit PCM
  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = processedChannels[c][i];
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
};

export const audioBufferToMp3 = (
  audioData: ArrayBuffer,
  sampleRate: number,
  channels: number,
  optStart: number,
  optEnd: number,
  fadeInDuration: number = 0,
  fadeOutDuration: number = 0
): ArrayBuffer => {
  // Por ahora, implementación simplificada que convierte a WAV
  // En React Native no tenemos lamejs como en la web, pero el procesamiento de fades y recorte es el mismo
  return audioBufferToWav(
    audioData, sampleRate, channels, optStart, optEnd, fadeInDuration, fadeOutDuration
  );
};
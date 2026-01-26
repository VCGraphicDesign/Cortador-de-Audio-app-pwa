import * as FileSystem from 'expo-file-system';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';

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
  const { inputUri, outputUri, startTime, endTime, fadeInDuration, fadeOutDuration, format } = options;

  try {
    // FFmpeg requires a local file path, not file://
    const inputPath = inputUri.replace('file://', '');
    const outputPath = outputUri.replace('file://', '');

    // Calculate duration for fade out logic
    const duration = endTime - startTime;

    // Construct FFmpeg command
    // -y: overwrite output
    // -i: input file
    // -ss: start time
    // -t: duration (more safer than -to for exact cuts)
    // afade: audio filters for fade in/out

    const fadeFilters = [];

    // Fade In
    if (fadeInDuration > 0) {
      fadeFilters.push(`afade=t=in:ss=0:d=${fadeInDuration}`);
    }

    // Fade Out
    if (fadeOutDuration > 0) {
      // Fade out starts at: duration - fadeOutDuration
      const fadeOutStart = Math.max(0, duration - fadeOutDuration);
      fadeFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`);
    }

    const filterString = fadeFilters.length > 0 ? `-af "${fadeFilters.join(',')}"` : '';

    // Format handle
    // For native mobile, it's safer to specify encoder or format if needed. 
    // Usually extension in output path is enough, but explicit is better.
    let formatFlags = '';
    if (format === 'mp3') {
      formatFlags = '-f mp3 -acodec libmp3lame -q:a 2'; // Good quality VBR
    } else if (format === 'wav') {
      formatFlags = '-f wav';
    }

    const command = `-y -i "${inputPath}" -ss ${startTime} -t ${duration} ${filterString} ${formatFlags} "${outputPath}"`;

    console.log(`[FFmpeg] Running command: ${command}`);

    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (ReturnCode.isSuccess(returnCode)) {
      console.log(`[FFmpeg] Success`);

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(outputUri);
      if (!fileInfo.exists) {
        throw new Error("FFmpeg reported success but output file not found");
      }

      return outputUri;
    } else {
      const failStackTrace = await session.getFailStackTrace();
      const output = await session.getOutput();
      console.error(`[FFmpeg] Failure: ${failStackTrace}`);
      console.error(`[FFmpeg] Logs: ${output}`);
      throw new Error(`FFmpeg process failed with code ${returnCode}`);
    }

  } catch (error) {
    console.error('Error processing audio with FFmpeg:', error);
    throw error;
  }
};

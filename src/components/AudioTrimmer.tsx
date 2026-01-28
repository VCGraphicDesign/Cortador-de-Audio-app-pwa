import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Download, Pause, Play, RotateCcw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import './AudioTrimmer.css';
import WaveformWeb from './WaveformWeb';

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
    const [exportFormat, setExportFormat] = useState<'mp3' | 'wav'>('mp3');
    const [processing, setProcessing] = useState(false);
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ffmpegRef = useRef<FFmpeg>(new FFmpeg());

    useEffect(() => {
        loadFFmpeg();
    }, []);

    const loadFFmpeg = async () => {
        try {
            // Using a more stable version and handling potential COOP/COEP issues
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
            const ffmpeg = ffmpegRef.current;

            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });

            setFfmpegLoaded(true);
        } catch (error) {
            console.error("Error loading FFmpeg:", error);
            alert("No se pudo cargar el motor de audio. Asegúrate de tener conexión a internet.");
        }
    };

    const togglePlayback = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            if (currentTime >= region.end || currentTime < region.start) {
                audioRef.current.currentTime = region.start;
            }
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.currentTime >= region.end) {
                audioRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const handleSeek = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const processAudio = async () => {
        if (!ffmpegLoaded) return;
        setProcessing(true);

        try {
            const ffmpeg = ffmpegRef.current;
            const inputName = 'input_file';
            const outputName = `output_file.${exportFormat}`;

            ffmpeg.on('log', ({ message }) => {
                console.log(`[FFmpeg Log]: ${message}`);
            });

            await ffmpeg.writeFile(inputName, await fetchFile(audioData.uri));

            const duration = region.end - region.start;
            const fadeFilters = [];

            // Use the durations from state
            const safeFadeIn = fadeInDuration > 0 ? Math.min(fadeInDuration, duration / 2) : 0;
            const safeFadeOut = fadeOutDuration > 0 ? Math.min(fadeOutDuration, duration / 2) : 0;

            if (safeFadeIn > 0) {
                fadeFilters.push(`afade=t=in:st=0:d=${safeFadeIn.toFixed(2)}`);
            }

            if (safeFadeOut > 0) {
                const fadeOutStart = Math.max(0, duration - safeFadeOut);
                fadeFilters.push(`afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${safeFadeOut.toFixed(2)}`);
            }

            const filterArgs = fadeFilters.length > 0 ? ['-af', fadeFilters.join(',')] : [];

            const codecArgs = exportFormat === 'mp3'
                ? ['-c:a', 'libmp3lame', '-ar', '44100', '-ac', '2', '-q:a', '2']
                : ['-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2'];

            await ffmpeg.exec([
                '-ss', region.start.toFixed(3),
                '-i', inputName,
                '-t', duration.toFixed(3),
                ...filterArgs,
                ...codecArgs,
                outputName
            ]);

            const data = await ffmpeg.readFile(outputName);
            const fileName = audioData.name.replace(/\.[^/.]+$/, "") + `_cut.${exportFormat}`;
            const mimeType = exportFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';

            const uint8Array = new Uint8Array((data as any).buffer);

            if (Capacitor.isNativePlatform()) {
                const base64Data = await uint8ArrayToBase64(uint8Array);
                let savedUri = "";
                let saveMethod = "";

                try {
                    // Step 1: Try to save directly to the public 'Download' folder
                    const saveResult = await Filesystem.writeFile({
                        path: `Download/${fileName}`,
                        data: base64Data,
                        directory: Directory.ExternalStorage
                    });
                    savedUri = saveResult.uri;
                    saveMethod = "Descargas";
                    alert(`¡Éxito! El audio se guardó directamente en tu carpeta de Descargas.`);
                } catch (e1) {
                    console.warn("Direct Download folder save failed", e1);
                    try {
                        // Step 2: Try Documents folder
                        const saveResult = await Filesystem.writeFile({
                            path: fileName,
                            data: base64Data,
                            directory: Directory.Documents
                        });
                        savedUri = saveResult.uri;
                        saveMethod = "Documentos";
                        alert(`Guardado en la carpeta de Documentos: ${fileName}`);
                    } catch (e2) {
                        console.warn("Documents save failed, using Cache", e2);
                        // Step 3: Fallback to Cache (Always works)
                        const saveResult = await Filesystem.writeFile({
                            path: fileName,
                            data: base64Data,
                            directory: Directory.Cache
                        });
                        savedUri = saveResult.uri;
                        saveMethod = "Caché";
                        alert("Audio procesado. Usa el siguiente menú para elegir dónde guardarlo permanentemente.");
                    }
                }


            } else {
                // Web: Classic download
                const url = URL.createObjectURL(new Blob([uint8Array as any], { type: mimeType }));
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

        } catch (err) {
            console.error("FFmpeg/Processing error:", err);
            alert("Error al procesar el audio. Asegúrate de que el formato sea compatible o prueba con un fragmento más corto.");
        } finally {
            setProcessing(false);
        }
    };

    const uint8ArrayToBase64 = (uint8: Uint8Array): Promise<string> => {
        return new Promise((resolve) => {
            const blob = new Blob([uint8 as any], { type: 'application/octet-stream' });
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(blob);
        });
    };


    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="trimmer-container">
            <audio
                ref={audioRef}
                src={audioData.uri}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
            />

            <div className="card">
                <h3 className="file-name">{audioData.name}</h3>

                <WaveformWeb
                    uri={audioData.uri}
                    duration={audioData.duration}
                    region={region}
                    currentTime={currentTime}
                    onRegionChange={setRegion}
                    onSeek={handleSeek}
                />

                <div className="time-row">
                    <span>{formatTime(region.start)}</span>
                    <span className="current-time">{formatTime(currentTime)}</span>
                    <span>{formatTime(region.end)}</span>
                </div>

                <div className="fade-controls">
                    <button
                        className={`fade-btn ${fadeInDuration > 0 ? 'active' : ''}`}
                        onClick={() => setFadeInDuration(prev => prev > 0 ? 0 : 5)}
                    >
                        Fade In: 5s
                    </button>
                    <button
                        className={`fade-btn ${fadeOutDuration > 0 ? 'active' : ''}`}
                        onClick={() => setFadeOutDuration(prev => prev > 0 ? 0 : 5)}
                    >
                        Fade Out: 5s
                    </button>
                </div>
            </div>

            <div className="action-row">
                <button className="play-btn" onClick={togglePlayback}>
                    {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" />}
                </button>

                <div className="download-group">
                    <div className="format-selector">
                        <button
                            className={exportFormat === 'mp3' ? 'active' : ''}
                            onClick={() => setExportFormat('mp3')}
                        >
                            MP3
                        </button>
                        <button
                            className={exportFormat === 'wav' ? 'active' : ''}
                            onClick={() => setExportFormat('wav')}
                        >
                            WAV
                        </button>
                    </div>
                    <button
                        className="download-btn"
                        onClick={processAudio}
                        disabled={processing || !ffmpegLoaded}
                    >
                        {processing ? <div className="mini-spinner"></div> : <><Download size={20} /> Descargar</>}
                    </button>
                </div>
            </div>

            <button className="reset-btn" onClick={onReset}>
                <RotateCcw size={16} /> Elegir otro archivo
            </button>
        </div>
    );
};

export default AudioTrimmer;

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
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        const ffmpeg = ffmpegRef.current;

        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        setFfmpegLoaded(true);
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

            // Logger para ver qué está pasando en la consola de la tablet
            ffmpeg.on('log', ({ message }) => {
                console.log(`[FFmpeg Log]: ${message}`);
            });

            // Write file to FFmpeg WASM FS
            await ffmpeg.writeFile(inputName, await fetchFile(audioData.uri));

            const duration = region.end - region.start;
            const fadeFilters = [];

            // Seguridad Temporal: Si el audio es más corto que los fades, los ajustamos
            const safeFadeIn = Math.min(fadeInDuration, duration / 2);
            const safeFadeOut = Math.min(fadeOutDuration, duration / 2);

            // Corregido: Usar 'st' (start time) en lugar de 'ss'
            if (safeFadeIn > 0) {
                // curve=exp hace que empiece mucho más bajo y se note más el crecimiento
                fadeFilters.push(`afade=t=in:st=0:d=${safeFadeIn.toFixed(2)}:curve=exp`);
            }

            if (safeFadeOut > 0) {
                // Asegurar que el fade out no empiece antes del inicio del audio
                const fadeOutStart = Math.max(0, duration - safeFadeOut);
                // curve=exp para el fade out hace que el desvanecimiento sea más elegante
                fadeFilters.push(`afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${safeFadeOut.toFixed(2)}:curve=exp`);
            }

            const filterArgs = fadeFilters.length > 0 ? ['-af', fadeFilters.join(',')] : [];

            // Añadimos codecs y forzamos re-muestreo a 44.1k + Stereo para máxima compatibilidad
            const codecArgs = exportFormat === 'mp3'
                ? ['-c:a', 'libmp3lame', '-ar', '44100', '-ac', '2', '-q:a', '2']
                : ['-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2'];

            // EXEC: Usamos búsqueda de entrada (-ss ANTES de -i) 
            // Esto resetea los timestamps a 0, haciendo que afade=st=0 empiece justo al inicio del recorte.
            await ffmpeg.exec([
                '-ss', region.start.toFixed(3),
                '-i', inputName,
                '-t', duration.toFixed(3),
                ...filterArgs,
                ...codecArgs,
                outputName
            ]);

            const data = await ffmpeg.readFile(outputName);
            const url = URL.createObjectURL(new Blob([(data as any).buffer], { type: exportFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav' }));

            const link = document.createElement('a');
            link.href = url;
            link.download = audioData.name.replace(/\.[^/.]+$/, "") + `_cut.${exportFormat}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error(err);
            alert("Error al procesar el audio. Revisa la consola.");
        } finally {
            setProcessing(false);
        }
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
                        onClick={() => setFadeInDuration(prev => prev > 0 ? 0 : 3)}
                    >
                        Fade In: 3s
                    </button>
                    <button
                        className={`fade-btn ${fadeOutDuration > 0 ? 'active' : ''}`}
                        onClick={() => setFadeOutDuration(prev => prev > 0 ? 0 : 3)}
                    >
                        Fade Out: 3s
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

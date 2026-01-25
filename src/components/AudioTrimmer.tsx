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

            // Write file to FFmpeg WASM FS
            await ffmpeg.writeFile(inputName, await fetchFile(audioData.uri));

            const duration = region.end - region.start;
            const fadeFilters = [];
            if (fadeInDuration > 0) fadeFilters.push(`afade=t=in:ss=0:d=${fadeInDuration}`);
            if (fadeOutDuration > 0) fadeFilters.push(`afade=t=out:st=${duration - fadeOutDuration}:d=${fadeOutDuration}`);

            const filterArgs = fadeFilters.length > 0 ? ['-af', fadeFilters.join(',')] : [];

            await ffmpeg.exec([
                '-i', inputName,
                '-ss', region.start.toString(),
                '-t', duration.toString(),
                ...filterArgs,
                outputName
            ]);

            const data = await ffmpeg.readFile(outputName);
            const url = URL.createObjectURL(new Blob([(data as any).buffer], { type: `audio/${exportFormat}` }));

            const link = document.createElement('a');
            link.href = url;
            link.download = audioData.name.replace(/\.[^/.]+$/, "") + `_cut.${exportFormat}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error(err);
            alert("Error al procesar el audio.");
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
                        onClick={() => setFadeInDuration(prev => prev > 0 ? 0 : 2)}
                    >
                        Fade In: 2s
                    </button>
                    <button
                        className={`fade-btn ${fadeOutDuration > 0 ? 'active' : ''}`}
                        onClick={() => setFadeOutDuration(prev => prev > 0 ? 0 : 2)}
                    >
                        Fade Out: 2s
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

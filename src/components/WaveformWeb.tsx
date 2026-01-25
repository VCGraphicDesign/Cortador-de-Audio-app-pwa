import React, { useEffect, useRef, useState } from 'react';

interface WaveformWebProps {
    uri: string;
    duration: number;
    region: { start: number; end: number };
    currentTime: number;
    onRegionChange: (region: { start: number; end: number }) => void;
    onSeek: (time: number) => void;
}

const WaveformWeb: React.FC<WaveformWebProps> = ({
    uri, duration, region, currentTime, onRegionChange, onSeek
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

    useEffect(() => {
        loadAudio();
    }, [uri]);

    const loadAudio = async () => {
        try {
            const response = await fetch(uri);
            const arrayBuffer = await response.arrayBuffer();
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const decodedData = await audioCtx.decodeAudioData(arrayBuffer);
            setAudioBuffer(decodedData);
        } catch (e) {
            console.error("Error loading audio buffer:", e);
        }
    };

    useEffect(() => {
        if (audioBuffer) draw();
    }, [audioBuffer, region, currentTime]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas || !audioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width;
        const height = canvas.height;

        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.clearRect(0, 0, width, height);

        // Draw full waveform (dimmed)
        ctx.fillStyle = '#334155';
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        // Draw active region
        const startX = (region.start / duration) * width;
        const endX = (region.end / duration) * width;
        ctx.fillStyle = '#38bdf8';
        for (let i = Math.floor(startX); i < Math.ceil(endX); i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        // Draw playback cursor
        const cursorX = (currentTime / duration) * width;
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(cursorX, 0, 2, height);
    };

    const getTimeFromX = (clientX: number) => {
        if (!containerRef.current) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return relativeX * duration;
    };

    const handleStart = (clientX: number) => {
        const time = getTimeFromX(clientX);
        const pixPerSec = containerRef.current ? containerRef.current.offsetWidth / duration : 1;

        // Hit-test handles (20px radius for better touch)
        const distStart = Math.abs(time - region.start) * pixPerSec;
        const distEnd = Math.abs(time - region.end) * pixPerSec;

        if (distStart < 25) {
            setDragging('start');
        } else if (distEnd < 25) {
            setDragging('end');
        } else {
            onSeek(time);
        }
    };

    const handleMove = (clientX: number) => {
        if (!dragging) return;
        const time = getTimeFromX(clientX);

        if (dragging === 'start') {
            onRegionChange({ ...region, start: Math.min(time, region.end - 0.1) });
        } else if (dragging === 'end') {
            onRegionChange({ ...region, end: Math.max(time, region.start + 0.1) });
        }
    };

    const handleEnd = () => setDragging(null);

    useEffect(() => {
        const moveSub = (e: MouseEvent) => handleMove(e.clientX);
        const endSub = () => handleEnd();

        if (dragging) {
            window.addEventListener('mousemove', moveSub);
            window.addEventListener('mouseup', endSub);
        }
        return () => {
            window.removeEventListener('mousemove', moveSub);
            window.removeEventListener('mouseup', endSub);
        };
    }, [dragging, region]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '140px',
                backgroundColor: '#0f172a',
                borderRadius: '1rem',
                position: 'relative',
                touchAction: 'none',
                overflow: 'visible',
                marginTop: '20px'
            }}
            onMouseDown={(e) => handleStart(e.clientX)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX)}
            onTouchMove={(e) => handleMove(e.touches[0].clientX)}
            onTouchEnd={handleEnd}
        >
            <canvas
                ref={canvasRef}
                width={1000}
                height={140}
                style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
            />

            {/* Start Handle */}
            <div style={{
                position: 'absolute',
                left: `${(region.start / duration) * 100}%`,
                top: '-10px', bottom: '-10px', width: '4px',
                backgroundColor: '#38bdf8',
                transform: 'translateX(-50%)',
                cursor: 'ew-resize',
                zIndex: 10
            }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: '24px', height: '40px',
                    backgroundColor: '#38bdf8', borderRadius: '4px',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 4px 6px rgb(0 0 0 / 0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ width: '2px', height: '15px', backgroundColor: 'white', opacity: 0.5, margin: '0 1px' }} />
                    <div style={{ width: '2px', height: '15px', backgroundColor: 'white', opacity: 0.5, margin: '0 1px' }} />
                </div>
            </div>

            {/* End Handle */}
            <div style={{
                position: 'absolute',
                left: `${(region.end / duration) * 100}%`,
                top: '-10px', bottom: '-10px', width: '4px',
                backgroundColor: '#38bdf8',
                transform: 'translateX(-50%)',
                cursor: 'ew-resize',
                zIndex: 10
            }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: '24px', height: '40px',
                    backgroundColor: '#38bdf8', borderRadius: '4px',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 4px 6px rgb(0 0 0 / 0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ width: '2px', height: '15px', backgroundColor: 'white', opacity: 0.5, margin: '0 1px' }} />
                    <div style={{ width: '2px', height: '15px', backgroundColor: 'white', opacity: 0.5, margin: '0 1px' }} />
                </div>
            </div>
        </div>
    );
};

export default WaveformWeb;

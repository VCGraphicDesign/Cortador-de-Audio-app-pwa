import { AlertCircle } from 'lucide-react';
import React, { useState } from 'react';
import './App.css';
import AudioTrimmer from './components/AudioTrimmer';

export default function App() {
    const [loading, setLoading] = useState(false);
    const [audioData, setAudioData] = useState<{ uri: string; name: string; duration: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            setError(null);

            const uri = URL.createObjectURL(file);
            const audio = new Audio();
            audio.src = uri;

            await new Promise((resolve, reject) => {
                audio.onloadedmetadata = () => resolve(true);
                audio.onerror = () => reject("Error al cargar el audio.");
            });

            setAudioData({
                uri,
                name: file.name,
                duration: audio.duration,
            });

        } catch (err) {
            console.error(err);
            setError("Error al cargar el archivo. Intenta con otro formato.");
        } finally {
            setLoading(false);
        }
    };

    const resetApp = () => {
        if (audioData?.uri) URL.revokeObjectURL(audioData.uri);
        setAudioData(null);
        setError(null);
    };

    return (
        <div className="app-container">
            <header className="main-header">
                <div className="header-content">
                    <img src="/favicon.png" alt="Logo" style={{ width: '56px', height: '56px', marginRight: '10px' }} />
                    <div className="header-text">
                        <h1>Cortador de Audio Pro</h1>
                        <span className="badge">Directo en tu dispositivo</span>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.5, color: '#94a3b8' }}>
                        v1.0.0 • Client Side
                    </div>
                </div>
            </header>

            <main className="main-content">
                {!audioData && !loading && (
                    <div className="upload-card">
                        <div className="icon-wrapper" style={{ width: '120px', height: '120px', backgroundColor: '#0284c7' }}>
                            <Upload size={64} color="white" />
                        </div>
                        <h2>Sube tu audio</h2>
                        <p>
                            Arrastra un archivo (mp3, wav, flac) o haz clic para seleccionar.
                        </p>
                        <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '-1rem' }}>
                            Procesamiento 100% local. El archivo no sale de tu red.
                        </p>

                        <label className="primary-button">
                            Seleccionar Archivo
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={handleFileChange}
                                className="hidden-input"
                            />
                        </label>

                        {error && (
                            <div className="error-box">
                                <AlertCircle size={18} color="#fca5a5" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                )}

                {loading && (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Cargando audio...</p>
                    </div>
                )}

                {audioData && !loading && (
                    <AudioTrimmer
                        audioData={audioData}
                        onReset={resetApp}
                    />
                )}
            </main>

            <footer className="main-footer">
                Procesamiento nativo con WebAssembly • Privacidad Total
            </footer>
        </div>
    );
}

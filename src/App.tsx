import { AlertCircle, Scissors, Upload } from 'lucide-react';
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
                    <Scissors size={28} color="#38bdf8" />
                    <div className="header-text">
                        <h1>AudioCutter Pro Web</h1>
                        <span className="badge">PWA Edition</span>
                    </div>
                </div>
            </header>

            <main className="main-content">
                {!audioData && !loading && (
                    <div className="upload-card">
                        <div className="icon-wrapper">
                            <Upload size={48} color="#38bdf8" />
                        </div>
                        <h2>Sube tu Audio</h2>
                        <p>
                            Selecciona un archivo (MP3, WAV, etc.) para editarlo directamente en tu navegador.
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

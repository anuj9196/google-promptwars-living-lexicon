import React, { useState, useEffect, useRef } from 'react';
import { AppStatus, Monster } from './types';
import { analyzeImage, generateMonsterVisual } from './services/geminiService';
import MonsterCard from './components/MonsterCard';
import MonsterModal from './components/MonsterModal';
import ScannerOverlay from './components/ScannerOverlay';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [collection, setCollection] = useState<Monster[]>([]);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load collection from local storage
  useEffect(() => {
    const saved = localStorage.getItem('cyberdex_collection');
    if (saved) {
      try {
        setCollection(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load collection", e);
      }
    }
  }, []);

  // Save collection to local storage
  useEffect(() => {
    localStorage.setItem('cyberdex_collection', JSON.stringify(collection));
  }, [collection]);

  // Handle Camera initialization when overlay is opened
  useEffect(() => {
    if (isCameraOpen) {
      const initCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          setIsCameraOpen(false);
          alert("Camera access denied or unavailable. Please use the upload option.");
        }
      };
      
      // Small timeout to ensure video element is rendered
      const timeoutId = setTimeout(initCamera, 100);
      return () => clearTimeout(timeoutId);
    } else {
      // Cleanup stream when closed
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isCameraOpen]);

  const stopCamera = () => {
    setIsCameraOpen(false);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
      stopCamera();
      processImage(base64);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    try {
      setStatus(AppStatus.EVOLVING);
      const monsterData = await analyzeImage(base64);
      
      setStatus(AppStatus.GENERATING_VISUAL);
      const imageUrl = await generateMonsterVisual(monsterData);

      const fullMonster: Monster = {
        id: crypto.randomUUID(),
        name: monsterData.name || "Unknown",
        originalObject: monsterData.originalObject || "Unknown",
        types: monsterData.types || ["Normal"],
        lore: monsterData.lore || "",
        moves: monsterData.moves || [],
        imageUrl,
        capturedAt: Date.now()
      };

      setCollection(prev => [fullMonster, ...prev]);
      setActiveMonster(fullMonster);
      setStatus(AppStatus.DISPLAYING);
    } catch (err) {
      console.error("Processing error:", err);
      alert("Cyber-Dex Malfunction: Failed to analyze object. Our servers might be experiencing heavy load.");
      setStatus(AppStatus.IDLE);
    }
  };

  return (
    <div className="min-h-screen pb-20 p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col items-center mb-12">
        <h1 className="text-4xl md:text-6xl font-orbitron font-bold text-center mb-2 tracking-widest flex items-center gap-4">
          <span className="neon-text-cyan">LIVING</span>
          <span className="neon-text-magenta">LEXICON</span>
        </h1>
        <p className="text-cyan-400 font-orbitron text-xs tracking-[0.3em] uppercase opacity-80">
          Neural Interface • Model 2026.4
        </p>
      </header>

      {/* Main Action Area */}
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8 mb-16">
        <div className="relative group">
          <button 
            onClick={() => setIsCameraOpen(true)}
            className="w-48 h-48 md:w-64 md:h-64 rounded-full border-4 border-cyan-500/30 flex flex-col items-center justify-center gap-4 hover:border-cyan-400 transition-all hover:scale-105 active:scale-95 group overflow-hidden bg-black/40 backdrop-blur-sm relative z-20"
          >
            <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-cyan-400 group-hover:neon-text-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-orbitron text-sm font-bold text-cyan-400 tracking-wider">SCAN REALITY</span>
          </button>
          {/* Decorative glowing rings - pointer-events-none added to prevent blocking clicks */}
          <div className="absolute -inset-4 rounded-full border border-cyan-500/20 animate-pulse pointer-events-none z-10"></div>
          <div className="absolute -inset-8 rounded-full border border-magenta-500/10 animate-[pulse_3s_linear_infinite] pointer-events-none z-10"></div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <label className="cursor-pointer group flex items-center gap-2 text-cyan-300/60 hover:text-cyan-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-sm font-orbitron tracking-widest uppercase">Manual Upload</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {/* Collection Gallery */}
      <section className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-cyan-500/20 pb-4">
          <h2 className="text-2xl font-orbitron font-bold neon-text-cyan flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            CYBER-INDEX
          </h2>
          <span className="text-cyan-500/60 font-mono text-sm">ENTRIES: {collection.length}</span>
        </div>

        {collection.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <div className="w-24 h-24 mb-4 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="font-orbitron text-xs tracking-widest uppercase italic">The database is currently offline.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {collection.map(monster => (
              <MonsterCard key={monster.id} monster={monster} onClick={() => setActiveMonster(monster)} />
            ))}
          </div>
        )}
      </section>

      {/* Overlays & Modals */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <ScannerOverlay />
          <div className="absolute bottom-10 flex gap-8 items-center z-[60]">
            <button 
              onClick={stopCamera}
              className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button 
              onClick={captureAndScan}
              className="w-24 h-24 rounded-full bg-cyan-500 border-4 border-white flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.6)]"
            >
              <div className="w-20 h-20 rounded-full border-2 border-black/20"></div>
            </button>
            <div className="w-16 h-16"></div> {/* Spacer */}
          </div>
        </div>
      )}

      {(status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL) && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-8 backdrop-blur-xl">
          <div className="relative w-48 h-48 mb-12">
            <div className="absolute inset-0 border-4 border-cyan-500 rounded-full animate-[spin_3s_linear_infinite] border-t-transparent shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
            <div className="absolute inset-4 border-4 border-magenta-500 rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent shadow-[0_0_15px_rgba(255,0,255,0.5)]"></div>
            <div className="absolute inset-8 border-4 border-yellow-400 rounded-full animate-[spin_1.5s_linear_infinite] border-l-transparent shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-orbitron font-bold text-xl text-white animate-pulse">2026</span>
            </div>
          </div>
          <h3 className="text-3xl font-orbitron font-bold text-white mb-4 text-center">
            {status === AppStatus.EVOLVING ? 'ANALYZING ATOMS' : 'SYNTHESIZING ENTITY'}
          </h3>
          <p className="text-cyan-400 font-mono text-sm tracking-widest text-center animate-pulse">
            {status === AppStatus.EVOLVING 
              ? 'MAPPING OBJECT COORDINATES • CALCULATING EVOLUTIONARY PATHS' 
              : 'DREAMING IN HIGH-DEFINITION • MATERIALIZING PHOTONS'}
          </p>
        </div>
      )}

      {activeMonster && (
        <MonsterModal monster={activeMonster} onClose={() => setActiveMonster(null)} />
      )}
    </div>
  );
};

export default App;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, Monster } from './types';
import { analyzeImage, generateMonsterVisual, getLoreAudio } from './services/geminiService';
import MonsterCard from './components/MonsterCard';
import MonsterModal from './components/MonsterModal';
import ScannerOverlay from './components/ScannerOverlay';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [collection, setCollection] = useState<Monster[]>([]);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [currentDetection, setCurrentDetection] = useState<Monster | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize Audio Context on user interaction to comply with browser policies
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Persistence: Load collection
  useEffect(() => {
    const saved = localStorage.getItem('cyberdex_collection');
    if (saved) {
      try { setCollection(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  // Persistence: Save collection
  useEffect(() => {
    localStorage.setItem('cyberdex_collection', JSON.stringify(collection));
  }, [collection]);

  // Optical Interface: Camera management
  useEffect(() => {
    const isOpticalMode = status === AppStatus.AR_MODE || !!currentDetection || status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL;
    
    if (isOpticalMode) {
      if (!streamRef.current) {
        const initCamera = async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
            });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
          } catch (err) {
            console.error("Optics Malfunction:", err);
            setStatus(AppStatus.IDLE);
          }
        };
        initCamera();
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [status, currentDetection]);

  // 3-Second Auto-Scan Logic
  useEffect(() => {
    let interval: number | undefined;
    if (status === AppStatus.AR_MODE && !currentDetection && !activeMonster) {
      interval = window.setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            captureFrame();
            return 0;
          }
          return prev + 2.5; // ~2.4s for 100% at 60ms intervals
        });
      }, 60);
    } else {
      setScanProgress(0);
    }
    return () => clearInterval(interval);
  }, [status, currentDetection, activeMonster]);

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
      audioSourceRef.current = null;
    }
  }, []);

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
      processImage(base64);
    }
  };

  const processImage = async (base64: string) => {
    try {
      setStatus(AppStatus.EVOLVING);
      const monsterData = await analyzeImage(base64);
      
      // Check cache for identical findings
      const existing = collection.find(m => 
        m.name.toLowerCase() === monsterData.name?.toLowerCase() || 
        m.originalObject.toLowerCase() === monsterData.originalObject?.toLowerCase()
      );

      if (existing) {
        displayDetection(existing);
        return;
      }

      setStatus(AppStatus.GENERATING_VISUAL);
      const imageUrl = await generateMonsterVisual(monsterData);

      const fullMonster: Monster = {
        id: crypto.randomUUID(),
        name: monsterData.name || "Unknown Entity",
        originalObject: monsterData.originalObject || "Unknown Matter",
        types: monsterData.types || ["Unknown"],
        lore: monsterData.lore || "No data recovered.",
        moves: monsterData.moves || [],
        imageUrl,
        capturedAt: Date.now()
      };

      setCollection(prev => [fullMonster, ...prev]);
      displayDetection(fullMonster);
    } catch (err) {
      console.error("Neural Synthesis Failure:", err);
      setStatus(AppStatus.AR_MODE);
    }
  };

  const displayDetection = async (monster: Monster) => {
    setCurrentDetection(monster);
    setStatus(AppStatus.AR_MODE);
    
    // Voice description protocol
    stopAudio();
    initAudio();
    if (audioCtxRef.current) {
      const audioBuffer = await getLoreAudio(`${monster.name}. ${monster.lore}`, audioCtxRef.current);
      if (audioBuffer) {
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtxRef.current.destination);
        source.start();
        audioSourceRef.current = source;
      }
    }
  };

  const clearTarget = useCallback(() => {
    stopAudio();
    setCurrentDetection(null);
    setScanProgress(0);
  }, [stopAudio]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    initAudio();
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

  const enterAR = () => {
    initAudio();
    setStatus(AppStatus.AR_MODE);
  };

  return (
    <div className="relative min-h-screen w-screen bg-[#05070a] text-white overflow-x-hidden flex flex-col font-inter">
      
      {/* 1. PHOTONIC BACKGROUND (Active during AR states) */}
      <div 
        aria-hidden="true"
        className={`fixed inset-0 z-0 transition-opacity duration-1000 ${(status === AppStatus.AR_MODE || currentDetection || status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="h-full w-full object-cover grayscale-[15%] brightness-[0.7] contrast-[1.1]"
        />
        <canvas ref={canvasRef} className="hidden" />
        <ScannerOverlay />
        
        {/* Auto-Scan Interface */}
        {status === AppStatus.AR_MODE && !currentDetection && !activeMonster && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-24 flex flex-col items-center gap-3 pointer-events-none">
            <div className="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-cyan-400 shadow-[0_0_15px_#00f2ff] transition-all duration-100" 
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
            <span className="text-[10px] font-orbitron tracking-[0.5em] text-cyan-400 animate-pulse uppercase">Fixating on Reality...</span>
          </div>
        )}
      </div>

      {/* 2. NEURAL INTERFACE LAYER */}
      <div className="relative z-10 flex-1 flex flex-col pointer-events-none">
        
        {/* Persistent HUD Header */}
        <header className="p-6 md:p-8 flex justify-between items-start pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-xl flex flex-col shadow-2xl">
            <h1 className="text-2xl font-orbitron font-bold neon-text-cyan tracking-widest leading-none">LEXICON <span className="text-magenta-500">2026</span></h1>
            <p className="text-[9px] font-mono text-cyan-400/60 tracking-[0.2em] mt-1.5 uppercase">Neural Link Established</p>
          </div>
          
          {(status === AppStatus.AR_MODE || currentDetection) && (
            <button 
              onClick={() => { setStatus(AppStatus.IDLE); clearTarget(); }}
              aria-label="Exit Optical Interface"
              className="bg-red-900/50 backdrop-blur-2xl border border-red-500/40 px-6 py-3 rounded-xl hover:bg-red-600/40 transition-all font-orbitron text-[10px] tracking-widest text-white uppercase shadow-lg focus:ring-2 focus:ring-red-400 outline-none"
            >
              Exit Optics
            </button>
          )}
        </header>

        {/* HOME DASHBOARD */}
        {status === AppStatus.IDLE && !currentDetection && !activeMonster && (
          <main className="flex-1 flex flex-col items-center justify-center p-6 pointer-events-auto animate-in fade-in duration-1000">
            <div className="max-w-6xl w-full flex flex-col items-center gap-16">
              
              {/* Primary Engagement Vector */}
              <div className="relative group">
                <button 
                  onClick={enterAR}
                  aria-label="Enter Augmented Reality Scanning Mode"
                  className="relative z-20 w-64 h-64 rounded-full bg-black/60 backdrop-blur-2xl border-4 border-cyan-500/20 flex flex-col items-center justify-center gap-6 hover:border-cyan-400 hover:scale-105 transition-all group active:scale-95 shadow-[0_0_80px_rgba(0,242,255,0.15)] overflow-hidden focus:ring-4 focus:ring-cyan-400 outline-none"
                >
                  <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 text-cyan-400 group-hover:neon-text-cyan transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-orbitron font-bold text-cyan-400 tracking-[0.4em] text-xs uppercase">Initialize Optics</span>
                </button>
                <div className="absolute -inset-6 rounded-full border border-cyan-500/10 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none"></div>
                <div className="absolute -inset-12 rounded-full border border-magenta-500/5 animate-[pulse_3s_ease-in-out_infinite_reverse] pointer-events-none"></div>
              </div>

              {/* Secondary Input */}
              <label className="cursor-pointer flex items-center gap-3 text-cyan-500/50 hover:text-cyan-400 transition-all font-orbitron text-[10px] tracking-[0.5em] uppercase hover:tracking-[0.6em] focus-within:ring-2 focus-within:ring-cyan-500 rounded p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Neural Feed Upload
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>

              {/* Catalog Section */}
              <section className="w-full" aria-labelledby="gallery-title">
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                  <h2 id="gallery-title" className="text-xl font-orbitron font-bold neon-text-cyan flex items-center gap-4">
                    <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_10px_#00f2ff]"></span>
                    NEURAL ARCHIVE
                  </h2>
                  <span className="font-mono text-cyan-500/50 text-[10px] tracking-widest uppercase">SYMBOLS: {collection.length}</span>
                </div>

                {collection.length === 0 ? (
                  <div className="py-28 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl opacity-30 bg-white/[0.02]">
                    <p className="font-orbitron text-[10px] tracking-[0.6em] uppercase">Archive buffer empty</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {collection.map(monster => (
                      <MonsterCard key={monster.id} monster={monster} onClick={() => { initAudio(); setActiveMonster(monster); }} />
                    ))}
                  </div>
                )}
              </section>
            </div>
            <div className="h-24"></div>
          </main>
        )}

        {/* DETECTION POPOVER (Overlay for AR Mode) */}
        {currentDetection && (
          <div 
            role="alert"
            aria-live="polite"
            className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[92%] max-w-md pointer-events-auto animate-in slide-in-from-bottom-12 fade-in duration-700"
          >
            <div 
              onClick={() => setActiveMonster(currentDetection)}
              className="bg-black/70 backdrop-blur-2xl border-2 border-cyan-500/50 rounded-2xl p-5 shadow-[0_0_80px_rgba(0,242,255,0.4)] flex items-center gap-5 cursor-pointer hover:border-white hover:scale-[1.02] transition-all group focus:ring-2 focus:ring-cyan-500 outline-none"
            >
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/20 shrink-0 relative shadow-inner">
                <img src={currentDetection.imageUrl} className="w-full h-full object-cover brightness-110 group-hover:scale-110 transition-transform duration-1000" alt="" />
                <div className="absolute inset-0 bg-cyan-500/20 mix-blend-overlay"></div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-orbitron font-bold text-2xl neon-text-cyan leading-none tracking-tighter uppercase">{currentDetection.name}</h3>
                    <div className="flex gap-1.5 mt-2.5">
                      {currentDetection.types.map(t => (
                        <span key={t} className="text-[10px] px-2.5 py-0.5 bg-cyan-900/50 border border-cyan-500/30 text-cyan-200 font-bold uppercase tracking-widest rounded shadow-sm">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); clearTarget(); }}
                    aria-label="Clear Target Detection"
                    className="p-2 -mt-2 -mr-2 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="text-[11px] text-white/50 mt-4 font-mono tracking-tight line-clamp-2 italic leading-relaxed border-l border-white/10 pl-2">
                  Object: {currentDetection.originalObject}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                  <span className="text-[9px] font-orbitron tracking-[0.3em] text-cyan-500 uppercase">Tap for Neural Depth</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={clearTarget}
              className="mt-6 mx-auto block px-8 py-2.5 bg-black/50 border border-white/10 rounded-full font-orbitron text-[10px] tracking-[0.4em] uppercase hover:bg-magenta-500/30 hover:border-magenta-500 transition-all text-white/40 hover:text-white shadow-xl"
            >
              Clear Optics
            </button>
          </div>
        )}
      </div>

      {/* 3. SYNTHESIS HUD OVERLAYS */}
      {(status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL) && (
        <div 
          role="status"
          aria-busy="true"
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="relative w-64 h-64 flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full animate-[spin_6s_linear_infinite]"></div>
            <div className="absolute inset-6 border border-dashed border-magenta-500/40 rounded-full animate-[spin_10s_linear_infinite_reverse]"></div>
            <div className="absolute inset-12 border border-white/5 rounded-full animate-pulse"></div>
            
            <div className="flex flex-col items-center gap-3">
              <span className="font-orbitron text-2xl font-black neon-text-cyan tracking-[0.2em] animate-pulse">
                {status === AppStatus.EVOLVING ? 'ANALYZING' : 'SYNTHESIZING'}
              </span>
              <div className="flex gap-2">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }}></div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-10 text-[11px] font-mono tracking-[0.5em] uppercase text-white/40 max-w-xs leading-relaxed">
            Constructing digital biological architecture from target photonic data...
          </p>
        </div>
      )}

      {/* 4. MODALS */}
      {activeMonster && (
        <MonsterModal 
          monster={activeMonster} 
          onClose={() => setActiveMonster(null)} 
        />
      )}
    </div>
  );
};

export default App;

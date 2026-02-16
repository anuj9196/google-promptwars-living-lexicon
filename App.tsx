
import React, { useState, useEffect, useRef } from 'react';
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

  // Camera stream management
  useEffect(() => {
    const isScanning = status === AppStatus.AR_MODE || currentDetection || status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL;
    
    if (isScanning) {
      if (!streamRef.current) {
        const initCamera = async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
            });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
          } catch (err) {
            console.error("Camera access error:", err);
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
    let interval: number;
    if (status === AppStatus.AR_MODE && !currentDetection && !activeMonster) {
      interval = window.setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            captureFrame();
            return 0;
          }
          return prev + 2; // Increments roughly to 100 over 3 seconds (60ms * 50 = 3s)
        });
      }, 60);
    } else {
      setScanProgress(0);
    }
    return () => clearInterval(interval);
  }, [status, currentDetection, activeMonster]);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
      audioSourceRef.current = null;
    }
  };

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
      
      // Cache/Existing lookup
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
        name: monsterData.name || "Unknown",
        originalObject: monsterData.originalObject || "Unknown",
        types: monsterData.types || ["Unknown"],
        lore: monsterData.lore || "",
        moves: monsterData.moves || [],
        imageUrl,
        capturedAt: Date.now()
      };

      setCollection(prev => [fullMonster, ...prev]);
      displayDetection(fullMonster);
    } catch (err) {
      console.error("AI Processing error:", err);
      setStatus(AppStatus.AR_MODE);
    }
  };

  const displayDetection = async (monster: Monster) => {
    setCurrentDetection(monster);
    setStatus(AppStatus.AR_MODE);
    
    // Voice Integration
    stopAudio();
    const audioBuffer = await getLoreAudio(`Identified: ${monster.name}. ${monster.lore}`);
    if (audioBuffer) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtxRef.current.destination);
      source.start();
      audioSourceRef.current = source;
    }
  };

  const clearTarget = () => {
    stopAudio();
    setCurrentDetection(null);
    setScanProgress(0);
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

  return (
    <div className="relative min-h-screen w-screen bg-[#05070a] text-white overflow-x-hidden flex flex-col">
      
      {/* BACKGROUND CAMERA (Active during AR modes) */}
      <div className={`fixed inset-0 z-0 transition-opacity duration-1000 ${(status === AppStatus.AR_MODE || currentDetection || status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="h-full w-full object-cover grayscale-[10%] brightness-[0.7] contrast-[1.1]"
        />
        <canvas ref={canvasRef} className="hidden" />
        <ScannerOverlay />
        
        {/* Auto-Scan HUD indicator */}
        {status === AppStatus.AR_MODE && !currentDetection && !activeMonster && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-24 flex flex-col items-center gap-2 pointer-events-none">
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 shadow-[0_0_10px_#00f2ff] transition-all duration-100" 
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
            <span className="text-[10px] font-orbitron tracking-[0.4em] text-cyan-400 animate-pulse uppercase">Fixating on Reality...</span>
          </div>
        )}
      </div>

      {/* FOREGROUND INTERFACE */}
      <div className="relative z-10 flex-1 flex flex-col pointer-events-none">
        
        {/* Header (Persistent) */}
        <header className="p-6 md:p-8 flex justify-between items-start pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-md border border-cyan-500/30 p-4 rounded-xl flex flex-col">
            <h1 className="text-2xl font-orbitron font-bold neon-text-cyan tracking-widest leading-none">LEXICON <span className="text-magenta-500">2026</span></h1>
            <p className="text-[9px] font-mono text-cyan-400/60 tracking-[0.2em] mt-1 uppercase">Neural Link Established</p>
          </div>
          
          {(status === AppStatus.AR_MODE || currentDetection) && (
            <button 
              onClick={() => { setStatus(AppStatus.IDLE); clearTarget(); }}
              className="bg-red-900/40 backdrop-blur-xl border border-red-500/30 px-6 py-3 rounded-xl hover:bg-red-600/30 transition-all font-orbitron text-xs tracking-widest text-white uppercase"
            >
              Exit Optics
            </button>
          )}
        </header>

        {/* HOME DASHBOARD (Visible when idle) */}
        {status === AppStatus.IDLE && !currentDetection && !activeMonster && (
          <main className="flex-1 flex flex-col items-center justify-center p-6 pointer-events-auto animate-in fade-in duration-700">
            <div className="max-w-6xl w-full flex flex-col items-center gap-16">
              
              {/* Central Scan Control */}
              <div className="relative group">
                <button 
                  onClick={() => setStatus(AppStatus.AR_MODE)}
                  className="relative z-20 w-64 h-64 rounded-full bg-black/40 backdrop-blur-md border-4 border-cyan-500/20 flex flex-col items-center justify-center gap-6 hover:border-cyan-400 hover:scale-105 transition-all group active:scale-95 shadow-[0_0_50px_rgba(0,242,255,0.1)] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 text-cyan-400 group-hover:neon-text-cyan transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-orbitron font-bold text-cyan-400 tracking-[0.3em] text-sm uppercase">Enter AR Mode</span>
                </button>
                <div className="absolute -inset-4 rounded-full border border-cyan-500/10 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none"></div>
                <div className="absolute -inset-10 rounded-full border border-magenta-500/5 animate-[pulse_3s_ease-in-out_infinite_reverse] pointer-events-none"></div>
              </div>

              {/* Upload Alternate */}
              <label className="cursor-pointer flex items-center gap-3 text-cyan-500/40 hover:text-cyan-400 transition-colors font-orbitron text-[10px] tracking-[0.5em] uppercase">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Manual Feed Upload
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>

              {/* Gallery Section */}
              <section className="w-full">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                  <h2 className="text-xl font-orbitron font-bold neon-text-cyan flex items-center gap-4">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_#00f2ff]"></span>
                    COLLECTED NEURAL LOGS
                  </h2>
                  <span className="font-mono text-cyan-500/50 text-xs tracking-widest uppercase">ID_BUFFER: {collection.length}</span>
                </div>

                {collection.length === 0 ? (
                  <div className="py-24 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl opacity-30">
                    <p className="font-orbitron text-[10px] tracking-[0.5em] uppercase">Lexicon database empty</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {collection.map(monster => (
                      <MonsterCard key={monster.id} monster={monster} onClick={() => setActiveMonster(monster)} />
                    ))}
                  </div>
                )}
              </section>
            </div>
            <div className="h-24"></div>
          </main>
        )}

        {/* DETECTION POPOVER (Overlay for AR/Scanning) */}
        {currentDetection && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-md pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div 
              onClick={() => setActiveMonster(currentDetection)}
              className="bg-black/70 backdrop-blur-2xl border-2 border-cyan-500/50 rounded-2xl p-4 shadow-[0_0_60px_rgba(0,242,255,0.3)] flex items-center gap-5 cursor-pointer hover:border-white transition-all group"
            >
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/20 shrink-0 relative">
                <img src={currentDetection.imageUrl} className="w-full h-full object-cover brightness-110 group-hover:scale-110 transition-transform duration-700" alt="" />
                <div className="absolute inset-0 bg-cyan-500/10 mix-blend-overlay"></div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-orbitron font-bold text-xl neon-text-cyan leading-tight tracking-tighter uppercase">{currentDetection.name}</h3>
                    <div className="flex gap-1.5 mt-1.5">
                      {currentDetection.types.map(t => (
                        <span key={t} className="text-[9px] px-2 py-0.5 bg-cyan-900/40 border border-cyan-500/20 text-cyan-300 font-bold uppercase tracking-widest rounded-md">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); clearTarget(); }}
                    className="p-2 -mt-2 -mr-2 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="text-[10px] text-white/40 mt-3 font-mono tracking-tighter line-clamp-2 italic leading-relaxed">
                  Source Identified: {currentDetection.originalObject}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span className="text-[8px] font-orbitron tracking-[0.2em] text-cyan-500/60 uppercase">Tap for full neural log</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={clearTarget}
              className="mt-4 mx-auto block px-6 py-2 bg-black/40 border border-white/5 rounded-full font-orbitron text-[9px] tracking-[0.3em] uppercase hover:bg-magenta-500/20 hover:border-magenta-500 transition-all text-white/50 hover:text-white"
            >
              Target Lost / Clear Optics
            </button>
          </div>
        )}
      </div>

      {/* PROCESSING HUD OVERLAYS */}
      {(status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL) && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
          <div className="relative w-64 h-64 flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full animate-[spin_4s_linear_infinite]"></div>
            <div className="absolute inset-4 border border-dashed border-magenta-500/40 rounded-full animate-[spin_8s_linear_infinite_reverse]"></div>
            <div className="absolute inset-10 border border-white/5 rounded-full animate-pulse"></div>
            
            <div className="flex flex-col items-center gap-3">
              <span className="font-orbitron text-xl font-black neon-text-cyan tracking-widest animate-pulse">
                {status === AppStatus.EVOLVING ? 'ANALYZING' : 'SYNTHESIZING'}
              </span>
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-cyan-500 animate-bounce" style={{ animationDelay: `${i*0.2}s` }}></div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-8 text-xs font-mono tracking-[0.5em] uppercase text-white/40 max-w-xs leading-relaxed">
            Constructing digital biological architecture from target photonic data...
          </p>
        </div>
      )}

      {/* FULL CARD MODAL (Opened from popover or gallery) */}
      {activeMonster && (
        <MonsterModal 
          monster={activeMonster} 
          onClose={() => {
            setActiveMonster(null);
            // We don't change status, so if it was AR it stays AR
          }} 
        />
      )}
    </div>
  );
};

export default App;

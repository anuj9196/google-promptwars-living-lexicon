
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, Monster } from './types';
import { analyzeImage, generateMonsterVisual, getLoreAudio } from './services/geminiService';
import MonsterCard from './components/MonsterCard';
import MonsterModal from './components/MonsterModal';
import ScannerOverlay from './components/ScannerOverlay';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [collection, setCollection] = useState<Monster[]>([]);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [currentDetection, setCurrentDetection] = useState<Monster | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [isFixating, setIsFixating] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Mandatory API key selection flow
  const ensureApiKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }
    return true;
  };

  // Initialize Audio Context on user interaction
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
            setErrorMessage(null);
          } catch (err: any) {
            console.error("Optics Malfunction:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              setErrorMessage("NEURAL LINK DENIED: Please enable camera access in browser settings.");
            } else {
              setErrorMessage("SYSTEM ERROR: Failed to initialize photonic sensor array.");
            }
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

  // Updated Fixation Timer Logic: Only runs while user is "Holding" the screen
  useEffect(() => {
    let interval: number | undefined;
    if (status === AppStatus.AR_MODE && isFixating && !currentDetection && !activeMonster) {
      interval = window.setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsFixating(false);
            captureFrame();
            return 100;
          }
          return prev + 2; // ~3s for 100% (60ms * 50 steps)
        });
      }, 60);
    } else if (!isFixating) {
      setScanProgress(0);
    }
    return () => clearInterval(interval);
  }, [status, isFixating, currentDetection, activeMonster]);

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
      await ensureApiKey();
      setStatus(AppStatus.EVOLVING);
      const monsterData = await analyzeImage(base64);
      
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
    } catch (err: any) {
      console.error("Neural Synthesis Failure:", err);
      setErrorMessage(`SYNTHESIS ERROR: ${err.message || 'Signal lost'}`);
      setStatus(AppStatus.AR_MODE);
    }
  };

  const displayDetection = async (monster: Monster) => {
    setCurrentDetection(monster);
    setStatus(AppStatus.AR_MODE);
    
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
    setIsFixating(false);
  }, [stopAudio]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    initAudio();
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const enterAR = async () => {
    setErrorMessage(null);
    initAudio();
    await ensureApiKey();
    setStatus(AppStatus.AR_MODE);
  };

  const startFixation = () => {
    if (status === AppStatus.AR_MODE && !currentDetection && !activeMonster) {
      setIsFixating(true);
      // Optional: Trigger haptic feedback if available
      if (window.navigator.vibrate) window.navigator.vibrate(10);
    }
  };

  const endFixation = () => {
    setIsFixating(false);
  };

  return (
    <div className="relative min-h-screen w-screen bg-[#05070a] text-white overflow-x-hidden flex flex-col font-inter select-none">
      
      {/* 0. GLOBAL ERROR HUD */}
      {errorMessage && (
        <div role="alert" className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] w-[90%] max-w-xl animate-in slide-in-from-top-4 duration-500">
          <div className="bg-red-950/80 backdrop-blur-2xl border border-red-500/50 p-4 rounded-xl flex items-center justify-between shadow-[0_0_40px_rgba(239,68,68,0.3)]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="font-orbitron text-[10px] tracking-widest text-red-100 uppercase">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="p-2 text-red-400 hover:text-white" aria-label="Dismiss Alert">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* 1. PHOTONIC BACKGROUND & VIEWPORT */}
      <div 
        aria-hidden="true"
        onPointerDown={startFixation}
        onPointerUp={endFixation}
        onPointerLeave={endFixation}
        className={`fixed inset-0 z-0 transition-opacity duration-1000 ${(status === AppStatus.AR_MODE || currentDetection || status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover grayscale-[15%] brightness-[0.7] contrast-[1.1]" />
        <canvas ref={canvasRef} className="hidden" />
        <ScannerOverlay isFixating={isFixating} progress={scanProgress} />
        
        {/* Fixation Prompt / Progress HUD */}
        {status === AppStatus.AR_MODE && !currentDetection && !activeMonster && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-24 flex flex-col items-center gap-4 pointer-events-none">
            {isFixating ? (
              <>
                <div className="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-cyan-400 shadow-[0_0_15px_#00f2ff] transition-all duration-100" style={{ width: `${scanProgress}%` }}></div>
                </div>
                <span className="text-[10px] font-orbitron tracking-[0.5em] text-cyan-400 animate-pulse uppercase">Neural Linking...</span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 animate-bounce">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-400/30 flex items-center justify-center">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                </div>
                <span className="text-[10px] font-orbitron tracking-[0.4em] text-white/40 uppercase">Hold Screen to Fixate</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. NEURAL INTERFACE LAYER */}
      <div className="relative z-10 flex-1 flex flex-col pointer-events-none">
        <header className="p-6 md:p-8 flex justify-between items-start pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-xl flex flex-col shadow-2xl">
            <h1 className="text-2xl font-orbitron font-bold neon-text-cyan tracking-widest leading-none">LEXICON <span className="text-magenta-500">2026</span></h1>
            <p className="text-[9px] font-mono text-cyan-400/60 tracking-[0.2em] mt-1.5 uppercase">Neural Link Established</p>
          </div>
          
          {(status === AppStatus.AR_MODE || currentDetection) && (
            <button 
              onClick={() => { setStatus(AppStatus.IDLE); clearTarget(); }}
              aria-label="Exit Optical Interface"
              className="bg-red-900/50 backdrop-blur-2xl border border-red-500/40 px-6 py-3 rounded-xl hover:bg-red-600/40 transition-all font-orbitron text-[10px] tracking-widest text-white uppercase shadow-lg outline-none"
            >
              Exit Optics
            </button>
          )}
        </header>

        {status === AppStatus.IDLE && !currentDetection && !activeMonster && (
          <main className="flex-1 flex flex-col items-center justify-center p-6 pointer-events-auto animate-in fade-in duration-1000">
            <div className="max-w-6xl w-full flex flex-col items-center gap-16">
              <div className="relative group">
                <button 
                  onClick={enterAR}
                  className="relative z-20 w-64 h-64 rounded-full bg-black/60 backdrop-blur-2xl border-4 border-cyan-500/20 flex flex-col items-center justify-center gap-6 hover:border-cyan-400 hover:scale-105 transition-all group active:scale-95 shadow-[0_0_80px_rgba(0,242,255,0.15)] overflow-hidden outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 text-cyan-400 group-hover:neon-text-cyan transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-orbitron font-bold text-cyan-400 tracking-[0.4em] text-xs uppercase">Initialize Optics</span>
                </button>
                <div className="absolute -inset-6 rounded-full border border-cyan-500/10 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none"></div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <label className="cursor-pointer flex items-center gap-3 text-cyan-500/50 hover:text-cyan-400 transition-all font-orbitron text-[10px] tracking-[0.5em] uppercase hover:tracking-[0.6em] rounded p-1">
                  Neural Feed Upload
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[8px] font-mono text-cyan-500/30 hover:text-cyan-500 transition-colors uppercase tracking-widest">Billing Documentation</a>
              </div>

              <section className="w-full">
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                  <h2 className="text-xl font-orbitron font-bold neon-text-cyan flex items-center gap-4">NEURAL ARCHIVE</h2>
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
          </main>
        )}

        {currentDetection && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[92%] max-w-md pointer-events-auto animate-in slide-in-from-bottom-12 fade-in duration-700">
            <div onClick={() => setActiveMonster(currentDetection)} className="bg-black/70 backdrop-blur-2xl border-2 border-cyan-500/50 rounded-2xl p-5 shadow-[0_0_80px_rgba(0,242,255,0.4)] flex items-center gap-5 cursor-pointer hover:border-white transition-all group outline-none">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/20 shrink-0 relative">
                <img src={currentDetection.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
              </div>
              <div className="flex-1">
                <h3 className="font-orbitron font-bold text-2xl neon-text-cyan uppercase leading-none">{currentDetection.name}</h3>
                <div className="flex gap-1.5 mt-2.5">
                  {currentDetection.types.map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 bg-cyan-900/50 border border-cyan-500/30 text-cyan-200 font-bold uppercase tracking-widest rounded">{t}</span>
                  ))}
                </div>
                <p className="text-[11px] text-white/50 mt-4 font-mono line-clamp-2 italic">Object: {currentDetection.originalObject}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {(status === AppStatus.EVOLVING || status === AppStatus.GENERATING_VISUAL) && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
          <div className="relative w-64 h-64 flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full animate-[spin_6s_linear_infinite]"></div>
            <span className="font-orbitron text-2xl font-black neon-text-cyan tracking-[0.2em] animate-pulse">{status === AppStatus.EVOLVING ? 'ANALYZING' : 'SYNTHESIZING'}</span>
          </div>
        </div>
      )}

      {activeMonster && <MonsterModal monster={activeMonster} onClose={() => setActiveMonster(null)} />}
    </div>
  );
};

export default App;

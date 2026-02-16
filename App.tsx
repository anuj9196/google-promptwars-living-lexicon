
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, Monster } from './types';
import { analyzeImage, generateMonsterVisual, getLoreAudio, cloudLogger, storageService } from './services/geminiService';
import MonsterCard from './components/MonsterCard';
import MonsterModal from './components/MonsterModal';
import ScannerOverlay from './components/ScannerOverlay';
import TutorialOverlay from './components/TutorialOverlay';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [collection, setCollection] = useState<Monster[]>([]);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [currentDetection, setCurrentDetection] = useState<Monster | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [isFixating, setIsFixating] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [telemetryTime, setTelemetryTime] = useState(Date.now());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ensureApiKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) await (window as any).aistudio.openSelectKey();
    }
    return true;
  };

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cyberdex_collection');
    if (saved) try { setCollection(JSON.parse(saved)); } catch (e) { console.error(e); }

    const hasSeenTutorial = localStorage.getItem('has_seen_tutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }

    const tInterval = setInterval(() => setTelemetryTime(Date.now()), 2000);
    return () => clearInterval(tInterval);
  }, []);

  useEffect(() => {
    localStorage.setItem('cyberdex_collection', JSON.stringify(collection));
  }, [collection]);

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('has_seen_tutorial', 'true');
    initAudio();
  };

  useEffect(() => {
    const isOpticalMode = [AppStatus.AR_MODE, AppStatus.STAGING_TO_GCS, AppStatus.EVOLVING, AppStatus.GENERATING_VISUAL, AppStatus.LOGGING_METRICS].includes(status) || !!currentDetection;
    if (isOpticalMode) {
      if (!streamRef.current) {
        const initCamera = async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
            });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
          } catch (err: any) {
            cloudLogger.log('ERROR', 'Camera Permissions Denied', { error: err.name });
            setErrorMessage("NEURAL LINK DENIED: Please enable camera access.");
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
          return prev + 2.5;
        });
      }, 60);
    } else if (!isFixating) {
      setScanProgress(0);
    }
    return () => clearInterval(interval);
  }, [status, isFixating, currentDetection, activeMonster]);

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
      setStatus(AppStatus.STAGING_TO_GCS);
      await storageService.uploadToStaging(base64, `scan_${Date.now()}`);

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

      setStatus(AppStatus.LOGGING_METRICS);
      cloudLogger.log('INFO', 'New Monster Cataloged', { monsterId: fullMonster.id, name: fullMonster.name });
      await new Promise(r => setTimeout(r, 600));

      setCollection(prev => [fullMonster, ...prev]);
      displayDetection(fullMonster);
    } catch (err: any) {
      cloudLogger.log('ERROR', 'Processing Pipeline Failure', { error: err.message });
      setErrorMessage(`SYSTEM FAILURE: ${err.message || 'Signal lost'}`);
      setStatus(AppStatus.AR_MODE);
    }
  };

  const displayDetection = async (monster: Monster) => {
    setCurrentDetection(monster);
    setStatus(AppStatus.AR_MODE);
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
    if (audioSourceRef.current) audioSourceRef.current.stop();
    setCurrentDetection(null);
    setScanProgress(0);
    setIsFixating(false);
  }, []);

  return (
    <div className="relative min-h-screen w-screen bg-[#05070a] text-white overflow-x-hidden flex flex-col font-inter select-none">
      
      {showTutorial && <TutorialOverlay onDismiss={dismissTutorial} />}

      {/* ERROR HUD */}
      {errorMessage && (
        <div role="alert" className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] w-[90%] max-w-xl animate-in slide-in-from-top-4 duration-500">
          <div className="bg-red-950/80 backdrop-blur-2xl border border-red-500/50 p-4 rounded-xl flex items-center justify-between shadow-2xl">
            <span className="font-orbitron text-[10px] tracking-widest text-red-100 uppercase">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="p-2 text-red-400 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}

      {/* PHOTONIC BACKGROUND & VIEWPORT */}
      <div 
        onPointerDown={() => status === AppStatus.AR_MODE && setIsFixating(true)}
        onPointerUp={() => setIsFixating(false)}
        className={`fixed inset-0 z-0 transition-opacity duration-1000 ${[AppStatus.AR_MODE, AppStatus.STAGING_TO_GCS, AppStatus.EVOLVING, AppStatus.GENERATING_VISUAL, AppStatus.LOGGING_METRICS].includes(status) || currentDetection ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover grayscale-[15%] brightness-[0.7] contrast-[1.1]" />
        <canvas ref={canvasRef} className="hidden" />
        <ScannerOverlay isFixating={isFixating} progress={scanProgress} />
      </div>

      {/* NEURAL INTERFACE LAYER */}
      <div className="relative z-10 flex-1 flex flex-col pointer-events-auto">
        <header className="p-6 md:p-8 flex justify-between items-start">
          <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center">
               <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L12 22M2 12L22 12M12 2L19 9M12 22L5 15M2 12L9 5M22 12L15 19"/></svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-orbitron font-bold neon-text-cyan tracking-widest leading-none">LEXICON <span className="text-magenta-500">2026</span></h1>
              <p className="text-[9px] font-mono text-cyan-400/60 tracking-[0.2em] mt-1.5 uppercase">Vertex Managed AI Service</p>
            </div>
          </div>
          
          {status !== AppStatus.IDLE && (
            <button onClick={() => { setStatus(AppStatus.IDLE); clearTarget(); }} className="bg-red-900/50 border border-red-500/40 px-6 py-3 rounded-xl font-orbitron text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-red-800 transition-colors">Exit Interface</button>
          )}
        </header>

        {status === AppStatus.IDLE && !currentDetection && !activeMonster && (
          <main className="flex-1 flex flex-col items-center p-6 animate-in fade-in duration-1000">
            <div className="max-w-7xl w-full grid lg:grid-cols-[1fr_350px] gap-12 items-start">
              
              {/* Center Action Zone */}
              <div className="flex flex-col items-center justify-center py-12 lg:py-24">
                <div className="relative group mb-16">
                   {/* Background Glow */}
                   <div className="absolute -inset-24 bg-cyan-500/5 rounded-full blur-[100px] group-hover:bg-cyan-500/15 transition-all duration-1000"></div>
                   
                   <button 
                    onClick={() => { ensureApiKey(); setStatus(AppStatus.AR_MODE); }} 
                    className="relative z-20 w-80 h-80 rounded-full bg-black/40 backdrop-blur-3xl border-2 border-cyan-500/20 flex flex-col items-center justify-center hover:border-cyan-400 hover:scale-105 transition-all shadow-[0_0_100px_rgba(0,242,255,0.1)] overflow-hidden group"
                   >
                    {/* Animated Photonic Iris */}
                    <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none" viewBox="0 0 200 200">
                       <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-cyan-500/10" />
                       <g className="animate-[spin_20s_linear_infinite]">
                         <path d="M100 20 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" strokeWidth="1" className="text-cyan-400/40" />
                         <path d="M100 180 A 80 80 0 0 1 20 100" fill="none" stroke="currentColor" strokeWidth="1" className="text-magenta-400/40" />
                       </g>
                       <g className="animate-[spin_15s_linear_infinite_reverse]">
                         <path d="M100 40 A 60 60 0 0 1 160 100" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="10 5" className="text-cyan-500/20" />
                       </g>
                    </svg>

                    <div className="relative z-30 flex flex-col items-center gap-6">
                      <div className="w-24 h-24 rounded-full border-2 border-cyan-400/30 flex items-center justify-center bg-cyan-400/5 group-hover:bg-cyan-400/10 transition-colors shadow-[0_0_30px_rgba(0,242,255,0.2)]">
                        <svg className="w-12 h-12 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <span className="font-orbitron font-bold text-cyan-400 tracking-[0.5em] text-xs uppercase block">Initialize Optics</span>
                        <span className="text-[10px] font-mono text-cyan-600/60 uppercase tracking-widest mt-2 block">Link Status: Ready</span>
                      </div>
                    </div>
                  </button>
                </div>

                <section className="w-full">
                  <div className="flex items-center justify-between mb-10 border-b border-white/10 pb-6">
                    <h2 className="text-2xl font-orbitron font-bold neon-text-cyan flex items-center gap-5">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_#00f2ff] animate-pulse"></div>
                      NEURAL ARCHIVE
                    </h2>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-cyan-500 text-[10px] uppercase tracking-[0.3em]">Symbols Recovered</span>
                      <span className="font-orbitron text-xl font-bold leading-none">{collection.length.toString().padStart(2, '0')}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                    {collection.map(monster => ( monster.id && <MonsterCard key={monster.id} monster={monster} onClick={() => setActiveMonster(monster)} /> ))}
                    {collection.length === 0 && (
                      <div className="col-span-full py-32 border border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-30">
                        <svg className="w-16 h-16 text-white mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        <span className="font-orbitron text-xs tracking-[0.5em] uppercase">No neural data detected</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Sidebar Telemetry */}
              <aside className="hidden lg:flex flex-col gap-8 sticky top-12">
                <div className="p-8 bg-black/50 border border-cyan-500/10 rounded-[2.5rem] space-y-8 backdrop-blur-3xl shadow-2xl">
                  <header className="flex justify-between items-center">
                    <h3 className="font-orbitron text-[11px] font-bold text-magenta-500 tracking-[0.5em] uppercase">Telemetry</h3>
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-cyan-500/40"></div>
                      <div className="w-1 h-3 bg-cyan-500/20"></div>
                    </div>
                  </header>
                  
                  <div className="space-y-6">
                    <TelemetryItem label="GCS Sync Buffer" value="98.2%" status="Optimal" color="cyan" />
                    <TelemetryItem label="Vertex AI Latency" value={`${(Math.random() * 50 + 100).toFixed(0)}ms`} status="Fast" color="cyan" />
                    <TelemetryItem label="Entropy Baseline" value="0.0034" status="Stable" color="magenta" />
                  </div>

                  <div className="pt-8 border-t border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Archive_Load</span>
                       <span className="text-[10px] font-mono text-cyan-400">0.02 TB / 1.0 PT</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-gradient-to-r from-cyan-600 to-magenta-600 w-1/12 animate-pulse"></div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 pt-2">
                       {[...Array(8)].map((_, i) => (
                         <div key={i} className={`h-1 rounded-sm transition-colors duration-1000 ${telemetryTime % (i + 1) === 0 ? 'bg-cyan-500/40' : 'bg-white/5'}`}></div>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-magenta-500/5 border border-magenta-500/20 rounded-3xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-2 opacity-30 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-magenta-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <p className="text-[10px] text-magenta-400/80 leading-relaxed font-mono tracking-tight">
                     <span className="font-bold text-magenta-500">PROTOCOL NOTICE:</span> Neural evolution results are permanent. GCS staging is encrypted via Cloud KMS.
                   </p>
                </div>
              </aside>

            </div>
          </main>
        )}

        {currentDetection && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[92%] max-w-md animate-in slide-in-from-bottom-12 duration-700">
            <div onClick={() => setActiveMonster(currentDetection)} className="bg-black/70 backdrop-blur-3xl border-2 border-cyan-500/50 rounded-3xl p-6 flex items-center gap-6 cursor-pointer hover:border-white hover:shadow-[0_0_50px_rgba(0,242,255,0.2)] transition-all">
              <div className="relative">
                <div className="absolute -inset-1 bg-cyan-500/20 rounded-2xl animate-pulse"></div>
                <img src={currentDetection.imageUrl} className="w-24 h-24 rounded-2xl object-cover relative z-10" alt="" />
              </div>
              <div className="flex-1">
                <span className="text-[9px] font-mono text-cyan-500/60 uppercase tracking-[0.3em]">New Detection</span>
                <h3 className="font-orbitron font-bold text-2xl neon-text-cyan uppercase leading-none mt-1">{currentDetection.name}</h3>
                <div className="flex gap-1.5 mt-3">
                  {currentDetection.types.map(t => <span key={t} className="text-[9px] px-2.5 py-1 bg-cyan-900/40 border border-cyan-500/30 text-cyan-200 uppercase rounded-md font-bold">{t}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PIPELINE PROGRESS HUD */}
      {[AppStatus.STAGING_TO_GCS, AppStatus.EVOLVING, AppStatus.GENERATING_VISUAL, AppStatus.LOGGING_METRICS].includes(status) && (
        <div className="fixed inset-0 z-[200] bg-[#05070a]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center">
          <div className="relative w-64 h-64 mb-16">
             <div className="absolute inset-0 border-[8px] border-cyan-500/5 rounded-full"></div>
             <div className="absolute inset-0 border-t-[8px] border-cyan-400 rounded-full animate-spin shadow-[0_0_40px_rgba(0,242,255,0.4)]"></div>
             <div className="absolute inset-12 border border-magenta-500/20 rounded-full animate-[spin_4s_linear_infinite_reverse]"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-cyan-400 rounded-full animate-ping"></div>
             </div>
          </div>
          <div className="space-y-6 max-w-md">
            <h2 className="font-orbitron text-3xl font-black neon-text-cyan tracking-widest uppercase animate-pulse italic">
              {status === AppStatus.STAGING_TO_GCS && 'Staging to GCS'}
              {status === AppStatus.EVOLVING && 'Neural Evolution'}
              {status === AppStatus.GENERATING_VISUAL && 'Imagen 4.0 Synthesis'}
              {status === AppStatus.LOGGING_METRICS && 'Finalizing Metrics'}
            </h2>
            <p className="text-slate-500 text-xs font-mono uppercase tracking-[0.2em]">
               {status === AppStatus.STAGING_TO_GCS && 'Ingesting photonic raw data into lexicon-raw-ingest...'}
               {status === AppStatus.EVOLVING && 'Analyzing entropy signatures via Gemini 3 Flash...'}
               {status === AppStatus.GENERATING_VISUAL && 'Synthesizing higher lifeform visuals via Vertex AI...'}
               {status === AppStatus.LOGGING_METRICS && 'Submitting structured audit logs to Cloud Logging...'}
            </p>
            <div className="flex flex-col gap-2 items-center font-mono text-[10px] text-cyan-500/40 tracking-[0.4em] pt-8">
               <span className="flex items-center gap-3">
                 <div className={`w-2 h-2 rounded-full ${status !== AppStatus.STAGING_TO_GCS ? 'bg-cyan-500 shadow-[0_0_10px_#00f2ff]' : 'bg-white/10 animate-pulse'}`}></div>
                 Bucket: [lexicon-raw-ingest]
               </span>
               <span className="flex items-center gap-3">
                 <div className={`w-2 h-2 rounded-full ${[AppStatus.GENERATING_VISUAL, AppStatus.LOGGING_METRICS].includes(status) ? 'bg-cyan-500 shadow-[0_0_10px_#00f2ff]' : 'bg-white/10'}`}></div>
                 Model: [vertex.imagen-4]
               </span>
               <span className="flex items-center gap-3">
                 <div className={`w-2 h-2 rounded-full ${status === AppStatus.LOGGING_METRICS ? 'bg-cyan-500 shadow-[0_0_10px_#00f2ff]' : 'bg-white/10'}`}></div>
                 Sink: [logging-sink-v2]
               </span>
            </div>
          </div>
        </div>
      )}

      {activeMonster && <MonsterModal monster={activeMonster} onClose={() => setActiveMonster(null)} />}
    </div>
  );
};

const TelemetryItem: React.FC<{ label: string, value: string, status: string, color: 'cyan' | 'magenta' }> = ({ label, value, status, color }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest">
      <span className="text-slate-500">{label}</span>
      <span className={color === 'cyan' ? 'text-cyan-400 font-bold' : 'text-magenta-400 font-bold'}>{value}</span>
    </div>
    <div className="flex justify-between items-center gap-4">
      <div className={`flex-1 h-1 rounded-full ${color === 'cyan' ? 'bg-cyan-500/10' : 'bg-magenta-500/10'}`}>
        <div className={`h-full rounded-full ${color === 'cyan' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(0,242,255,0.6)]' : 'bg-magenta-400 shadow-[0_0_8px_rgba(255,0,255,0.6)]'} w-4/5 transition-all duration-1000`}></div>
      </div>
      <span className="text-[9px] font-mono text-slate-600 uppercase italic leading-none">[{status}]</span>
    </div>
  </div>
);

export default App;

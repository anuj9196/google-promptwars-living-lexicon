
import React, { useEffect } from 'react';
import { Monster } from '../types';

interface MonsterModalProps {
  monster: Monster;
  onClose: () => void;
}

const MonsterModal: React.FC<MonsterModalProps> = ({ monster, onClose }) => {
  // Lock scroll on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-[#0a0f18]/90 border border-cyan-500/30 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,242,255,0.2)] flex flex-col lg:flex-row pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Navigation Control */}
        <button 
          onClick={onClose}
          aria-label="Close Neural Log"
          className="absolute top-6 right-6 z-[110] w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-red-600/50 hover:border-red-500/50 transition-all shadow-xl group focus:ring-2 focus:ring-red-400 outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Photonic Visualizer */}
        <div className="w-full lg:w-1/2 p-8 lg:p-14 flex flex-col justify-center items-center bg-gradient-to-br from-[#000d1a] to-[#05070a] border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(0,242,255,0.05),_transparent)] pointer-events-none"></div>
          <div className="relative w-full max-w-md aspect-square group">
            <div className="absolute -inset-6 border border-cyan-500/10 rounded-full animate-pulse"></div>
            <div className="absolute -inset-1 border border-cyan-500/30 rounded-3xl group-hover:border-cyan-400 transition-colors"></div>
            <img 
              src={monster.imageUrl} 
              alt={monster.name} 
              className="w-full h-full object-cover rounded-2xl shadow-2xl relative z-10 brightness-110 group-hover:scale-[1.03] transition-transform duration-1000"
            />
            <div className="absolute -bottom-8 -left-8 px-6 py-3 bg-black/95 backdrop-blur-2xl border border-magenta-500/50 rounded-2xl z-20 shadow-2xl">
              <span className="text-[10px] font-orbitron text-magenta-400 block opacity-60 uppercase tracking-[0.3em] mb-1 leading-none">Scanning Source</span>
              <span className="text-white font-black font-orbitron text-lg tracking-tight uppercase">{monster.originalObject}</span>
            </div>
          </div>
        </div>

        {/* Neural Data Array */}
        <div className="w-full lg:w-1/2 p-8 lg:p-14 flex flex-col gap-8 bg-[#0a0f18]/40 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-1 bg-cyan-500 rounded-full"></div>
              <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-[0.5em]">Entity identified</span>
            </div>
            <h2 id="modal-title" className="text-5xl font-orbitron font-black neon-text-cyan tracking-tighter uppercase leading-[0.85]">
              {monster.name}
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {monster.types.map(type => (
                <span key={type} className="px-4 py-1.5 bg-cyan-950/40 text-cyan-200 border border-cyan-500/40 rounded-full font-orbitron text-[11px] font-bold uppercase tracking-[0.2em] shadow-sm">
                  {type}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[11px] font-orbitron text-magenta-500 tracking-[0.5em] uppercase opacity-90 font-bold">Lore Reconstruction</h4>
            <p className="text-slate-300 font-light leading-relaxed italic border-l-2 border-cyan-500/40 pl-6 py-2 text-base bg-white/5 rounded-r-xl">
              {monster.lore}
            </p>
          </div>

          <div className="space-y-5">
            <h4 className="text-[11px] font-orbitron text-cyan-500 tracking-[0.5em] uppercase opacity-90 font-bold">Tactical Modules</h4>
            <div className="grid gap-3">
              {monster.moves.map((move, idx) => (
                <div key={idx} className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl group hover:bg-white/[0.07] transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-orbitron font-bold text-sm text-white uppercase tracking-wider">{move.name}</span>
                    <span className="font-mono text-[10px] text-cyan-400 font-bold">PWR {move.power}</span>
                  </div>
                  <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.4)] transition-all duration-1000" 
                      style={{ width: `${move.power}%` }}
                    ></div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 font-mono italic leading-tight">{move.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-8 flex justify-between items-center border-t border-white/5 opacity-40 font-mono text-[9px] uppercase tracking-[0.3em]">
            <span>NODE_ID: {monster.id.split('-')[0]}</span>
            <span>TS: {new Date(monster.capturedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonsterModal;

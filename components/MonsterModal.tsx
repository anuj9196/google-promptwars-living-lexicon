
import React from 'react';
import { Monster } from '../types';

interface MonsterModalProps {
  monster: Monster;
  onClose: () => void;
}

const MonsterModal: React.FC<MonsterModalProps> = ({ monster, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950/80 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.4)] flex flex-col md:flex-row pointer-events-auto">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-red-500/50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Visual Panel */}
        <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center items-center bg-gradient-to-br from-black to-slate-900 border-b md:border-b-0 md:border-r border-cyan-500/10">
          <div className="relative w-full max-w-sm aspect-square group">
            <div className="absolute -inset-4 border border-cyan-500/20 rounded-2xl animate-pulse"></div>
            <img 
              src={monster.imageUrl} 
              alt={monster.name} 
              className="w-full h-full object-cover rounded-lg shadow-2xl relative z-10 brightness-110 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute -bottom-6 -left-6 px-4 py-2 bg-black/90 backdrop-blur border border-magenta-500/50 rounded-lg z-20 shadow-xl">
              <span className="text-[10px] font-orbitron text-magenta-400 block opacity-60 uppercase tracking-tighter">Scan Source</span>
              <span className="text-white font-bold font-orbitron text-sm">{monster.originalObject}</span>
            </div>
          </div>
        </div>

        {/* Data Panel */}
        <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col gap-6 overflow-y-auto">
          <div className="space-y-2">
            <h2 className="text-4xl font-orbitron font-black neon-text-cyan tracking-tighter uppercase leading-none">
              {monster.name}
            </h2>
            <div className="flex gap-2">
              {monster.types.map(type => (
                <span key={type} className="px-3 py-1 bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 rounded-full font-orbitron text-[10px] font-bold uppercase tracking-widest">
                  {type}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-orbitron text-magenta-500 tracking-[0.4em] uppercase opacity-80">Neural Lore Log</h4>
            <p className="text-slate-300 font-light leading-relaxed italic border-l-2 border-cyan-500/30 pl-4 py-1 text-sm">
              {monster.lore}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-orbitron text-cyan-500 tracking-[0.4em] uppercase opacity-80">Abilities</h4>
            <div className="grid gap-2">
              {monster.moves.map((move, idx) => (
                <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-orbitron font-bold text-xs text-white uppercase">{move.name}</span>
                    <span className="font-mono text-[10px] text-cyan-400">PWR {move.power}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500/60" style={{ width: `${move.power}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-6 flex justify-between items-center border-t border-white/5 opacity-40 font-mono text-[8px] uppercase tracking-widest">
            <span>Neural_ID: {monster.id.split('-')[0]}</span>
            <span>Captured: {new Date(monster.capturedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonsterModal;

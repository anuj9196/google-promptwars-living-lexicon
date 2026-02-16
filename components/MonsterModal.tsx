
import React from 'react';
import { Monster } from '../types';

interface MonsterModalProps {
  monster: Monster;
  onClose: () => void;
}

const MonsterModal: React.FC<MonsterModalProps> = ({ monster, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-950 border-2 border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col md:flex-row">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Visual Panel */}
        <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 to-black border-b md:border-b-0 md:border-r border-cyan-500/10">
          <div className="relative w-full max-w-sm aspect-square">
            {/* Holographic frame */}
            <div className="absolute -inset-4 border border-cyan-500/20 rounded-2xl animate-pulse"></div>
            <div className="absolute -inset-1 border border-magenta-500/30 rounded-xl"></div>
            
            <img 
              src={monster.imageUrl} 
              alt={monster.name} 
              className="w-full h-full object-cover rounded-lg shadow-2xl relative z-10"
            />

            {/* Floating particles or UI elements */}
            <div className="absolute -bottom-6 -left-6 px-4 py-2 bg-black/80 backdrop-blur border border-cyan-500/50 rounded-lg z-20">
              <span className="text-[10px] font-orbitron text-cyan-400 tracking-tighter block opacity-60 uppercase">Origin Object</span>
              <span className="text-white font-bold">{monster.originalObject}</span>
            </div>
          </div>
        </div>

        {/* Data Panel */}
        <div className="w-full md:w-1/2 p-6 md:p-10 bg-slate-950 flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl md:text-5xl font-orbitron font-black neon-text-cyan tracking-tighter uppercase">
              {monster.name}
            </h2>
            <div className="flex gap-2">
              {monster.types.map(type => (
                <span key={type} className="px-3 py-1 bg-cyan-900/40 text-cyan-300 border border-cyan-500/40 rounded-full font-orbitron text-xs font-bold uppercase tracking-wider">
                  {type}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-orbitron text-magenta-500 tracking-[0.3em] uppercase">Pokedex Data • 2026</h4>
            <p className="text-slate-300 font-light leading-relaxed italic border-l-2 border-magenta-500/50 pl-4 py-1">
              {monster.lore}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-orbitron text-cyan-500 tracking-[0.3em] uppercase">Combat Abilities</h4>
            <div className="grid gap-3">
              {monster.moves.map((move, idx) => (
                <div key={idx} className="group p-3 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-500/50 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-orbitron font-bold text-white uppercase group-hover:text-cyan-300">{move.name}</span>
                    <span className="font-mono text-cyan-400 font-bold px-2 py-0.5 bg-cyan-400/10 rounded">PWR {move.power}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{move.description}</p>
                  {/* Power bar */}
                  <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000" 
                      style={{ width: `${Math.min(move.power, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-6 flex justify-between items-center border-t border-white/5">
            <div className="text-slate-600 font-mono text-[10px]">
              ID: {monster.id.substring(0, 13)}...
            </div>
            <div className="text-slate-600 font-mono text-[10px]">
              TIMESTAMP: {new Date(monster.capturedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonsterModal;

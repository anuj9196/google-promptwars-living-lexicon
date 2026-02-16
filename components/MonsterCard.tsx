
import React from 'react';
import { Monster } from '../types';

interface MonsterCardProps {
  monster: Monster;
  onClick: () => void;
}

const MonsterCard: React.FC<MonsterCardProps> = ({ monster, onClick }) => {
  return (
    <div 
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${monster.name}, evolved from ${monster.originalObject}`}
      className="relative bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden group cursor-pointer hover:border-cyan-500/60 transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] focus:ring-2 focus:ring-cyan-500 outline-none"
    >
      {/* Visual Header */}
      <div className="aspect-square relative overflow-hidden bg-slate-950">
        <img 
          src={monster.imageUrl} 
          alt={monster.name} 
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90 group-hover:opacity-100 brightness-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-40 group-hover:opacity-100 transition-opacity"></div>
        
        {/* Type Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {monster.types.map(type => (
            <span 
              key={type} 
              className="text-[9px] font-orbitron font-bold px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-cyan-500/40 text-cyan-300 uppercase tracking-widest shadow-lg"
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Metadata Footer */}
      <div className="p-5 bg-black/60 backdrop-blur-xl border-t border-white/5">
        <h3 className="font-orbitron text-xl font-bold text-white group-hover:neon-text-cyan transition-colors truncate tracking-tighter uppercase leading-none mb-2">
          {monster.name}
        </h3>
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-mono leading-none">
          Evolved from <span className="text-white/60">{monster.originalObject}</span>
        </p>
      </div>

      {/* HUD Accent */}
      <div className="absolute bottom-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
        <div className="w-1.5 h-1.5 bg-cyan-400 rotate-45"></div>
      </div>
    </div>
  );
};

export default MonsterCard;

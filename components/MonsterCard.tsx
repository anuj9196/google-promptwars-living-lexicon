
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
      className="relative bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden group cursor-pointer hover:border-cyan-500/50 transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
    >
      {/* Type Badges - Small */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {monster.types.map(type => (
          <span 
            key={type} 
            className="text-[10px] font-orbitron font-bold px-2 py-0.5 rounded bg-black/60 border border-cyan-500/30 text-cyan-400 uppercase"
          >
            {type}
          </span>
        ))}
      </div>

      <div className="aspect-square relative overflow-hidden bg-slate-950">
        <img 
          src={monster.imageUrl} 
          alt={monster.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>

      <div className="p-4 bg-black/40 backdrop-blur-md">
        <h3 className="font-orbitron text-lg font-bold text-white group-hover:neon-text-cyan transition-colors truncate">
          {monster.name}
        </h3>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">
          Evolved from {monster.originalObject}
        </p>
      </div>

      {/* Decorative corner accent */}
      <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
        <div className="absolute bottom-1 right-1 w-2 h-2 bg-cyan-500/40 rotate-45"></div>
      </div>
    </div>
  );
};

export default MonsterCard;

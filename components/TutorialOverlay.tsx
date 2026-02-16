
import React from 'react';

interface TutorialOverlayProps {
  onDismiss: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onDismiss }) => {
  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none"></div>
      
      <div className="max-w-2xl w-full bg-[#0a0f18] border border-cyan-500/30 rounded-[2rem] p-8 md:p-12 shadow-[0_0_100px_rgba(0,242,255,0.1)] relative overflow-hidden">
        {/* Decorative HUD bits */}
        <div className="absolute top-0 left-0 w-24 h-1 bg-cyan-500/50"></div>
        <div className="absolute top-0 left-0 w-1 h-24 bg-cyan-500/50"></div>
        <div className="absolute bottom-0 right-0 w-24 h-1 bg-magenta-500/50"></div>
        <div className="absolute bottom-0 right-0 w-1 h-24 bg-magenta-500/50"></div>

        <div className="space-y-8 relative z-10">
          <header className="text-center space-y-2">
            <span className="text-[10px] font-mono text-magenta-500 tracking-[0.6em] uppercase animate-pulse">Neural Handbook v2.026</span>
            <h2 className="text-4xl md:text-5xl font-orbitron font-black neon-text-cyan tracking-tighter uppercase italic">OPERATION LEXICON</h2>
          </header>

          <div className="grid gap-6">
            <Step 
              num="01" 
              title="OPTICS LINK" 
              desc="Click the central core to initialize your device's photonic sensor array and enter the AR discovery layer." 
              color="cyan"
            />
            <Step 
              num="02" 
              title="NEURAL FIXATION" 
              desc="Identify an object. You MUST PRESS AND HOLD the screen for 3 seconds to lock the neural link. Moving the lens will break the sync." 
              color="magenta"
            />
            <Step 
              num="03" 
              title="VERTEX SYNTHESIS" 
              desc="Once fixated, Vertex AI analyzes the target's entropy, staging data to GCS before Imagen 4.0 evolves it into a higher lifeform." 
              color="cyan"
            />
            <Step 
              num="04" 
              title="DATA RECOVERY" 
              desc="Listen to the Neural Scan Report and review tactical moves. All discovered entities are archived in your persistent Lexicon." 
              color="magenta"
            />
          </div>

          <button 
            onClick={onDismiss}
            className="w-full py-5 bg-cyan-500/10 border-2 border-cyan-500/50 rounded-2xl font-orbitron font-bold text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 transition-all tracking-[0.4em] uppercase text-sm mt-4 shadow-[0_0_30px_rgba(0,242,255,0.1)] active:scale-[0.98] outline-none"
          >
            System Initialize
          </button>
        </div>
      </div>
    </div>
  );
};

const Step: React.FC<{ num: string, title: string, desc: string, color: 'cyan' | 'magenta' }> = ({ num, title, desc, color }) => (
  <div className="flex gap-6 group">
    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 font-orbitron font-bold text-lg transition-colors ${color === 'cyan' ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5' : 'border-magenta-500/30 text-magenta-400 bg-magenta-500/5'}`}>
      {num}
    </div>
    <div className="space-y-1">
      <h4 className={`font-orbitron font-bold text-xs tracking-widest uppercase ${color === 'cyan' ? 'text-cyan-400' : 'text-magenta-400'}`}>
        {title}
      </h4>
      <p className="text-slate-400 text-[11px] leading-relaxed font-inter">
        {desc}
      </p>
    </div>
  </div>
);

export default TutorialOverlay;

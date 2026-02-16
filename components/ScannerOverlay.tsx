
import React from 'react';

interface ScannerOverlayProps {
  isFixating?: boolean;
  progress?: number;
}

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({ isFixating = false, progress = 0 }) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Central Viewport */}
      <div className={`w-[85vw] h-[70vh] max-w-lg border transition-colors duration-500 relative ${isFixating ? 'border-cyan-400/50 shadow-[0_0_30px_rgba(0,242,255,0.2)]' : 'border-white/10'}`}>
        
        {/* Scanning Line - Only active during fixation */}
        {isFixating && (
          <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-400 shadow-[0_0_15px_#00f2ff] animate-[scan_3s_linear_infinite]"></div>
        )}
        <style>{`
          @keyframes scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `}</style>

        {/* Brackets */}
        <div className={`absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 transition-colors duration-300 ${isFixating ? 'border-cyan-400 shadow-[0_0_15px_#00f2ff]' : 'border-cyan-500/30'}`}></div>
        <div className={`absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 transition-colors duration-300 ${isFixating ? 'border-cyan-400 shadow-[0_0_15px_#00f2ff]' : 'border-cyan-500/30'}`}></div>
        <div className={`absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 transition-colors duration-300 ${isFixating ? 'border-magenta-400 shadow-[0_0_15px_#ff00ff]' : 'border-magenta-500/30'}`}></div>
        <div className={`absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 transition-colors duration-300 ${isFixating ? 'border-magenta-400 shadow-[0_0_15px_#ff00ff]' : 'border-magenta-500/30'}`}></div>

        {/* HUD Stats Left */}
        <div className="absolute left-4 top-1/4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-1 bg-cyan-500/20 rounded-full overflow-hidden">
              <div className={`h-full bg-cyan-400 transition-all duration-300 ${isFixating ? 'w-full shadow-[0_0_10px_#00f2ff]' : 'w-[20%]'}`}></div>
            </div>
            <span className={`text-[8px] font-mono tracking-widest uppercase transition-colors ${isFixating ? 'text-cyan-400' : 'text-cyan-500/40'}`}>Depth.Scan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-1 bg-magenta-500/20 rounded-full overflow-hidden">
              <div className={`h-full bg-magenta-400 transition-all duration-300 ${isFixating ? 'w-full shadow-[0_0_10px_#ff00ff]' : 'w-[10%]'}`}></div>
            </div>
            <span className={`text-[8px] font-mono tracking-widest uppercase transition-colors ${isFixating ? 'text-magenta-400' : 'text-magenta-500/40'}`}>Entity.Prob</span>
          </div>
        </div>

        {/* HUD Stats Right */}
        <div className="absolute right-4 bottom-1/4 flex flex-col items-end gap-2 text-[8px] font-mono uppercase tracking-widest transition-opacity duration-300">
          <span className={isFixating ? 'text-cyan-400' : 'text-white/20'}>Target_Locked: [{isFixating ? 'True' : 'False'}]</span>
          <span className="text-white/20">Protocol: [Neural_Sync]</span>
          <span className={isFixating ? 'text-magenta-400 animate-pulse' : 'text-white/20'}>Status: [{isFixating ? 'Syncing...' : 'Standby'}]</span>
        </div>

        {/* Central Crosshair */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isFixating ? 'opacity-80' : 'opacity-20'}`}>
           <div className={`w-16 h-16 border rounded-full flex items-center justify-center transition-all duration-500 ${isFixating ? 'border-cyan-400 scale-125' : 'border-white/20 scale-100'}`}>
             <div className={`w-1 h-1 rounded-full ${isFixating ? 'bg-magenta-400 animate-ping' : 'bg-white/40'}`}></div>
           </div>
           <div className="absolute w-[200%] h-[1px] bg-white/5"></div>
           <div className="absolute h-[200%] w-[1px] bg-white/5"></div>
        </div>
      </div>

      {/* Global Vignette */}
      <div className={`absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] transition-opacity duration-1000 ${isFixating ? 'opacity-100' : 'opacity-60'}`}></div>

      {/* Random HUD Bits */}
      <div className="absolute top-10 left-10 text-[10px] font-mono text-cyan-500/50 leading-tight">
        X: {isFixating ? (Math.random() * 100).toFixed(3) : '45.234'}<br/>
        Y: {isFixating ? (Math.random() * 100).toFixed(3) : '12.003'}<br/>
        Z: 00.122
      </div>
      <div className={`absolute bottom-10 right-10 text-[10px] font-mono text-right uppercase transition-colors duration-300 ${isFixating ? 'text-magenta-400' : 'text-magenta-500/30'}`}>
        Neural_Link_Status<br/>
        {isFixating ? `Syncing_${progress.toFixed(1)}%` : 'Link_Awaiting_Hold'}
      </div>
    </div>
  );
};

export default ScannerOverlay;


import React from 'react';

const ScannerOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Central Viewport */}
      <div className="w-[85vw] h-[70vh] max-w-lg border border-white/10 relative">
        
        {/* Scanning Line */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-400/50 shadow-[0_0_15px_#00f2ff] animate-[scan_3s_linear_infinite]"></div>
        <style>{`
          @keyframes scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `}</style>

        {/* Brackets */}
        <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-cyan-500 shadow-[0_0_15px_#00f2ff]"></div>
        <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-cyan-500 shadow-[0_0_15px_#00f2ff]"></div>
        <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-magenta-500 shadow-[0_0_15px_#ff00ff]"></div>
        <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-magenta-500 shadow-[0_0_15px_#ff00ff]"></div>

        {/* HUD Stats Left */}
        <div className="absolute left-4 top-1/4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-1 bg-cyan-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 w-[60%] animate-pulse"></div>
            </div>
            <span className="text-[8px] font-mono text-cyan-400 tracking-widest uppercase">Depth.Scan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-1 bg-magenta-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-magenta-400 w-[85%] animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            </div>
            <span className="text-[8px] font-mono text-magenta-400 tracking-widest uppercase">Entity.Prob</span>
          </div>
        </div>

        {/* HUD Stats Right */}
        <div className="absolute right-4 bottom-1/4 flex flex-col items-end gap-2 text-[8px] font-mono text-white/40 uppercase tracking-widest">
          <span>Target_Locked: [True]</span>
          <span>Environment: [Urban_2026]</span>
          <span>Light_Level: [Optimal]</span>
        </div>

        {/* Central Crosshair */}
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
           <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center">
             <div className="w-1 h-1 bg-magenta-500 rounded-full animate-ping"></div>
           </div>
           <div className="absolute w-[200%] h-[1px] bg-white/5"></div>
           <div className="absolute h-[200%] w-[1px] bg-white/5"></div>
        </div>
      </div>

      {/* Global Vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]"></div>

      {/* Random HUD Bits */}
      <div className="absolute top-10 left-10 text-[10px] font-mono text-cyan-500/50 leading-tight">
        X: 45.234<br/>
        Y: 12.003<br/>
        Z: 00.122
      </div>
      <div className="absolute bottom-10 right-10 text-[10px] font-mono text-magenta-500/50 text-right uppercase">
        Materialization_Protocol_04<br/>
        Neural_Link_Buffer_99.2%
      </div>
    </div>
  );
};

export default ScannerOverlay;

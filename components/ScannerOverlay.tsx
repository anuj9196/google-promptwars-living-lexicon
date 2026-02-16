
import React from 'react';

const ScannerOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Corner Brackets */}
      <div className="w-[80vw] h-[60vh] max-w-md border-2 border-cyan-500/30 relative">
        {/* Scanning Line */}
        <div className="scan-line"></div>

        {/* HUD Elements */}
        <div className="absolute -top-10 left-0 text-cyan-400 font-orbitron text-[10px] tracking-[0.2em] animate-pulse">
          READY_FOR_BIO_SYNC
        </div>
        <div className="absolute -bottom-10 right-0 text-magenta-500 font-orbitron text-[10px] tracking-[0.2em]">
          TARGET_ACQUISITION_ACTIVE
        </div>

        {/* Corner Decorations */}
        <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-cyan-400 shadow-[0_0_10px_#00f2ff]"></div>
        <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-cyan-400 shadow-[0_0_10px_#00f2ff]"></div>
        <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-cyan-400 shadow-[0_0_10px_#00f2ff]"></div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-cyan-400 shadow-[0_0_10px_#00f2ff]"></div>

        {/* Reticle */}
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
           <div className="w-12 h-12 border-2 border-dashed border-white rounded-full animate-ping"></div>
           <div className="absolute w-2 h-2 bg-magenta-500 rounded-full"></div>
        </div>
      </div>

      {/* Side HUD */}
      <div className="absolute left-4 top-1/4 space-y-4 opacity-60 hidden md:block">
        {[1,2,3,4].map(i => (
            <div key={i} className="flex flex-col gap-1">
                <div className="w-8 h-1 bg-cyan-900"></div>
                <div className="w-12 h-1 bg-cyan-600 animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}></div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default ScannerOverlay;

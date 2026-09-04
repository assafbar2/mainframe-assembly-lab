import React from 'react';
import { Terminal, BookOpen, Cpu, Sparkles, Monitor } from 'lucide-react';

interface HeaderProps {
  mode: 'missions' | 'sandbox' | 'architecture';
  setMode: (m: 'missions' | 'sandbox' | 'architecture') => void;
  theme: 'green' | 'amber' | 'cyan';
  setTheme: (t: 'green' | 'amber' | 'cyan') => void;
  scanlines: boolean;
  setScanlines: (s: boolean) => void;
  completedMissionsCount: number;
  totalMissionsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  setMode,
  theme,
  setTheme,
  scanlines,
  setScanlines,
  completedMissionsCount,
  totalMissionsCount,
}) => {
  return (
    <header className="border-b border-[#1c262b] bg-[#0c1013]/90 backdrop-blur px-4 py-2.5 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Title & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-500/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-widest font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                IBM S/370
              </span>
              <h1 className="text-sm md:text-base font-bold tracking-wide text-zinc-100">
                HLASM Mainframe Laboratory
              </h1>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Interactive Architecture Simulator & High Level Assembler Explorer
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-[#131a1f] p-1 rounded-lg border border-[#22313a]">
          <button
            onClick={() => setMode('missions')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              mode === 'missions'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Missions</span>
            <span className="ml-1 text-[10px] px-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              {completedMissionsCount}/{totalMissionsCount}
            </span>
          </button>

          <button
            onClick={() => setMode('sandbox')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              mode === 'sandbox'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Sandbox</span>
          </button>

          <button
            onClick={() => setMode('architecture')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              mode === 'architecture'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Deep Dive</span>
          </button>
        </div>

        {/* Display Settings: Phosphor Theme & Scanlines */}
        <div className="flex items-center gap-3">
          {/* CRT Theme */}
          <div className="flex items-center gap-1 bg-[#131a1f] p-1 rounded border border-[#22313a] text-xs">
            <button
              title="Classic IBM 3270 Green Phosphor"
              onClick={() => setTheme('green')}
              className={`w-5 h-5 rounded-sm flex items-center justify-center transition-all ${
                theme === 'green' ? 'ring-2 ring-emerald-400 bg-emerald-500' : 'bg-emerald-900/60 hover:bg-emerald-800'
              }`}
            />
            <button
              title="IBM Amber Phosphor"
              onClick={() => setTheme('amber')}
              className={`w-5 h-5 rounded-sm flex items-center justify-center transition-all ${
                theme === 'amber' ? 'ring-2 ring-amber-400 bg-amber-500' : 'bg-amber-900/60 hover:bg-amber-800'
              }`}
            />
            <button
              title="Electric Cyan Phosphor"
              onClick={() => setTheme('cyan')}
              className={`w-5 h-5 rounded-sm flex items-center justify-center transition-all ${
                theme === 'cyan' ? 'ring-2 ring-cyan-400 bg-cyan-500' : 'bg-cyan-900/60 hover:bg-cyan-800'
              }`}
            />
          </div>

          {/* CRT Scanline Toggle */}
          <button
            onClick={() => setScanlines(!scanlines)}
            title="Toggle Authentic CRT Scanlines"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-all ${
              scanlines
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-[#131a1f] text-zinc-400 border-[#22313a] hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scanlines</span>
          </button>
        </div>
      </div>
    </header>
  );
};

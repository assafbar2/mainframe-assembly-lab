import React, { useState } from 'react';

interface RegisterGridProps {
  registers: Int32Array;
  lastChangedRegisters: Set<number>;
}

export const RegisterGrid: React.FC<RegisterGridProps> = ({
  registers,
  lastChangedRegisters,
}) => {
  const [displayMode, setDisplayMode] = useState<'hex' | 'dec' | 'both'>('both');

  const getSpecialRole = (r: number): string | null => {
    if (r === 12) return 'BASE';
    if (r === 13) return 'SAVE';
    if (r === 14) return 'RET';
    if (r === 15) return 'RC';
    return null;
  };

  return (
    <div className="bg-[#0b0f12] border border-[#1b252b] rounded-lg p-3 shadow-lg flex flex-col">
      {/* Header with Display Mode Toggle */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1a252b]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            16 GPR Registers (R0 - R15)
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-[#12191e] p-0.5 rounded border border-[#1e2a32] text-[10px]">
          <button
            onClick={() => setDisplayMode('both')}
            className={`px-1.5 py-0.5 rounded transition-all ${
              displayMode === 'both' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-zinc-400'
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setDisplayMode('hex')}
            className={`px-1.5 py-0.5 rounded transition-all ${
              displayMode === 'hex' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-zinc-400'
            }`}
          >
            Hex
          </button>
          <button
            onClick={() => setDisplayMode('dec')}
            className={`px-1.5 py-0.5 rounded transition-all ${
              displayMode === 'dec' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-zinc-400'
            }`}
          >
            Dec
          </button>
        </div>
      </div>

      {/* 4x4 Grid of Registers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
        {Array.from({ length: 16 }).map((_, r) => {
          const val = registers[r];
          const unsigned = val >>> 0;
          const hex = unsigned.toString(16).padStart(8, '0').toUpperCase();
          const role = getSpecialRole(r);
          const isChanged = lastChangedRegisters.has(r);

          return (
            <div
              key={r}
              className={`p-1.5 rounded border transition-all ${
                isChanged
                  ? 'bg-emerald-500/20 border-emerald-400 shadow-sm shadow-emerald-500/20 scale-[1.02]'
                  : 'bg-[#0f1418] border-[#1a252c] hover:border-[#2b3c46]'
              }`}
            >
              {/* Register Label & Special Tag */}
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className={`font-bold ${isChanged ? 'text-emerald-300' : 'text-zinc-400'}`}>
                  R{r}
                </span>
                {role && (
                  <span className="text-[9px] px-1 rounded bg-[#172228] text-amber-400/90 font-semibold border border-amber-500/20">
                    {role}
                  </span>
                )}
              </div>

              {/* Values */}
              <div className="flex flex-col">
                {(displayMode === 'hex' || displayMode === 'both') && (
                  <div className="text-emerald-400 text-xs tracking-wider">
                    <span className="text-emerald-600 text-[10px] select-none">0x</span>
                    {hex}
                  </div>
                )}
                {(displayMode === 'dec' || displayMode === 'both') && (
                  <div className="text-zinc-400 text-[11px] truncate">
                    {val.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

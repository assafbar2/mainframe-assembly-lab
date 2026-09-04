import React, { useState } from 'react';
import { ebcdicByteToChar } from '../core/ebcdic';
import { decodePacked } from '../core/packedDecimal';
import type { MemoryAccess, SymbolEntry } from '../core/types';

interface MemoryViewerProps {
  memory: Uint8Array;
  lastAccesses: MemoryAccess[];
  symbols: Record<string, SymbolEntry>;
}

export const MemoryViewer: React.FC<MemoryViewerProps> = ({
  memory,
  lastAccesses,
  symbols,
}) => {
  const [startOffset, setStartOffset] = useState(0);
  const [charMode, setCharMode] = useState<'ebcdic' | 'ascii'>('ebcdic');
  const [selectedAddr, setSelectedAddr] = useState<number | null>(null);

  const ROWS_TO_SHOW = 12;
  const BYTES_PER_ROW = 16;

  // Build map of accessed addresses for fast visual styling
  const accessMap = new Map<number, 'READ' | 'WRITE'>();
  for (const acc of lastAccesses) {
    for (let i = 0; i < acc.length; i++) {
      accessMap.set(acc.address + i, acc.type === 'WRITE' ? 'WRITE' : 'READ');
    }
  }

  // Symbol jump list
  const symbolList = Object.values(symbols).filter(
    (s) => s.type !== 'EQU' && s.type !== 'LABEL'
  );

  const handleJumpToSymbol = (symName: string) => {
    const sym = symbols[symName];
    if (sym) {
      const aligned = Math.floor(sym.address / 16) * 16;
      setStartOffset(aligned);
      setSelectedAddr(sym.address);
    }
  };

  // Decode selected memory cell
  const getSelectedInspector = () => {
    if (selectedAddr === null || selectedAddr >= memory.length) return null;
    const view = new DataView(memory.buffer);
    const int32Val = selectedAddr <= memory.length - 4 ? view.getInt32(selectedAddr, false) : 0;
    const ebcdicChar = ebcdicByteToChar(memory[selectedAddr]);
    const asciiChar = String.fromCharCode(memory[selectedAddr]);
    const packed3 = selectedAddr <= memory.length - 3 ? decodePacked(memory, selectedAddr, 3) : null;

    return {
      addr: selectedAddr,
      byte: memory[selectedAddr],
      int32: int32Val,
      ebcdic: ebcdicChar,
      ascii: asciiChar,
      packed: packed3,
    };
  };

  const inspect = getSelectedInspector();

  return (
    <div className="bg-[#0b0f12] border border-[#1b252b] rounded-lg p-3 shadow-lg flex flex-col gap-2 font-mono text-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1a252b]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            Mainframe Storage / RAM
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Jump to Symbol */}
          {symbolList.length > 0 && (
            <select
              onChange={(e) => handleJumpToSymbol(e.target.value)}
              className="bg-[#12191e] text-zinc-300 text-[11px] px-2 py-0.5 rounded border border-[#1e2a32] focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>
                Jump to Symbol...
              </option>
              {symbolList.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} (0x{s.address.toString(16).padStart(4, '0').toUpperCase()})
                </option>
              ))}
            </select>
          )}

          {/* EBCDIC vs ASCII Character Encoding Toggle */}
          <div className="flex items-center gap-1 bg-[#12191e] p-0.5 rounded border border-[#1e2a32] text-[10px]">
            <button
              onClick={() => setCharMode('ebcdic')}
              title="IBM Code Page 037 EBCDIC Translation"
              className={`px-1.5 py-0.5 rounded transition-all ${
                charMode === 'ebcdic' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-zinc-400'
              }`}
            >
              EBCDIC
            </button>
            <button
              onClick={() => setCharMode('ascii')}
              title="Standard ASCII Translation"
              className={`px-1.5 py-0.5 rounded transition-all ${
                charMode === 'ascii' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-zinc-400'
              }`}
            >
              ASCII
            </button>
          </div>
        </div>
      </div>

      {/* Hex Dump & Char Translation Table */}
      <div className="overflow-x-auto bg-[#070a0c] p-2 rounded border border-[#172127]">
        {/* Header Row */}
        <div className="flex text-[10px] text-zinc-500 font-bold border-b border-[#151e24] pb-1 mb-1">
          <div className="w-16">OFFSET</div>
          <div className="flex-1 grid grid-cols-16 gap-0.5 text-center px-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="text-zinc-600">
                {i.toString(16).toUpperCase()}
              </span>
            ))}
          </div>
          <div className="w-32 pl-2 text-zinc-500 border-l border-[#151e24]">
            {charMode.toUpperCase()}
          </div>
        </div>

        {/* Rows */}
        {Array.from({ length: ROWS_TO_SHOW }).map((_, rowIdx) => {
          const rowAddr = startOffset + rowIdx * BYTES_PER_ROW;
          if (rowAddr >= memory.length) return null;

          return (
            <div
              key={rowIdx}
              className="flex items-center py-0.5 hover:bg-zinc-900/40 rounded transition-colors text-[11px]"
            >
              {/* Row Address Offset */}
              <div className="w-16 text-amber-400/80 font-semibold select-none text-[10px]">
                0x{rowAddr.toString(16).padStart(4, '0').toUpperCase()}
              </div>

              {/* 16 Hex Bytes */}
              <div className="flex-1 grid grid-cols-16 gap-0.5 px-2">
                {Array.from({ length: 16 }).map((_, colIdx) => {
                  const addr = rowAddr + colIdx;
                  if (addr >= memory.length) return null;
                  const b = memory[addr];
                  const access = accessMap.get(addr);
                  const isSelected = selectedAddr === addr;

                  return (
                    <button
                      key={colIdx}
                      onClick={() => setSelectedAddr(addr)}
                      className={`text-center font-mono py-0.5 rounded transition-all ${
                        isSelected
                          ? 'ring-1 ring-cyan-400 bg-cyan-950 font-bold text-cyan-200'
                          : access === 'WRITE'
                          ? 'bg-emerald-500/40 text-emerald-200 font-bold animate-pulse'
                          : access === 'READ'
                          ? 'bg-amber-500/30 text-amber-200 font-bold'
                          : b !== 0
                          ? 'text-zinc-200'
                          : 'text-zinc-700'
                      }`}
                    >
                      {b.toString(16).padStart(2, '0').toUpperCase()}
                    </button>
                  );
                })}
              </div>

              {/* Character String Translation */}
              <div className="w-32 pl-2 border-l border-[#151e24] flex text-zinc-400 select-none tracking-widest text-[11px]">
                {Array.from({ length: 16 }).map((_, colIdx) => {
                  const addr = rowAddr + colIdx;
                  if (addr >= memory.length) return null;
                  const b = memory[addr];
                  const ch =
                    charMode === 'ebcdic'
                      ? ebcdicByteToChar(b)
                      : b >= 32 && b <= 126
                      ? String.fromCharCode(b)
                      : '·';
                  const isSelected = selectedAddr === addr;

                  return (
                    <span
                      key={colIdx}
                      className={isSelected ? 'text-cyan-300 font-bold bg-cyan-950/80' : ''}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Byte Inspector */}
      {inspect && (
        <div className="bg-[#0f1418] border border-[#1b262d] rounded p-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-zinc-500 text-[10px] uppercase">Selected:</span>{' '}
            <span className="font-bold text-amber-300">
              0x{inspect.addr.toString(16).padStart(4, '0').toUpperCase()}
            </span>{' '}
            <span className="text-zinc-400">({inspect.addr})</span>
          </div>

          <div>
            <span className="text-zinc-500 text-[10px] uppercase">Byte Hex:</span>{' '}
            <span className="text-emerald-400 font-bold">
              0x{inspect.byte.toString(16).padStart(2, '0').toUpperCase()}
            </span>{' '}
            <span className="text-zinc-400">({inspect.byte})</span>
          </div>

          <div>
            <span className="text-zinc-500 text-[10px] uppercase">EBCDIC:</span>{' '}
            <span className="text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
              {inspect.ebcdic}
            </span>
          </div>

          <div>
            <span className="text-zinc-500 text-[10px] uppercase">32-Bit Int:</span>{' '}
            <span className="text-zinc-200 font-semibold">{inspect.int32}</span>
          </div>

          {inspect.packed && (
            <div>
              <span className="text-zinc-500 text-[10px] uppercase">Packed (3B):</span>{' '}
              <span className="text-purple-300 font-semibold">{inspect.packed.value.toString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

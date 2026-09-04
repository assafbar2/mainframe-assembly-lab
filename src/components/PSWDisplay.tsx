import React from 'react';
import type { ConditionCode, ProgramStatusWord } from '../core/types';
import { CC_DESCRIPTIONS } from '../core/types';

interface PSWDisplayProps {
  psw: ProgramStatusWord;
  stepCount: number;
}

export const PSWDisplay: React.FC<PSWDisplayProps> = ({ psw, stepCount }) => {
  const ccInfo = CC_DESCRIPTIONS[psw.conditionCode];

  return (
    <div className="bg-[#0b0f12] border border-[#1b252b] rounded-lg p-3 shadow-lg flex flex-col gap-2 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1a252b]">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              psw.errorMessage
                ? 'bg-red-500 shadow-sm shadow-red-500/50'
                : psw.halted
                ? 'bg-amber-400'
                : 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50'
            }`}
          />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            PSW & Condition Code (CC)
          </h2>
        </div>

        <div className="text-[11px] text-zinc-400">
          Step: <span className="text-emerald-400 font-bold">{stepCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Instruction Address (PC) */}
        <div className="bg-[#0f1418] border border-[#1a252c] rounded p-2 flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Instruction Address (PC)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-amber-300 tracking-wider">
              0x{psw.instructionAddress.toString(16).padStart(4, '0').toUpperCase()}
            </span>
            <span className="text-[11px] text-zinc-500">
              ({psw.instructionAddress} dec)
            </span>
          </div>
        </div>

        {/* Status Lamp */}
        <div className="bg-[#0f1418] border border-[#1a252c] rounded p-2 flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Execution Status
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                psw.errorMessage
                  ? 'bg-red-950 text-red-300 border-red-500/40'
                  : psw.halted
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {psw.errorMessage ? 'HALTED (EXIT)' : psw.halted ? 'HALTED' : 'ACTIVE / READY'}
            </span>
          </div>
        </div>
      </div>

      {/* 2-Bit Condition Code Meter */}
      <div className="bg-[#0f1418] border border-[#1a252c] rounded p-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500 uppercase tracking-wider">2-Bit CC Meter</span>
          <span className="text-emerald-300 font-bold">{ccInfo.short}</span>
        </div>

        {/* The 4 CC Lamp Indicators */}
        <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
          {([0, 1, 2, 3] as ConditionCode[]).map((c) => {
            const isActive = psw.conditionCode === c;
            return (
              <div
                key={c}
                className={`py-1 rounded border transition-all ${
                  isActive
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-bold shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-400/50'
                    : 'bg-[#0a0d10] border-[#182228] text-zinc-600'
                }`}
              >
                <div className="text-[10px] text-zinc-500 font-normal">CC</div>
                <div className="text-sm font-bold">{c}</div>
              </div>
            );
          })}
        </div>

        {/* Meaning gloss */}
        <div className="text-[10px] text-zinc-400 italic">
          {ccInfo.desc}
        </div>
      </div>
    </div>
  );
};

import React, { useRef } from 'react';
import { Play, Pause, StepForward, Undo2, RotateCcw, Hammer, FileCode } from 'lucide-react';
import type { AssemblyListingLine } from '../core/types';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
  onAssemble: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onRunToggle: () => void;
  onReset: () => void;
  isRunning: boolean;
  canStepBack: boolean;
  activeLineNum: number | null;
  errors: { lineNum: number; message: string }[];
  listing: AssemblyListingLine[];
  activeTab: 'editor' | 'listing';
  setActiveTab: (t: 'editor' | 'listing') => void;
  clockSpeed: number;
  setClockSpeed: (speed: number) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onAssemble,
  onStep,
  onStepBack,
  onRunToggle,
  onReset,
  isRunning,
  canStepBack,
  activeLineNum,
  errors,
  listing,
  activeTab,
  setActiveTab,
  clockSpeed,
  setClockSpeed,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = code.split('\n');

  // Handle Tab key in editor for proper column indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextCode = code.substring(0, start) + '    ' + code.substring(end);
      onChange(nextCode);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const errorLineMap = new Map<number, string>();
  for (const err of errors) {
    errorLineMap.set(err.lineNum, err.message);
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e11] border border-[#1b252b] rounded-lg overflow-hidden shadow-xl">
      {/* Tab Header & Control Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#1b252b] bg-[#0f1418] px-3 py-2 gap-2">
        {/* Editor vs Listing View Tabs */}
        <div className="flex items-center gap-1 bg-[#090c0e] p-0.5 rounded border border-[#1c272e]">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'editor'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>HLASM Source</span>
          </button>
          <button
            onClick={() => setActiveTab('listing')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'listing'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Assembly Listing</span>
          </button>
        </div>

        {/* Execution Control Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Assemble Button */}
          <button
            onClick={onAssemble}
            title="Assemble Program into Machine Bytecode"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#141e24] hover:bg-[#1a2730] text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-all hover:border-emerald-400/60 shadow-sm"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Assemble</span>
          </button>

          {/* Step Back (Time Travel Undo) */}
          <button
            onClick={onStepBack}
            disabled={!canStepBack || isRunning}
            title="Step Back in Time (Undo Previous Instruction)"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#141e24] disabled:opacity-40 disabled:hover:bg-[#141e24] hover:bg-[#1a2730] text-amber-400 text-xs font-semibold border border-amber-500/30 transition-all"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Step Forward */}
          <button
            onClick={onStep}
            disabled={isRunning}
            title="Step Forward One Instruction"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#141e24] disabled:opacity-40 hover:bg-[#1a2730] text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all hover:border-emerald-400"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Step</span>
          </button>

          {/* Run / Pause */}
          <button
            onClick={onRunToggle}
            title={isRunning ? 'Pause CPU Execution' : 'Run CPU Continuously'}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold shadow-sm shadow-emerald-500/30'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isRunning ? 'Pause' : 'Run'}</span>
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            title="Reset CPU & Registers"
            className="p-1 rounded bg-[#141e24] hover:bg-[#1a2730] text-zinc-400 hover:text-zinc-200 border border-[#22313a] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <select
            value={clockSpeed}
            onChange={(e) => setClockSpeed(Number(e.target.value))}
            className="bg-[#090c0e] text-zinc-300 text-[11px] px-1.5 py-1 rounded border border-[#22313a] focus:outline-none"
            title="Execution Clock Speed"
          >
            <option value={400}>Slow (400ms)</option>
            <option value={150}>Normal (150ms)</option>
            <option value={30}>Turbo (30ms)</option>
          </select>
        </div>
      </div>

      {/* Editor Main Content Area */}
      {activeTab === 'editor' ? (
        <div className="relative flex-1 flex overflow-hidden font-mono text-xs">
          {/* Line Numbers Column with Active Instruction Indicator */}
          <div className="w-12 bg-[#0c1013] text-zinc-600 select-none border-r border-[#1a242a] py-3 text-right pr-2 font-mono flex flex-col">
            {lines.map((_, idx) => {
              const lineNum = idx + 1;
              const isActive = activeLineNum === lineNum;
              const hasError = errorLineMap.has(lineNum);

              return (
                <div
                  key={idx}
                  className={`h-5 leading-5 flex items-center justify-end gap-1 ${
                    isActive
                      ? 'text-emerald-400 font-bold bg-emerald-500/10'
                      : hasError
                      ? 'text-red-400 font-bold bg-red-500/10'
                      : ''
                  }`}
                >
                  {isActive && <span className="text-[10px] text-emerald-400 animate-pulse">▶</span>}
                  {hasError && <span className="text-[10px] text-red-400 font-bold">!</span>}
                  <span>{lineNum}</span>
                </div>
              );
            })}
          </div>

          {/* Source Code Textarea */}
          <div className="flex-1 relative overflow-auto bg-[#080b0d]">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="w-full h-full min-h-[420px] bg-transparent text-emerald-300/90 p-3 leading-5 resize-none focus:outline-none font-mono text-xs whitespace-pre tab-4"
              placeholder="* Enter your IBM High Level Assembler (HLASM) code here..."
            />
          </div>
        </div>
      ) : (
        /* Assembly Listing View (SYSPRINT format) */
        <div className="flex-1 overflow-auto bg-[#070a0c] p-3 font-mono text-xs text-zinc-300">
          <div className="text-[11px] text-zinc-500 border-b border-[#1b262d] pb-2 mb-2 grid grid-cols-12 font-bold">
            <span className="col-span-1 text-zinc-400">LINE</span>
            <span className="col-span-2 text-zinc-400">LOC (HEX)</span>
            <span className="col-span-3 text-zinc-400">OBJECT CODE</span>
            <span className="col-span-6 text-zinc-400">SOURCE STATEMENT</span>
          </div>

          {listing.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              Click <span className="text-emerald-400 font-bold">Assemble</span> to generate the IBM SYSPRINT Listing.
            </div>
          ) : (
            listing.map((line, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-12 py-0.5 px-1 rounded transition-colors ${
                  activeLineNum === line.lineNum
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                    : line.error
                    ? 'bg-red-500/20 text-red-300'
                    : 'hover:bg-zinc-900/50'
                }`}
              >
                <span className="col-span-1 text-zinc-500">{line.lineNum}</span>
                <span className="col-span-2 text-amber-300/90">
                  {line.objectCode ? '0x' + line.address.toString(16).padStart(4, '0').toUpperCase() : ''}
                </span>
                <span className="col-span-3 text-emerald-400 tracking-wider">
                  {line.objectCode}
                </span>
                <span className="col-span-6 text-zinc-200 truncate">
                  {line.sourceText}
                  {line.error && <span className="ml-2 text-red-400 text-[10px]">[{line.error}]</span>}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer Diagnostic Bar */}
      {errors.length > 0 && (
        <div className="bg-red-950/60 border-t border-red-900/50 px-3 py-1.5 text-xs text-red-300 flex items-center justify-between">
          <span className="font-semibold">
            Assembly Error on Line {errors[0].lineNum}: {errors[0].message}
          </span>
          <span className="text-[11px] text-red-400/80">({errors.length} total issue{errors.length > 1 ? 's' : ''})</span>
        </div>
      )}
    </div>
  );
};

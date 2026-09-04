import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { RegisterGrid } from './components/RegisterGrid';
import { PSWDisplay } from './components/PSWDisplay';
import { MemoryViewer } from './components/MemoryViewer';
import { InstructionExplainer } from './components/InstructionExplainer';
import { MissionPanel } from './components/MissionPanel';
import { ArchitectureModal } from './components/ArchitectureModal';
import { Assembler } from './core/assembler';
import { MainframeCPU } from './core/cpu';
import {
  MISSIONS,
  PRESET_PROGRAMS,
  runMission,
  type MissionRunResult,
} from './core/challenges';
import type { AssemblyResult, MemoryAccess, ParsedInstruction, ProgramStatusWord } from './core/types';

export const App: React.FC = () => {
  // Navigation & Display Settings
  const [mode, setMode] = useState<'missions' | 'sandbox' | 'architecture'>('missions');
  const [theme, setTheme] = useState<'green' | 'amber' | 'cyan'>('green');
  const [scanlines, setScanlines] = useState(true);
  const [isArchModalOpen, setIsArchModalOpen] = useState(false);

  // Mission State
  const [currentMissionIdx, setCurrentMissionIdx] = useState(0);
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [verificationResult, setVerificationResult] = useState<MissionRunResult | null>(null);

  // Core Simulation State
  const cpuRef = useRef<MainframeCPU>(new MainframeCPU());
  const assemblerRef = useRef<Assembler>(new Assembler());

  const currentMission = MISSIONS[currentMissionIdx];
  const [code, setCode] = useState<string>(currentMission.starterCode);
  const [activeTab, setActiveTab] = useState<'editor' | 'listing'>('editor');
  const [assemblyResult, setAssemblyResult] = useState<AssemblyResult | null>(null);

  // CPU UI Mirrors
  const [cpuRegisters, setCpuRegisters] = useState<Int32Array>(() => new Int32Array(16));
  const [cpuMemory, setCpuMemory] = useState<Uint8Array>(() => new Uint8Array(65536));
  const [cpuPsw, setCpuPsw] = useState<ProgramStatusWord>({
    instructionAddress: 0,
    conditionCode: 0,
    halted: false,
    errorMessage: null,
  });
  const [stepCount, setStepCount] = useState(0);
  const [lastInstruction, setLastInstruction] = useState<ParsedInstruction | null>(null);
  const [lastAccesses, setLastAccesses] = useState<MemoryAccess[]>([]);
  const [lastChangedRegisters, setLastChangedRegisters] = useState<Set<number>>(new Set());
  const [canStepBack, setCanStepBack] = useState(false);

  // Continuous Execution
  const [isRunning, setIsRunning] = useState(false);
  const [clockSpeed, setClockSpeed] = useState(150);
  const runIntervalRef = useRef<any>(null);

  // Sandbox Presets
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_PROGRAMS[0].id);

  // Synchronize CPU state to React state
  const syncCpuState = useCallback((prevRegs?: Int32Array) => {
    const cpu = cpuRef.current;
    const currentRegs = new Int32Array(cpu.registers);
    setCpuRegisters(currentRegs);
    setCpuMemory(new Uint8Array(cpu.memory));
    setCpuPsw({ ...cpu.psw });
    setStepCount(cpu.stepCount);
    setLastInstruction(cpu.lastInstruction);
    setLastAccesses([...cpu.lastAccesses]);
    setCanStepBack(cpu.canStepBack);

    if (prevRegs) {
      const changed = new Set<number>();
      for (let i = 0; i < 16; i++) {
        if (prevRegs[i] !== currentRegs[i]) {
          changed.add(i);
        }
      }
      setLastChangedRegisters(changed);
    }
  }, []);

  // Assemble code
  const handleAssemble = useCallback((): AssemblyResult => {
    const asm = assemblerRef.current;
    const res = asm.assemble(code);
    setAssemblyResult(res);

    if (res.success && res.instructions.length > 0) {
      const cpu = cpuRef.current;
      cpu.loadProgram(res.instructions, res.entryPoint);

      // In Mission 1, inject starter register values
      if (mode === 'missions' && currentMission.id === 'mission-1') {
        cpu.registers[2] = 500;
        cpu.registers[3] = 350;
      }

      syncCpuState();
    }
    return res;
  }, [code, mode, currentMission.id, syncCpuState]);

  // Step Forward
  const handleStep = () => {
    const cpu = cpuRef.current;
    if (!assemblyResult || !assemblyResult.success) {
      const res = handleAssemble();
      if (!res.success) return;
    }

    if (cpu.psw.halted) return;

    const prevRegs = new Int32Array(cpu.registers);
    const active = cpu.step();
    syncCpuState(prevRegs);

    if (!active || cpu.psw.halted) {
      setIsRunning(false);
    }
  };

  // Step Backward (Time Travel)
  const handleStepBack = () => {
    const cpu = cpuRef.current;
    if (!cpu.canStepBack) return;

    cpu.stepBack();
    syncCpuState();
  };

  // Run Toggle (Continuous execution)
  const handleRunToggle = () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }

    if (!assemblyResult || !assemblyResult.success || cpuRef.current.psw.halted) {
      const res = handleAssemble();
      if (!res.success) return;
    }

    setIsRunning(true);
  };

  useEffect(() => {
    if (isRunning) {
      runIntervalRef.current = setInterval(() => {
        const cpu = cpuRef.current;
        if (cpu.psw.halted) {
          setIsRunning(false);
          return;
        }
        const prevRegs = new Int32Array(cpu.registers);
        const active = cpu.step();
        syncCpuState(prevRegs);
        if (!active || cpu.psw.halted) {
          setIsRunning(false);
        }
      }, clockSpeed);
    } else {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    }

    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
      }
    };
  }, [isRunning, clockSpeed, syncCpuState]);

  // Reset CPU
  const handleReset = () => {
    setIsRunning(false);
    const cpu = cpuRef.current;
    if (assemblyResult && assemblyResult.success) {
      cpu.loadProgram(assemblyResult.instructions, assemblyResult.entryPoint);
      if (mode === 'missions' && currentMission.id === 'mission-1') {
        cpu.registers[2] = 500;
        cpu.registers[3] = 350;
      }
    } else {
      cpu.reset(true);
    }
    syncCpuState();
  };

  // Mission selection handler
  const handleSelectMission = (idx: number) => {
    setIsRunning(false);
    setCurrentMissionIdx(idx);
    const m = MISSIONS[idx];
    setCode(m.starterCode);
    setVerificationResult(null);
    setAssemblyResult(null);
    cpuRef.current.reset(true);
    syncCpuState();
  };

  // Verify Mission Solution
  const handleVerifyMission = () => {
    setIsRunning(false);
    const result = runMission(currentMission, code);
    setVerificationResult(result);

    if (result.success) {
      // Mark mission completed
      setCompletedMissions((prev) => {
        const next = new Set(prev);
        next.add(currentMission.id);
        return next;
      });

      // Confetti burst!
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#38ef7d', '#11998e', '#00e5ff', '#ffb347'],
      });
    }

    // Also assemble and load in CPU so user can inspect memory/registers
    handleAssemble();
  };

  // Load solution code
  const handleLoadSolution = () => {
    setCode(currentMission.solutionCode);
    setVerificationResult(null);
  };

  // Reset starter code
  const handleResetStarter = () => {
    setCode(currentMission.starterCode);
    setVerificationResult(null);
    handleReset();
  };

  // Preset selector in sandbox
  const handleSelectPreset = (presetId: string) => {
    setIsRunning(false);
    setSelectedPresetId(presetId);
    const preset = PRESET_PROGRAMS.find((p) => p.id === presetId);
    if (preset) {
      setCode(preset.code);
      setAssemblyResult(null);
      cpuRef.current.reset(true);
      syncCpuState();
    }
  };

  // Initial assembly on first load
  useEffect(() => {
    handleAssemble();
  }, [handleAssemble]);

  // Determine active source line
  const activeLineNum = lastInstruction ? lastInstruction.lineNum : null;

  return (
    <div
      className={`min-h-screen bg-[#07090b] text-zinc-100 flex flex-col theme-${theme} ${
        scanlines ? 'crt-overlay' : ''
      }`}
    >
      {/* Top Application Header */}
      <Header
        mode={mode}
        setMode={(m) => {
          if (m === 'architecture') {
            setIsArchModalOpen(true);
          } else {
            setMode(m);
          }
        }}
        theme={theme}
        setTheme={setTheme}
        scanlines={scanlines}
        setScanlines={setScanlines}
        completedMissionsCount={completedMissions.size}
        totalMissionsCount={MISSIONS.length}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 flex flex-col gap-3">
        {/* Sandbox Preset Selector Toolbar (when in sandbox mode) */}
        {mode === 'sandbox' && (
          <div className="bg-[#0b0f12] border border-[#1b252b] rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">Preset Programs:</span>
              <div className="flex flex-wrap gap-1">
                {PRESET_PROGRAMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    className={`px-2.5 py-1 rounded text-xs transition-all ${
                      selectedPresetId === p.id
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                        : 'bg-[#12191e] text-zinc-400 hover:text-zinc-200 border border-[#1e2a32]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-zinc-400">
              {PRESET_PROGRAMS.find((p) => p.id === selectedPresetId)?.description}
            </div>
          </div>
        )}

        {/* Workspace Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* Left Column: Editor & Assembly Listing (7 cols on desktop) */}
          <div className="lg:col-span-7 flex flex-col gap-3 h-[600px] lg:h-[720px]">
            <CodeEditor
              code={code}
              onChange={setCode}
              onAssemble={handleAssemble}
              onStep={handleStep}
              onStepBack={handleStepBack}
              onRunToggle={handleRunToggle}
              onReset={handleReset}
              isRunning={isRunning}
              canStepBack={canStepBack}
              activeLineNum={activeLineNum}
              errors={assemblyResult?.errors || []}
              listing={assemblyResult?.listing || []}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              clockSpeed={clockSpeed}
              setClockSpeed={setClockSpeed}
            />

            {/* Instruction Explainer Callout */}
            <InstructionExplainer
              lastInstruction={lastInstruction}
              psw={cpuPsw}
              stepCount={stepCount}
            />
          </div>

          {/* Right Column: Registers, PSW, Memory, or Mission Panel (5 cols on desktop) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {/* If in Mission mode, show Mission Panel at the top */}
            {mode === 'missions' && (
              <MissionPanel
                missions={MISSIONS}
                currentMissionIndex={currentMissionIdx}
                onSelectMission={handleSelectMission}
                onVerify={handleVerifyMission}
                verificationResult={verificationResult}
                onLoadSolution={handleLoadSolution}
                onResetStarter={handleResetStarter}
                completedMissions={completedMissions}
              />
            )}

            {/* PSW & Condition Code Display */}
            <PSWDisplay psw={cpuPsw} stepCount={stepCount} />

            {/* 16 GPR Registers */}
            <RegisterGrid
              registers={cpuRegisters}
              lastChangedRegisters={lastChangedRegisters}
            />

            {/* Memory & EBCDIC Storage Grid */}
            <MemoryViewer
              memory={cpuMemory}
              lastAccesses={lastAccesses}
              symbols={assemblyResult?.symbols || {}}
            />
          </div>
        </div>
      </main>

      {/* Architecture Deep Dive Modal */}
      <ArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />
    </div>
  );
};

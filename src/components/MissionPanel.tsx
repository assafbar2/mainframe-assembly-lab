import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { Mission, MissionRunResult } from '../core/challenges';

interface MissionPanelProps {
  missions: Mission[];
  currentMissionIndex: number;
  onSelectMission: (idx: number) => void;
  onVerify: () => void;
  verificationResult: MissionRunResult | null;
  onLoadSolution: () => void;
  onResetStarter: () => void;
  completedMissions: Set<string>;
}

export const MissionPanel: React.FC<MissionPanelProps> = ({
  missions,
  currentMissionIndex,
  onSelectMission,
  onVerify,
  verificationResult,
  onLoadSolution,
  onResetStarter,
  completedMissions,
}) => {
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const mission = missions[currentMissionIndex];
  const isCompleted = completedMissions.has(mission.id);

  const handleNext = () => {
    if (currentMissionIndex < missions.length - 1) {
      onSelectMission(currentMissionIndex + 1);
      setShowHint(false);
      setHintIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentMissionIndex > 0) {
      onSelectMission(currentMissionIndex - 1);
      setShowHint(false);
      setHintIndex(0);
    }
  };

  const handleVerifyWithConfetti = () => {
    onVerify();
  };

  return (
    <div className="bg-[#0b0f12] border border-[#1b252b] rounded-lg p-3.5 shadow-xl flex flex-col gap-3 font-mono text-xs">
      {/* Mission Navigator & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1a252b]">
        {/* Mission Select Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {missions.map((m, idx) => {
            const active = idx === currentMissionIndex;
            const done = completedMissions.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => {
                  onSelectMission(idx);
                  setShowHint(false);
                  setHintIndex(0);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all ${
                  active
                    ? 'bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-400/50 shadow-sm'
                    : done
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60'
                    : 'bg-[#10161b] text-zinc-400 hover:text-zinc-200 border border-[#1d2931]'
                }`}
              >
                {done && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                <span>M{m.number}</span>
              </button>
            );
          })}
        </div>

        {/* Prev / Next buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={currentMissionIndex === 0}
            className="p-1 rounded bg-[#10161b] disabled:opacity-30 hover:bg-[#19232a] text-zinc-300 border border-[#1d2931]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-zinc-400 px-1">
            {currentMissionIndex + 1} / {missions.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentMissionIndex === missions.length - 1}
            className="p-1 rounded bg-[#10161b] disabled:opacity-30 hover:bg-[#19232a] text-zinc-300 border border-[#1d2931]"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mission Heading & Metadata */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
            MISSION {mission.number}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#131b20] text-amber-400 border border-amber-500/20 font-semibold">
            {mission.difficulty}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#131b20] text-zinc-400 border border-[#202d36]">
            Est. {mission.estimatedTime}
          </span>
          {isCompleted && (
            <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold ml-auto">
              <Trophy className="w-3 h-3" />
              SOLVED
            </span>
          )}
        </div>
        <h2 className="text-sm font-bold text-zinc-100">{mission.title}</h2>
        <p className="text-[11px] text-zinc-400 mt-0.5">{mission.subtitle}</p>
      </div>

      {/* Briefing text */}
      <div className="bg-[#080b0d] p-2.5 rounded border border-[#162026] text-zinc-300 text-[11px] leading-relaxed whitespace-pre-line">
        {mission.briefing}
      </div>

      {/* Concept Explainer Box */}
      <div className="bg-[#0f1519] p-2.5 rounded border border-[#1a252c] flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
          <BookOpen className="w-3.5 h-3.5" />
          <span>{mission.conceptExplainer.heading}</span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-line">
          {mission.conceptExplainer.text}
        </p>
        {mission.conceptExplainer.codeSnippet && (
          <pre className="bg-[#070a0c] p-2 rounded border border-[#141d23] text-emerald-300 text-[10px] overflow-x-auto">
            {mission.conceptExplainer.codeSnippet}
          </pre>
        )}
      </div>

      {/* Test Assertions Checklist */}
      <div className="bg-[#080b0d] p-2.5 rounded border border-[#162026] flex flex-col gap-1.5">
        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          Verification Checks
        </div>

        {verificationResult ? (
          <div className="flex flex-col gap-1">
            {verificationResult.assertions.map((a, idx) => (
              <div
                key={idx}
                className={`p-1.5 rounded border flex items-start gap-2 text-[11px] ${
                  a.passed
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/40 text-red-200'
                }`}
              >
                {a.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{a.description}</div>
                  {!a.passed && (
                    <div className="text-[10px] text-red-300/80 mt-0.5">
                      Expected: <span className="font-mono text-zinc-200">{a.expected}</span> | Actual:{' '}
                      <span className="font-mono text-amber-300">{a.actual}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {mission.assertions.map((a, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded bg-[#0e1317] border border-[#182329] text-zinc-400 flex items-center gap-2 text-[11px]"
              >
                <div className="w-2 h-2 rounded-full bg-zinc-600" />
                <span>{a.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hints Accordion */}
      {showHint && (
        <div className="bg-amber-950/30 border border-amber-500/30 p-2 rounded text-[11px] text-amber-200 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Hint {hintIndex + 1}:</span> {mission.hints[hintIndex]}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a252b]">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setShowHint(true);
              setHintIndex((prev) => (prev + 1) % mission.hints.length);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#12191e] hover:bg-[#1a242c] text-amber-400 text-[11px] border border-amber-500/20 transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'Next Hint' : 'Get Hint'}</span>
          </button>

          <button
            onClick={onLoadSolution}
            className="px-2 py-1 rounded bg-[#12191e] hover:bg-[#1a242c] text-zinc-400 hover:text-zinc-200 text-[11px] border border-[#202d36] transition-all"
          >
            Load Solution
          </button>

          <button
            onClick={onResetStarter}
            className="px-2 py-1 rounded bg-[#12191e] hover:bg-[#1a242c] text-zinc-400 hover:text-zinc-200 text-[11px] border border-[#202d36] transition-all"
          >
            Reset
          </button>
        </div>

        {/* Big Verify Solution Button */}
        <button
          onClick={handleVerifyWithConfetti}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/30 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>Verify Mission</span>
        </button>
      </div>
    </div>
  );
};

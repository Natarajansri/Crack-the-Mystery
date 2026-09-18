import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Sparkles, 
  Send, 
  KeyRound, 
  ChevronRight, 
  Award,
  Layers,
  Flame,
  Check,
  Zap,
  Info,
  AlertTriangle,
  UserX
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RoomState, Participant, Puzzle, Clue } from '../types';
import { PUZZLES_DATA } from '../data/puzzlesData';
import { gameService } from '../services/gameService';
import { soundService } from '../services/audioService';

interface PuzzleArenaProps {
  roomState: RoomState;
  currentParticipant: Participant;
  onAllCompleted: () => void;
}

export const PuzzleArena: React.FC<PuzzleArenaProps> = ({
  roomState,
  currentParticipant,
  onAllCompleted
}) => {
  const { room, clueProgress, puzzleProgress } = roomState;

  // Active puzzle selection (defaults to current puzzle in room state or level 1)
  const [selectedPuzzleNumber, setSelectedPuzzleNumber] = useState<number>(
    room.currentPuzzleNumber || 1
  );

  const activePuzzle = PUZZLES_DATA.find((p) => p.puzzleNumber === selectedPuzzleNumber) || PUZZLES_DATA[0];

  // Active clue selection within current puzzle (1 to 5)
  // Auto-select first unsolved clue
  const [activeClueNumber, setActiveClueNumber] = useState<number>(1);

  // Form input state
  const [inputAnswer, setInputAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Overall calculations
  const totalPuzzlesSolved = Object.values(puzzleProgress).filter((p) => p.isCompleted).length;
  const totalCluesSolved = Object.values(clueProgress).filter((c) => c.isSolved).length;
  const percentComplete = Math.round((totalPuzzlesSolved / PUZZLES_DATA.length) * 100);

  // Check if active clue is solved
  const activeClue = activePuzzle.clues.find((c) => c.clueNumber === activeClueNumber) || activePuzzle.clues[0];
  const activeClueKey = `${activePuzzle.id}_${activeClue.id}`;
  const isCurrentClueSolved = Boolean(clueProgress[activeClueKey]?.isSolved);
  const isCurrentPuzzleCompleted = Boolean(puzzleProgress[activePuzzle.id]?.isCompleted);

  // Determine if a clue is unlocked sequentially
  const isClueUnlocked = (clue: Clue): boolean => {
    if (clue.clueNumber === 1) return true;
    const prevClue = activePuzzle.clues.find((c) => c.clueNumber === clue.clueNumber - 1);
    if (!prevClue) return false;
    return Boolean(clueProgress[`${activePuzzle.id}_${prevClue.id}`]?.isSolved);
  };

  // When active puzzle changes, auto-select first unsolved clue
  useEffect(() => {
    const firstUnsolved = activePuzzle.clues.find(
      (c) => !clueProgress[`${activePuzzle.id}_${c.id}`]?.isSolved
    );
    setActiveClueNumber(firstUnsolved ? firstUnsolved.clueNumber : 5);
    setInputAnswer('');
    setFeedback(null);
  }, [selectedPuzzleNumber, activePuzzle.id]);

  // Handle clue / final answer submission
  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAnswer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);
    soundService.playClick();

    if (activeClueNumber === 5) {
      // Final Answer submission
      const res = await gameService.submitFinalAnswer(
        room.id,
        activePuzzle.id,
        currentParticipant,
        inputAnswer
      );

      if (res.success) {
        soundService.playPuzzleSolved();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        setFeedback({ type: 'success', message: res.message });
        setInputAnswer('');

        if (res.allPuzzlesCompleted) {
          onAllCompleted();
        }
      } else {
        soundService.playError();
        setFeedback({ type: 'error', message: res.message });
      }
    } else {
      // Standard Clue submission (Clues 1 to 4)
      const res = await gameService.submitClueAnswer(
        room.id,
        activePuzzle.id,
        activeClue.id,
        currentParticipant,
        inputAnswer
      );

      if (res.success) {
        soundService.playClueSolved();
        setFeedback({ type: 'success', message: res.message });
        setInputAnswer('');

        // Automatically advance to next clue if unlocked
        if (activeClueNumber < 5) {
          setTimeout(() => {
            setActiveClueNumber(activeClueNumber + 1);
            setFeedback(null);
          }, 1200);
        }
      } else {
        soundService.playError();
        setFeedback({ type: 'error', message: res.message });
      }
    }

    setIsSubmitting(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Top Header & Team Progress HUD */}
      <div className="cyber-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyber-cyan/20 text-cyber-cyan text-xs font-semibold uppercase tracking-widest border border-cyber-cyan/30">
                Escape Room Arena
              </span>
              <span className="text-slate-400 text-xs font-mono">
                ROOM: {room.code}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-display text-white mt-1 uppercase flex items-center gap-2">
              <span>{room.teamName}</span>
              {isCurrentPuzzleCompleted && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Level Cleared!
                </span>
              )}
            </h2>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto justify-between md:justify-end">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Puzzles Solved</div>
              <div className="text-lg sm:text-xl font-display font-black text-cyber-cyan">
                {totalPuzzlesSolved} <span className="text-xs text-slate-500">/ 15</span>
              </div>
            </div>

            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Clues Solved</div>
              <div className="text-lg sm:text-xl font-display font-black text-cyber-teal">
                {totalCluesSolved} <span className="text-xs text-slate-500">/ 75</span>
              </div>
            </div>

            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Progress</div>
              <div className="text-lg sm:text-xl font-display font-black text-cyber-gold">
                {percentComplete}%
              </div>
            </div>
          </div>
        </div>

        {/* Glowing Progress Track */}
        <div className="mt-4 w-full bg-navy-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-cyber-cyan via-cyber-teal to-cyber-purple h-full transition-all duration-500 shadow-glow-cyan"
            style={{ width: `${Math.max(percentComplete, 3)}%` }}
          />
        </div>
      </div>

      {/* Team Eliminated Notice */}
      {room.status === 'eliminated' && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500/70 text-center space-y-2 shadow-[0_0_30px_rgba(244,63,94,0.3)] animate-pulse">
          <div className="flex items-center justify-center gap-2 text-rose-300 font-black font-display uppercase text-sm sm:text-base">
            <UserX className="w-5 h-5 text-rose-400" />
            <span>Team Eliminated from Active Competition</span>
          </div>
          <p className="text-xs text-rose-200 font-sans max-w-xl mx-auto">
            This room has been eliminated or disqualified by the event administration. Puzzle answer submissions are currently restricted. Please contact the CSE / IE(I) committee coordinators for assistance.
          </p>
        </div>
      )}

      {/* Interactive 15-Puzzle Level Selector (Grouped by Tiers) */}
      <div className="cyber-card rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Select Mystery Level (1 to 15)</span>
          </span>
          <span className="text-[11px] text-slate-400">
            Click any puzzle to view clues and fragment vault
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-15 gap-1.5 sm:gap-2">
          {PUZZLES_DATA.map((puz) => {
            const isDone = puzzleProgress[puz.id]?.isCompleted;
            const isSelected = puz.puzzleNumber === selectedPuzzleNumber;

            return (
              <button
                key={puz.id}
                onClick={() => {
                  soundService.playClick();
                  setSelectedPuzzleNumber(puz.puzzleNumber);
                }}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-cyber-cyan/20 border-cyber-cyan text-white shadow-glow-cyan scale-105 z-10'
                    : isDone
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                      : 'bg-navy-900/80 border-slate-800 text-slate-400 hover:bg-navy-850 hover:text-white'
                }`}
                title={`Level ${puz.puzzleNumber}: ${puz.title} (${puz.difficulty})`}
              >
                <span className="text-[10px] text-slate-400 font-mono">
                  {puz.difficulty === 'simple' ? 'S' : puz.difficulty === 'moderate' ? 'M' : 'H'}
                </span>
                <span className="text-sm font-display">{puz.puzzleNumber}</span>

                {isDone && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 absolute top-1 right-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Arena Content: Clue Arena & Fragment Vault */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Active Clue Workspace */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Active Puzzle Story Card */}
          <div className="cyber-card rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${
                    activePuzzle.difficulty === 'simple'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : activePuzzle.difficulty === 'moderate'
                        ? 'bg-cyber-gold/15 text-cyber-gold border-cyber-gold/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {activePuzzle.difficulty} tier
                  </span>
                  <span className="text-xs text-slate-400 font-sans">• {activePuzzle.theme}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold font-display text-white mt-1.5">
                  Level {activePuzzle.puzzleNumber}: {activePuzzle.title}
                </h3>
              </div>

              {isCurrentPuzzleCompleted && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span>Solved</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 mt-2.5 leading-relaxed italic border-l-2 border-cyber-cyan/40 pl-3">
              "{activePuzzle.story}"
            </p>
          </div>

          {/* Sequential 5-Clue Pipeline Tabs */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-navy-950/80 border border-slate-800">
            {activePuzzle.clues.map((clue) => {
              const clueKey = `${activePuzzle.id}_${clue.id}`;
              const isSolved = Boolean(clueProgress[clueKey]?.isSolved);
              const isUnlocked = isClueUnlocked(clue);
              const isSelected = clue.clueNumber === activeClueNumber;

              return (
                <button
                  key={clue.id}
                  disabled={!isUnlocked}
                  onClick={() => {
                    soundService.playClick();
                    setActiveClueNumber(clue.clueNumber);
                    setFeedback(null);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-cyber-cyan text-navy-950 font-bold shadow-glow-cyan'
                      : isSolved
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/40'
                        : isUnlocked
                          ? 'bg-navy-900 text-slate-300 hover:bg-navy-850 hover:text-white border border-slate-800'
                          : 'bg-navy-950 text-slate-600 border border-slate-900 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isSolved ? (
                      <Check className="w-3 h-3" />
                    ) : isUnlocked ? (
                      <Unlock className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3 opacity-60" />
                    )}
                    <span className="font-display">
                      {clue.clueNumber === 5 ? 'KEY' : `0${clue.clueNumber}`}
                    </span>
                  </div>
                  <span className="text-[10px] truncate max-w-[70px] mt-0.5 opacity-80 hidden sm:inline">
                    {clue.clueNumber === 5 ? 'Unlock' : clue.type.replace('_', ' ')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Clue Detail Card */}
          <div className="cyber-card rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-bold text-cyber-cyan tracking-widest uppercase font-mono">
                  {activeClue.clueNumber === 5 ? 'MASTER KEY' : `STAGE 0${activeClue.clueNumber} OF 05`}
                </span>
                <h4 className="text-base sm:text-lg font-bold text-white font-display">
                  {activeClue.title}
                </h4>
              </div>

              <span className="text-xs px-2.5 py-1 rounded-full bg-navy-850 border border-slate-700 text-slate-300 capitalize">
                {activeClue.type.replace('_', ' ')}
              </span>
            </div>

            {/* Clue Prompt */}
            <div className="p-4 rounded-xl bg-navy-950/90 border border-slate-800/80 mb-4">
              <p className="text-sm sm:text-base text-slate-100 font-sans leading-relaxed whitespace-pre-line">
                {activeClue.prompt}
              </p>
            </div>

            {/* Solved Status or Submission Form */}
            {isCurrentClueSolved ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-emerald-300">
                      Clue Solved by Team!
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Earned Fragment: <span className="text-cyber-cyan font-mono font-bold">"{clueProgress[activeClueKey]?.earnedFragment}"</span>
                      {clueProgress[activeClueKey]?.solvedByParticipantName && (
                        <span> by {clueProgress[activeClueKey]?.solvedByParticipantName}</span>
                      )}
                    </div>
                  </div>
                </div>

                {activeClueNumber < 5 && (
                  <button
                    onClick={() => {
                      soundService.playClick();
                      setActiveClueNumber(activeClueNumber + 1);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold flex items-center gap-1"
                  >
                    <span>Next Clue</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitAnswer} className="space-y-3">
                {feedback && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                      feedback.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300 animate-shake'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      disabled={room.status === 'eliminated'}
                      placeholder={
                        room.status === 'eliminated'
                          ? 'Team eliminated - submissions disabled'
                          : activeClueNumber === 5
                            ? 'Enter the combined master key...'
                            : 'Enter your answer / deduction...'
                      }
                      value={inputAnswer}
                      onChange={(e) => setInputAnswer(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white font-sans text-sm focus:outline-none focus:border-cyber-cyan placeholder-slate-500 ${
                        room.status === 'eliminated' ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !inputAnswer.trim() || room.status === 'eliminated'}
                    className={`px-5 sm:px-6 py-2.5 rounded-xl font-bold font-display uppercase tracking-wider text-xs sm:text-sm text-navy-950 flex items-center gap-1.5 transition-all ${
                      activeClueNumber === 5
                        ? 'bg-gradient-to-r from-amber-400 to-cyber-gold hover:brightness-110 shadow-glow-gold'
                        : 'bg-gradient-to-r from-cyan-400 to-teal-300 hover:brightness-110 shadow-glow-cyan'
                    } ${isSubmitting || !inputAnswer.trim() || room.status === 'eliminated' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Verifying...' : 'Submit'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Answers are case-insensitive and auto-normalized.</span>
                  <span>Sequential team lock active.</span>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Col: Team Fragment Vault / Inventory */}
        <div className="space-y-5">
          
          {/* Fragment Vault Card */}
          <div className="cyber-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyber-gold font-display font-bold text-xs uppercase tracking-wider">
                <KeyRound className="w-4 h-4 text-cyber-gold" />
                <span>Level {activePuzzle.puzzleNumber} Vault</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyber-gold/15 text-cyber-gold font-mono">
                {activePuzzle.clues.filter((c) => clueProgress[`${activePuzzle.id}_${c.id}`]?.isSolved).length} / 5 Keys
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Collect all 4 fragments by solving Clues 1 to 4, then synthesize them in Clue 5 to crack the master puzzle.
            </p>

            {/* 4 Fragment Slots */}
            <div className="space-y-2.5">
              {activePuzzle.clues.slice(0, 4).map((clue) => {
                const prog = clueProgress[`${activePuzzle.id}_${clue.id}`];
                const isSolved = Boolean(prog?.isSolved);

                return (
                  <div
                    key={clue.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isSolved
                        ? 'bg-cyber-cyan/10 border-cyber-cyan/40 shadow-inner'
                        : 'bg-navy-950/80 border-slate-800/80 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {clue.fragmentLabel}
                      </span>
                      {isSolved ? (
                        <span className="text-[10px] text-cyber-teal font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-baseline justify-between">
                      <div className="font-mono text-sm font-bold">
                        {isSolved ? (
                          <span className="text-cyber-cyan glow-text-cyan">
                            "{prog?.earnedFragment}"
                          </span>
                        ) : (
                          <span className="text-slate-600">••••••••</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {clue.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formula Hint */}
            <div className="p-3 rounded-xl bg-navy-950 border border-cyber-gold/30 text-xs">
              <div className="text-[10px] font-bold text-cyber-gold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>Synthesis Guide</span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono">
                {activePuzzle.fragmentFormula}
              </div>
            </div>

            {/* Quick Button to Jump to Final Unlock */}
            <button
              onClick={() => {
                soundService.playClick();
                setActiveClueNumber(5);
              }}
              className="w-full py-2.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-cyber-gold/40 text-cyber-gold text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Proceed to Master Unlock (Clue 05)</span>
            </button>
          </div>

          {/* Room Teammates Live Activity Feed */}
          <div className="cyber-card rounded-2xl p-5 space-y-3">
            <div className="text-xs font-bold text-cyber-cyan uppercase tracking-wider border-b border-slate-800 pb-2">
              Team Audit Trail
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
              {roomState.submissions.length === 0 ? (
                <div className="text-slate-500 text-[11px] italic py-2 text-center">
                  No submissions recorded yet. Start cracking clues!
                </div>
              ) : (
                roomState.submissions.slice(-6).reverse().map((sub) => (
                  <div
                    key={sub.id}
                    className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                      sub.isCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-navy-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-white">{sub.submittedByParticipantName}</span>
                      <span> tried </span>
                      <span className="font-mono">"{sub.answerText}"</span>
                    </div>
                    <span className={sub.isCorrect ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {sub.isCorrect ? 'SOLVED' : 'INCORRECT'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

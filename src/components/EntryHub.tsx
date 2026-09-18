import React, { useState } from 'react';
import { 
  Users, 
  PlusCircle, 
  LogIn, 
  Sparkles, 
  KeyRound, 
  Shield, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Participant } from '../types';
import { gameService } from '../services/gameService';
import { soundService } from '../services/audioService';

interface EntryHubProps {
  onRoomEntered: (roomId: string, participant: Participant) => void;
  onOpenEventModal: () => void;
}

export const EntryHub: React.FC<EntryHubProps> = ({ onRoomEntered, onOpenEventModal }) => {
  const existingParticipant = gameService.getCurrentParticipant();

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialCode = urlParams?.get('code')?.trim().toUpperCase() || '';

  const [mode, setMode] = useState<'create' | 'join'>(initialCode ? 'join' : 'create');
  const [name, setName] = useState(existingParticipant?.name || '');
  const [email, setEmail] = useState(existingParticipant?.email || '');
  const [registerNumber, setRegisterNumber] = useState(existingParticipant?.registerNumber || '');
  const [department, setDepartment] = useState(existingParticipant?.department || 'Computer Science and Engineering');
  const [college, setCollege] = useState(existingParticipant?.college || 'Ramco Institute of Technology');
  
  // Create Room fields
  const [teamName, setTeamName] = useState('');
  const [maxCapacity, setMaxCapacity] = useState<number>(3);

  // Join Room fields
  const [roomCode, setRoomCode] = useState(initialCode);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    soundService.playClick();

    if (!name.trim()) {
      setError('Please enter your full name.');
      soundService.playError();
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid academic/personal email.');
      soundService.playError();
      return;
    }
    if (!registerNumber.trim()) {
      setError('Please enter your College Register Number / Roll Number.');
      soundService.playError();
      return;
    }

    const participant: Participant = {
      id: existingParticipant?.id || `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      email: email.trim(),
      registerNumber: registerNumber.trim().toUpperCase(),
      department: department.trim(),
      college: college.trim(),
      avatarSeed: name.trim().toLowerCase().replace(/\s+/g, '-'),
      role: mode === 'create' ? 'leader' : 'member',
      createdAt: existingParticipant?.createdAt || new Date().toISOString(),
    };

    gameService.saveCurrentParticipant(participant);
    setIsLoading(true);

    try {
      if (mode === 'create') {
        if (!teamName.trim()) {
          setError('Please provide a creative Team Name.');
          soundService.playError();
          setIsLoading(false);
          return;
        }

        const { room } = await gameService.createRoom(teamName, participant, maxCapacity);
        soundService.playClueSolved();
        onRoomEntered(room.id, participant);
      } else {
        if (!roomCode.trim()) {
          setError('Please enter the 6-character Room Code.');
          soundService.playError();
          setIsLoading(false);
          return;
        }

        const res = await gameService.joinRoom(roomCode, participant);
        if (!res.success || !res.room) {
          setError(res.error || 'Failed to join room.');
          soundService.playError();
          setIsLoading(false);
          return;
        }

        soundService.playClueSolved();
        onRoomEntered(res.room.id, participant);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      soundService.playError();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Hero Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs font-semibold uppercase tracking-widest mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Mini Escape Room Challenge • 15 Main Puzzles • 75 Clues</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black font-display tracking-wide uppercase text-white">
          Crack The <span className="text-cyber-cyan glow-text-cyan">Mystery</span>
        </h2>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto mt-2">
          Collaborate with your team to crack sequential clues, collect answer fragments, and unlock the final vault keys. No timers. Pure deduction.
        </p>

        <button
          onClick={onOpenEventModal}
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-cyber-gold hover:underline"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>View Official Event Schedule, Rules & Coordinators</span>
        </button>
      </div>

      {/* Main Form Container */}
      <div className="cyber-card rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyber-cyan via-cyber-teal to-cyber-purple" />

        {/* Tab Buttons: Create Room vs Join Room */}
        <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-navy-950/80 border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError(null);
              soundService.playClick();
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all ${
              mode === 'create'
                ? 'bg-cyber-cyan text-navy-950 shadow-glow-cyan'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Team Room</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('join');
              setError(null);
              soundService.playClick();
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all ${
              mode === 'join'
                ? 'bg-cyber-teal text-navy-950 shadow-glow-teal'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Join with Code</span>
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Mode-Specific Room Settings */}
          {mode === 'create' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-navy-900/90 border border-cyber-cyan/20">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-cyber-cyan uppercase tracking-wider mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Cyber Knights, RIT Decoders"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-cyber-cyan text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-cyber-cyan uppercase tracking-wider mb-1">
                  Team Size ({maxCapacity})
                </label>
                <select
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-cyber-cyan text-xs sm:text-sm"
                >
                  <option value={1}>1 Member (Solo)</option>
                  <option value={2}>2 Members</option>
                  <option value={3}>3 Members (Max)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-navy-900/90 border border-cyber-teal/30">
              <label className="block text-xs font-bold text-cyber-teal uppercase tracking-wider mb-1">
                Enter 6-Character Room Code *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. MYST9X"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 rounded-lg bg-navy-950 border border-cyber-teal/40 text-cyber-teal font-mono font-bold text-base sm:text-lg tracking-widest focus:outline-none focus:border-cyber-teal uppercase"
                />
                <KeyRound className="w-5 h-5 text-cyber-teal absolute right-3 top-2.5 opacity-70" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ask your team leader for the 6-character room code.
              </p>
            </div>
          )}

          {/* Participant Credentials Section */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>Participant Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Karthik R"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-cyber-cyan text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Register / Roll Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 953621104052"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyber-cyan text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="student@ritrjpm.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-cyber-cyan text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Department *</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-cyber-cyan text-xs"
                >
                  <option value="Computer Science and Engineering">Computer Science & Engg (CSE)</option>
                  <option value="Information Technology">Information Technology (IT)</option>
                  <option value="Electronics and Communication Engineering">Electronics & Comm Engg (ECE)</option>
                  <option value="Electrical and Electronics Engineering">Electrical & Electronics Engg (EEE)</option>
                  <option value="Mechanical Engineering">Mechanical Engg (MECH)</option>
                  <option value="Civil Engineering">Civil Engg (CIVIL)</option>
                  <option value="Artificial Intelligence and Data Science">AI & Data Science (AIDS)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Institution</label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-navy-950/70 border border-slate-800 text-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-xl font-bold font-display uppercase tracking-wider text-navy-950 transition-all flex items-center justify-center gap-2 ${
                mode === 'create'
                  ? 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:brightness-110 shadow-glow-cyan'
                  : 'bg-gradient-to-r from-teal-400 via-cyan-300 to-amber-300 hover:brightness-110 shadow-glow-teal'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Users className="w-4 h-4" />
              <span>
                {isLoading 
                  ? 'Initializing...' 
                  : mode === 'create' 
                    ? 'Create Room & Enter Lobby' 
                    : 'Join Team Room'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-2xl mx-auto text-center">
        <div className="p-3 rounded-xl bg-navy-900/60 border border-slate-800 text-xs">
          <div className="font-bold text-cyber-cyan font-display">NO TIMERS</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Solve at your pace</div>
        </div>
        <div className="p-3 rounded-xl bg-navy-900/60 border border-slate-800 text-xs">
          <div className="font-bold text-cyber-teal font-display">REALTIME SYNC</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Instant room updates</div>
        </div>
        <div className="p-3 rounded-xl bg-navy-900/60 border border-slate-800 text-xs">
          <div className="font-bold text-cyber-gold font-display">FRAGMENT VAULT</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Collect & synthesize</div>
        </div>
        <div className="p-3 rounded-xl bg-navy-900/60 border border-slate-800 text-xs">
          <div className="font-bold text-cyber-purple font-display">15 PUZZLES</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Simple • Med • Hard</div>
        </div>
      </div>
    </div>
  );
};

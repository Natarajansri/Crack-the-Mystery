import React, { useState } from 'react';
import { 
  Users, 
  Copy, 
  Check, 
  Play, 
  Crown, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Share2,
  Shield,
  HelpCircle
} from 'lucide-react';
import { RoomState, Participant } from '../types';
import { gameService } from '../services/gameService';
import { soundService } from '../services/audioService';

interface LobbyViewProps {
  roomState: RoomState;
  currentParticipant: Participant;
  onStartChallenge: () => void;
  onOpenEventModal: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomState,
  currentParticipant,
  onStartChallenge,
  onOpenEventModal
}) => {
  const { room, members } = roomState;
  const isLeader = room.leaderId === currentParticipant.id;
  const myMember = members.find((m) => m.participantId === currentParticipant.id);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCopyCode = () => {
    soundService.playClick();
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    soundService.playClick();
    const url = `${window.location.origin}${window.location.pathname}?code=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleReady = () => {
    soundService.playClick();
    const newReady = !myMember?.isReady;
    gameService.updateMemberStatus(room.id, currentParticipant.id, true, newReady);
  };

  const handleStartGame = async () => {
    soundService.playVaultUnlock();
    setIsStarting(true);
    setErrorMsg(null);

    const res = gameService.startRoomChallenge(room.id, currentParticipant.id);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to start challenge');
      soundService.playError();
      setIsStarting(false);
      return;
    }

    onStartChallenge();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Banner: Room Code & Quick Sharing */}
      <div className="cyber-card rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-cyber-cyan/15 text-cyber-cyan text-xs font-semibold uppercase tracking-widest border border-cyber-cyan/30">
                Team Lobby
              </span>
              <span className="text-slate-400 text-xs">
                Capacity: <span className="text-white font-bold">{members.length} / {room.maxCapacity}</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display text-white mt-1.5 uppercase">
              {room.teamName}
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Share the unique code below with your teammates to assemble your squad.
            </p>
          </div>

          {/* Big Room Code Box */}
          <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-navy-950 px-5 py-3 rounded-xl border-2 border-cyber-cyan/50 shadow-glow-cyan">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-cyber-cyan">
                {room.code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg bg-navy-850 hover:bg-navy-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-navy-850 hover:bg-navy-800 border border-slate-700 text-xs text-slate-300 hover:text-cyber-teal transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Link Copied!' : 'Copy Room Link'}</span>
              </button>

              <button
                onClick={onOpenEventModal}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-navy-850 hover:bg-navy-800 border border-slate-700 text-xs text-cyber-gold transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Event Rules</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Members List vs Mission Briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Members Roster */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Squad Roster ({members.length} of {room.maxCapacity})</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Live Realtime Presence Enabled
            </span>
          </div>

          <div className="space-y-2.5">
            {members.map((member) => {
              const isMemberLeader = member.participantId === room.leaderId;
              const isSelf = member.participantId === currentParticipant.id;

              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    isSelf 
                      ? 'bg-navy-850/90 border-cyber-cyan/40 shadow-inner' 
                      : 'bg-navy-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar & Online Dot */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyber-cyan/30 to-cyber-purple/40 border border-slate-700 flex items-center justify-center font-display font-bold text-sm text-white">
                        {member.participant.name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-navy-900 ${
                          member.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                        title={member.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {member.participant.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyber-cyan/20 text-cyber-cyan font-semibold">
                            YOU
                          </span>
                        )}
                        {isMemberLeader && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyber-gold/20 text-cyber-gold font-semibold border border-cyber-gold/30">
                            <Crown className="w-3 h-3" />
                            LEADER
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{member.participant.registerNumber}</span>
                        <span>•</span>
                        <span className="truncate max-w-[150px] sm:max-w-[220px]">
                          {member.participant.department}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ready Status */}
                  <div className="flex items-center gap-2">
                    {member.isReady ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        Waiting
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row: Ready Toggle and Start Button */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
            {!isLeader && (
              <button
                onClick={handleToggleReady}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  myMember?.isReady
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-navy-800 text-white hover:bg-navy-750 border border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{myMember?.isReady ? 'Marked as Ready (Click to cancel)' : 'Mark as Ready'}</span>
              </button>
            )}

            {isLeader ? (
              <button
                onClick={handleStartGame}
                disabled={isStarting}
                className="w-full sm:w-auto ml-auto px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 text-navy-950 font-black font-display text-sm uppercase tracking-wider shadow-glow-cyan hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isStarting ? 'Launching Arena...' : 'Start Escape Room Challenge'}</span>
              </button>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2 italic ml-auto">
                <Clock className="w-3.5 h-3.5 text-cyber-gold animate-spin" />
                <span>Waiting for team leader to launch the escape room...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Mission Rules Card */}
        <div className="cyber-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-cyber-gold font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-2.5">
            <Sparkles className="w-4 h-4" />
            <span>Escape Room Protocol</span>
          </div>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-navy-950/80 border border-slate-800">
              <div className="font-bold text-cyber-cyan mb-0.5">15 Main Puzzles</div>
              <p className="text-[11px] text-slate-400">
                5 Simple, 5 Moderate, and 5 Hard challenges across cryptography, algorithms, networks, and cybersecurity.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-navy-950/80 border border-slate-800">
              <div className="font-bold text-cyber-teal mb-0.5">5 Connected Clues Each</div>
              <p className="text-[11px] text-slate-400">
                Odd word, riddle, anagram rearrangement, and hidden number clues yield answer fragments into your team vault.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-navy-950/80 border border-slate-800">
              <div className="font-bold text-cyber-purple mb-0.5">Team Synchrony</div>
              <p className="text-[11px] text-slate-400">
                When any team member solves a clue, the entire room unlocks the next step immediately in real-time.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-navy-950/80 border border-slate-800">
              <div className="font-bold text-emerald-400 mb-0.5">No Time Limits</div>
              <p className="text-[11px] text-slate-400">
                No ticking clocks or time expirations. Focus on logical deduction, observation, and teamwork.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  KeyRound, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  LogOut, 
  Users, 
  Sparkles,
  Info
} from 'lucide-react';
import { Participant, Room } from '../types';
import { soundService } from '../services/audioService';

import { isSupabaseConfigured } from '../services/supabase';
import { Database } from 'lucide-react';

interface HeaderProps {
  participant: Participant | null;
  room: Room | null;
  isAdminView: boolean;
  onToggleAdmin: () => void;
  onLeaveRoom: () => void;
  onShowCredits: () => void;
  onOpenDatabaseModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  participant,
  room,
  isAdminView,
  onToggleAdmin,
  onLeaveRoom,
  onShowCredits,
  onOpenDatabaseModal
}) => {
  const [isMuted, setIsMuted] = useState(soundService.getMuted());

  const handleToggleSound = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
    if (!muted) soundService.playClick();
  };

  return (
    <header className="sticky top-0 z-40 bg-navy-950/90 backdrop-blur-md border-b border-cyber-cyan/20 px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
        
        {/* Left: Branding & Event Identity */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-cyan/20 to-cyber-purple/30 border border-cyber-cyan/40 shadow-glow-cyan">
              <KeyRound className="w-5 h-5 text-cyber-cyan animate-pulse-glow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-cyber-gold uppercase font-sans">
                  RAMCO INSTITUTE OF TECHNOLOGY
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/30 rounded">
                  IE(I) CSE
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-wider text-white font-display uppercase bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                Crack The Mystery
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={handleToggleSound}
              className="p-2 rounded-lg bg-navy-850 hover:bg-navy-800 border border-slate-700 text-slate-300"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyber-cyan" />}
            </button>
            <button
              onClick={onShowCredits}
              className="p-2 rounded-lg bg-navy-850 hover:bg-navy-800 border border-slate-700 text-slate-300"
              title="Event Details & Coordinators"
            >
              <Info className="w-4 h-4 text-cyber-gold" />
            </button>
          </div>
        </div>

        {/* Center: Active Room Info (If connected) */}
        {room && !isAdminView && (
          <div className="flex items-center gap-2 sm:gap-3 bg-navy-850/80 px-3 py-1.5 rounded-full border border-cyber-cyan/30 text-xs shadow-inner">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-400 font-sans">ROOM:</span>
              <span className="font-mono font-bold text-cyber-cyan tracking-wider">{room.code}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">TEAM:</span>
              <span className="font-semibold text-white truncate max-w-[120px] sm:max-w-[180px]">
                {room.teamName}
              </span>
            </div>
          </div>
        )}

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-end">
          {/* Sound Toggle (Desktop) */}
          <button
            onClick={handleToggleSound}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-850 hover:bg-navy-800 border border-slate-700 text-xs text-slate-300 transition-colors"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyber-cyan" />
                <span className="text-cyber-cyan">Audio ON</span>
              </>
            )}
          </button>

          {/* Event Credits */}
          <button
            onClick={onShowCredits}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-navy-850 hover:bg-navy-800 border border-cyber-gold/30 text-xs text-cyber-gold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Event Info</span>
          </button>

          {/* Database Setup Button */}
          <button
            onClick={onOpenDatabaseModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isSupabaseConfigured
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
            title="Configure Cloud Database Connection"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isSupabaseConfigured ? 'DB Online' : 'Connect DB'}</span>
          </button>

          {/* Admin Toggle */}
          <button
            onClick={onToggleAdmin}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isAdminView
                ? 'bg-cyber-purple text-white shadow-glow-purple'
                : 'bg-navy-850 hover:bg-navy-800 border border-slate-700 text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyber-teal" />
            <span>{isAdminView ? 'Exit Admin' : 'Admin Portal'}</span>
          </button>

          {/* Participant Info & Leave */}
          {participant && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-white leading-tight">{participant.name}</div>
                <div className="text-[10px] text-cyber-cyan font-mono">{participant.registerNumber}</div>
              </div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyber-cyan to-cyber-purple flex items-center justify-center text-[11px] font-bold text-navy-950 font-display">
                {participant.name.charAt(0).toUpperCase()}
              </div>

              <button
                onClick={onLeaveRoom}
                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                title={room ? "Exit Room & Logout" : "Logout Profile"}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

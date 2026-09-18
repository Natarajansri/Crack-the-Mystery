import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  KeyRound, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Download, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Sliders,
  X,
  LogOut,
  Trash2,
  Trophy,
  Medal,
  Award,
  Crown,
  Clock,
  Sparkles,
  UserX,
  UserCheck,
  UserMinus
} from 'lucide-react';
import { gameService } from '../services/gameService';
import { soundService } from '../services/audioService';
import { PUZZLES_DATA } from '../data/puzzlesData';
import { Room, RoomMember, RoomState } from '../types';

interface AdminDashboardProps {
  onExit: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('mystery_admin_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Admin Tab: 'rooms' | 'clues' | 'coordinators'
  const [activeTab, setActiveTab] = useState<'rooms' | 'clues' | 'coordinators'>('rooms');

  // Rooms table data
  const [roomsData, setRoomsData] = useState<ReturnType<typeof gameService.getAllRoomsData>>([]);
  const [stats, setStats] = useState<ReturnType<typeof gameService.getAdminStats>>({
    totalRooms: 0,
    totalParticipants: 0,
    activeRooms: 0,
    completedRooms: 0,
    totalCluesSolved: 0,
    totalPuzzlesSolved: 0,
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lobby' | 'in_progress' | 'completed' | 'locked' | 'eliminated'>('all');
  const [sortBy, setSortBy] = useState<'progress' | 'recent' | 'team'>('progress');

  // Room Inspector & Elimination Modals
  const [selectedRoomState, setSelectedRoomState] = useState<RoomState | null>(null);
  const [resetConfirmRoomId, setResetConfirmRoomId] = useState<string | null>(null);
  const [eliminateConfirmRoom, setEliminateConfirmRoom] = useState<{ id: string; teamName: string; isEliminated: boolean } | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);

  const refreshData = async () => {
    try {
      await gameService.syncAllRoomsFromCloud();
    } catch {
      // ignore
    }
    setRoomsData(gameService.getAllRoomsData());
    setStats(gameService.getAdminStats());
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
      // Auto-poll every 3 seconds for realtime admin monitoring across all 60 participants
      const interval = setInterval(refreshData, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    soundService.playClick();
    const validCodes = ['RIT@Escape#2026', 'ritcse2026', 'admin@rit'];
    if (validCodes.includes(passcode.trim())) {
      setIsAuthenticated(true);
      sessionStorage.setItem('mystery_admin_auth', 'true');
      setAuthError(null);
      soundService.playClueSolved();
    } else {
      setAuthError('Access Denied: Invalid Master Passcode.');
      soundService.playError();
    }
  };

  const handleAdminLogout = () => {
    soundService.playClick();
    sessionStorage.removeItem('mystery_admin_auth');
    setIsAuthenticated(false);
    setPasscode('');
    setAuthError(null);
    onExit();
  };

  const handleExportCSV = () => {
    soundService.playClick();
    const csvContent = gameService.generateLeaderboardCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rit_crack_the_mystery_leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleLock = (roomId: string, currentStatus: string) => {
    soundService.playClick();
    const isLocked = currentStatus === 'locked';
    gameService.adminToggleLockRoom(roomId, !isLocked);
    refreshData();
  };

  const handleConfirmReset = (roomId: string) => {
    soundService.playError();
    gameService.adminResetRoom(roomId);
    setResetConfirmRoomId(null);
    refreshData();
  };

  const handleClearAllData = () => {
    soundService.playError();
    gameService.adminClearAllData();
    setShowClearAllModal(false);
    refreshData();
  };

  // Filtered & Sorted Rooms
  const filteredRooms = roomsData
    .filter((item) => {
      const matchesSearch = 
        item.room.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.room.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.members.some((m) => m.participant.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || item.room.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'progress') {
        if (b.puzzlesSolvedCount !== a.puzzlesSolvedCount) {
          return b.puzzlesSolvedCount - a.puzzlesSolvedCount;
        }
        return b.cluesSolvedCount - a.cluesSolvedCount;
      }
      if (sortBy === 'recent') {
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      }
      return a.room.teamName.localeCompare(b.room.teamName);
    });

  // Login Gate
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="cyber-card rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple flex items-center justify-center mx-auto shadow-glow-purple">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold font-display uppercase text-white">
              Admin Portal
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ramco Institute of Technology CSE / IE(I) Event Oversight
            </p>
          </div>

          {authError && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              placeholder="Enter Master Admin Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-cyber-purple"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold font-display uppercase tracking-wider shadow-glow-purple hover:brightness-110 transition-all"
            >
              Verify Credentials
            </button>
          </form>

          <button
            onClick={onExit}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Return to Participant Escape Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 text-cyber-purple text-[10px] font-bold uppercase tracking-wider border border-cyber-purple/30">
              Event Management & Realtime Monitoring
            </span>
            <span className="text-xs text-slate-400">
              RIT CSE & IE(I) Chapter
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-display text-white uppercase mt-1">
            Admin Command Center
          </h2>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={refreshData}
            className="p-2 rounded-xl bg-navy-850 hover:bg-navy-800 border border-slate-700 text-slate-300 hover:text-white"
            title="Refresh Realtime Room States"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 border border-slate-700 text-xs font-semibold text-cyber-cyan flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setShowClearAllModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors"
            title="Clear all participant registrations and rooms"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Data</span>
          </button>

          <button
            onClick={handleAdminLogout}
            className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors"
            title="Logout from Admin Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout Admin</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="cyber-card rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Rooms</div>
          <div className="text-2xl font-display font-black text-white mt-1">{stats.totalRooms}</div>
        </div>

        <div className="cyber-card rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Participants</div>
          <div className="text-2xl font-display font-black text-cyber-cyan mt-1">{stats.totalParticipants}</div>
        </div>

        <div className="cyber-card rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Escapes</div>
          <div className="text-2xl font-display font-black text-cyber-teal mt-1">{stats.activeRooms}</div>
        </div>

        <div className="cyber-card rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Puzzles Solved</div>
          <div className="text-2xl font-display font-black text-emerald-400 mt-1">{stats.totalPuzzlesSolved}</div>
        </div>

        <div className="cyber-card rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Clues Solved</div>
          <div className="text-2xl font-display font-black text-cyber-purple mt-1">{stats.totalCluesSolved}</div>
        </div>

        <div className="cyber-card rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Completed Rooms</div>
          <div className="text-2xl font-display font-black text-cyber-gold mt-1">{stats.completedRooms}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-display uppercase tracking-wider transition-all ${
            activeTab === 'rooms'
              ? 'bg-cyber-cyan text-navy-950 shadow-glow-cyan'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Rooms & Leaderboard ({roomsData.length})
        </button>

        <button
          onClick={() => setActiveTab('clues')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-display uppercase tracking-wider transition-all ${
            activeTab === 'clues'
              ? 'bg-cyber-teal text-navy-950 shadow-glow-teal'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Master Clues & Solutions (75)
        </button>

        <button
          onClick={() => setActiveTab('coordinators')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-display uppercase tracking-wider transition-all ${
            activeTab === 'coordinators'
              ? 'bg-cyber-gold text-navy-950 shadow-glow-gold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Event Committee & RIT Info
        </button>
      </div>

      {/* TAB 1: ALL ROOMS TABLE & PODIUM */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          
          {/* WINNERS PODIUM: 1ST, 2ND, 3RD PLACE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
                <h3 className="text-sm sm:text-base font-black font-display uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Official Escape Room Podium</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/30">
                    Live Leaderboard
                  </span>
                </h3>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {roomsData.filter((r) => r.isFinished).length} of {roomsData.length} Teams Completed
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 1ST PLACE - GOLD */}
              {(() => {
                const first = roomsData.find((r) => r.rank === 1);
                return (
                  <div className={`relative rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                    first
                      ? 'bg-gradient-to-b from-amber-500/15 via-navy-900 to-navy-950 border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                      : 'bg-navy-900/60 border-slate-800 opacity-60'
                  }`}>
                    <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-navy-950 font-black font-mono text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-glow-gold">
                      <Crown className="w-3 h-3" />
                      <span>1st Place • Champion</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                          <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider font-mono">
                            🥇 Gold Winner
                          </div>
                          <div className="text-base font-black text-white font-display truncate max-w-[200px]" title={first?.room.teamName || 'Awaiting Team'}>
                            {first ? first.room.teamName : 'Awaiting 1st Finisher'}
                          </div>
                          {first && (
                            <div className="text-[11px] font-mono text-slate-400">
                              Room Code: <span className="font-bold text-amber-300">{first.room.code}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {first ? (
                        <div className="space-y-2 mt-2">
                          <div className="p-2 rounded-xl bg-navy-950/80 border border-amber-500/30 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Status:</span>
                              <span className={`font-bold font-mono ${first.isFinished ? 'text-emerald-400' : 'text-amber-300'}`}>
                                {first.isFinished ? '🏆 ESCAPED & SOLVED ALL' : '⚡ LEADING IN PROGRESS'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span className="text-slate-400">Puzzles Solved:</span>
                              <span className="font-bold font-mono text-white">{first.puzzlesSolvedCount} / 15</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span className="text-slate-400">Clues Solved:</span>
                              <span className="font-bold font-mono text-amber-300">{first.cluesSolvedCount} / 75</span>
                            </div>
                            {first.formattedDuration && (
                              <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-800">
                                <span className="text-slate-400">Finish Duration:</span>
                                <span className="font-bold font-mono text-emerald-300">{first.formattedDuration}</span>
                              </div>
                            )}
                            {first.finishedAt && (
                              <div className="flex items-center justify-between text-[10px] mt-1 text-slate-400">
                                <span>Finished At:</span>
                                <span className="font-mono">{new Date(first.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              </div>
                            )}
                          </div>

                          {/* Members list */}
                          <div className="pt-1">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Team Members:</div>
                            <div className="flex flex-wrap gap-1">
                              {first.members.map((m) => (
                                <span key={m.id} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-200 border border-amber-500/20 text-[10px] font-medium">
                                  {m.participant.name} ({m.participant.department || 'CSE'})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-500 text-xs italic">
                          No team in 1st place yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2ND PLACE - SILVER */}
              {(() => {
                const second = roomsData.find((r) => r.rank === 2);
                return (
                  <div className={`relative rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    second
                      ? 'bg-gradient-to-b from-slate-400/15 via-navy-900 to-navy-950 border-slate-300/50 shadow-[0_0_20px_rgba(203,213,225,0.15)]'
                      : 'bg-navy-900/60 border-slate-800 opacity-60'
                  }`}>
                    <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-slate-300 text-navy-950 font-black font-mono text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-glow-cyan">
                      <Medal className="w-3 h-3" />
                      <span>2nd Place • Runner-Up</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-300/20 border border-slate-300/40 flex items-center justify-center text-slate-200 shadow-[0_0_15px_rgba(203,213,225,0.2)]">
                          <Medal className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                            🥈 Silver Runner-Up
                          </div>
                          <div className="text-base font-black text-white font-display truncate max-w-[200px]" title={second?.room.teamName || 'Awaiting Team'}>
                            {second ? second.room.teamName : 'Awaiting 2nd Finisher'}
                          </div>
                          {second && (
                            <div className="text-[11px] font-mono text-slate-400">
                              Room Code: <span className="font-bold text-slate-200">{second.room.code}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {second ? (
                        <div className="space-y-2 mt-2">
                          <div className="p-2 rounded-xl bg-navy-950/80 border border-slate-700 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Status:</span>
                              <span className={`font-bold font-mono ${second.isFinished ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {second.isFinished ? '🏆 ESCAPED & SOLVED ALL' : '⚡ IN PROGRESS'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span className="text-slate-400">Puzzles Solved:</span>
                              <span className="font-bold font-mono text-white">{second.puzzlesSolvedCount} / 15</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span className="text-slate-400">Clues Solved:</span>
                              <span className="font-bold font-mono text-slate-200">{second.cluesSolvedCount} / 75</span>
                            </div>
                            {second.formattedDuration && (
                              <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-800">
                                <span className="text-slate-400">Finish Duration:</span>
                                <span className="font-bold font-mono text-emerald-300">{second.formattedDuration}</span>
                              </div>
                            )}
                            {second.finishedAt && (
                              <div className="flex items-center justify-between text-[10px] mt-1 text-slate-400">
                                <span>Finished At:</span>
                                <span className="font-mono">{new Date(second.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              </div>
                            )}
                          </div>

                          {/* Members list */}
                          <div className="pt-1">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Team Members:</div>
                            <div className="flex flex-wrap gap-1">
                              {second.members.map((m) => (
                                <span key={m.id} className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-200 border border-slate-600 text-[10px] font-medium">
                                  {m.participant.name} ({m.participant.department || 'CSE'})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-500 text-xs italic">
                          No team in 2nd place yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 3RD PLACE - BRONZE */}
              {(() => {
                const third = roomsData.find((r) => r.rank === 3);
                return (
                  <div className={`relative rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    third
                      ? 'bg-gradient-to-b from-amber-700/15 via-navy-900 to-navy-950 border-amber-600/50 shadow-[0_0_20px_rgba(217,119,6,0.15)]'
                      : 'bg-navy-900/60 border-slate-800 opacity-60'
                  }`}>
                    <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-amber-700 text-white font-black font-mono text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-glow-gold">
                      <Award className="w-3 h-3" />
                      <span>3rd Place • 2nd Runner-Up</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-700/20 border border-amber-600/40 flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.2)]">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider font-mono">
                            🥉 Bronze 2nd Runner-Up
                          </div>
                          <div className="text-base font-black text-white font-display truncate max-w-[200px]" title={third?.room.teamName || 'Awaiting Team'}>
                            {third ? third.room.teamName : 'Awaiting 3rd Finisher'}
                          </div>
                          {third && (
                            <div className="text-[11px] font-mono text-slate-400">
                              Room Code: <span className="font-bold text-amber-400">{third.room.code}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {third ? (
                        <div className="space-y-2 mt-2">
                          <div className="p-2 rounded-xl bg-navy-950/80 border border-amber-700/40 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Status:</span>
                              <span className={`font-bold font-mono ${third.isFinished ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {third.isFinished ? '🏆 ESCAPED & SOLVED ALL' : '⚡ IN PROGRESS'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span className="text-slate-400">Puzzles Solved:</span>
                              <span className="font-bold font-mono text-white">{third.puzzlesSolvedCount} / 15</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span className="text-slate-400">Clues Solved:</span>
                              <span className="font-bold font-mono text-amber-400">{third.cluesSolvedCount} / 75</span>
                            </div>
                            {third.formattedDuration && (
                              <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-800">
                                <span className="text-slate-400">Finish Duration:</span>
                                <span className="font-bold font-mono text-emerald-300">{third.formattedDuration}</span>
                              </div>
                            )}
                            {third.finishedAt && (
                              <div className="flex items-center justify-between text-[10px] mt-1 text-slate-400">
                                <span>Finished At:</span>
                                <span className="font-mono">{new Date(third.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              </div>
                            )}
                          </div>

                          {/* Members list */}
                          <div className="pt-1">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Team Members:</div>
                            <div className="flex flex-wrap gap-1">
                              {third.members.map((m) => (
                                <span key={m.id} className="px-2 py-0.5 rounded bg-amber-800/30 text-amber-300 border border-amber-700/40 text-[10px] font-medium">
                                  {m.participant.name} ({m.participant.department || 'CSE'})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-500 text-xs italic">
                          No team in 3rd place yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
          
          {/* Filter / Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-navy-900 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search team, code, participant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-navy-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyber-cyan"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
              <span className="text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-navy-950 border border-slate-700 text-white text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="lobby">In Lobby</option>
                <option value="locked">Locked</option>
              </select>

              <span className="text-slate-400 ml-2">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-navy-950 border border-slate-700 text-white text-xs"
              >
                <option value="progress">Top Rank / Progress</option>
                <option value="recent">Last Active</option>
                <option value="team">Team Name</option>
              </select>
            </div>
          </div>

          {/* Rooms Table */}
          <div className="cyber-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950 text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Room Code</th>
                    <th className="py-3 px-4">Team Name</th>
                    <th className="py-3 px-4">Members & Presence</th>
                    <th className="py-3 px-4">Puzzles Solved</th>
                    <th className="py-3 px-4">Clues Solved</th>
                    <th className="py-3 px-4">Finish / Duration</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                        No team rooms match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((item) => {
                      const isGold = item.rank === 1;
                      const isSilver = item.rank === 2;
                      const isBronze = item.rank === 3;

                      return (
                        <tr 
                          key={item.room.id} 
                          className={`transition-colors ${
                            isGold 
                              ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-amber-400' 
                              : isSilver 
                                ? 'bg-slate-300/10 hover:bg-slate-300/15 border-l-4 border-slate-300' 
                                : isBronze 
                                  ? 'bg-amber-700/10 hover:bg-amber-700/15 border-l-4 border-amber-600' 
                                  : 'hover:bg-navy-850/50'
                          }`}
                        >
                          {/* Rank Badge */}
                          <td className="py-3 px-3 text-center">
                            {isGold ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/60 text-amber-300 font-black font-mono text-[11px] shadow-glow-gold">
                                🥇 1st
                              </span>
                            ) : isSilver ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-300/25 border border-slate-300/60 text-slate-200 font-black font-mono text-[11px] shadow-glow-cyan">
                                🥈 2nd
                              </span>
                            ) : isBronze ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-700/25 border border-amber-600/60 text-amber-400 font-black font-mono text-[11px]">
                                🥉 3rd
                              </span>
                            ) : (
                              <span className="font-mono text-slate-400 text-xs font-bold">
                                #{item.rank || '-'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-cyber-cyan">
                            {item.room.code}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{item.room.teamName}</span>
                              {isGold && <Crown className="w-3.5 h-3.5 text-amber-400 inline" />}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Created {new Date(item.room.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.members.map((m) => (
                                <span
                                  key={m.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                                    m.isOnline 
                                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}
                                  title={`${m.participant.name} (${m.participant.department}) - ${m.isOnline ? 'Online' : 'Offline'}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${m.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                  <span>{m.participant.name.split(' ')[0]}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-cyber-cyan text-sm">
                                {item.puzzlesSolvedCount}
                              </span>
                              <span className="text-slate-500">/ 15</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-cyber-teal text-sm">
                                {item.cluesSolvedCount}
                              </span>
                              <span className="text-slate-500">/ 75</span>
                            </div>
                          </td>
                          
                          {/* Finish Time / Duration */}
                          <td className="py-3 px-4">
                            {item.isFinished && item.formattedDuration ? (
                              <div>
                                <div className="font-mono font-bold text-emerald-400 text-xs flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{item.formattedDuration}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {item.finishedAt ? new Date(item.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-500 text-[11px] font-mono italic">
                                Active {new Date(item.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              item.room.status === 'eliminated'
                                ? 'bg-rose-600/25 text-rose-300 border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.3)] font-black'
                                : item.room.status === 'completed'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                  : item.room.status === 'in_progress'
                                    ? 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/40'
                                    : item.room.status === 'locked'
                                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                              {item.room.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Inspect Room */}
                              <button
                                onClick={() => {
                                  soundService.playClick();
                                  const state = gameService.getRoomState(item.room.id);
                                  setSelectedRoomState(state);
                                }}
                                className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-300 hover:text-white"
                                title="Inspect Room Timeline & Solvers"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Lock / Unlock */}
                              <button
                                onClick={() => handleToggleLock(item.room.id, item.room.status)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  item.room.status === 'locked'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : 'bg-navy-800 hover:bg-navy-750 text-slate-300 border-slate-700'
                                }`}
                                title={item.room.status === 'locked' ? 'Unlock Room' : 'Lock Room'}
                              >
                                {item.room.status === 'locked' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>

                              {/* Eliminate / Reinstate Team */}
                              <button
                                onClick={() => {
                                  soundService.playClick();
                                  setEliminateConfirmRoom({
                                    id: item.room.id,
                                    teamName: item.room.teamName,
                                    isEliminated: item.room.status === 'eliminated'
                                  });
                                }}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  item.room.status === 'eliminated'
                                    ? 'bg-rose-600/30 text-rose-300 border-rose-500 hover:bg-rose-600/50'
                                    : 'bg-navy-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border-slate-700 hover:border-rose-500/40'
                                }`}
                                title={item.room.status === 'eliminated' ? 'Reinstate / Restore Team' : 'Eliminate / Disqualify Team'}
                              >
                                {item.room.status === 'eliminated' ? (
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Reset Room with confirmation */}
                              <button
                                onClick={() => {
                                  soundService.playClick();
                                  setResetConfirmRoomId(item.room.id);
                                }}
                                className="p-1.5 rounded-lg bg-navy-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700"
                                title="Reset Room Progress"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Room */}
                              <button
                                onClick={() => {
                                  soundService.playError();
                                  if (window.confirm(`Permanently delete room "${item.room.teamName}" (${item.room.code})?`)) {
                                    gameService.adminDeleteRoom(item.room.id);
                                    refreshData();
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-navy-800 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-700"
                                title="Delete Room"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MASTER CLUES & SOLUTIONS (75 CLUES) */}
      {activeTab === 'clues' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400">
            Reference database of all 15 escape room mystery challenges and 75 clues.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PUZZLES_DATA.map((puz) => (
              <div key={puz.id} className="cyber-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-[10px] text-cyber-cyan font-mono uppercase font-bold">
                      Level {puz.puzzleNumber} • {puz.difficulty}
                    </span>
                    <h4 className="text-sm font-bold text-white font-display">
                      {puz.title}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyber-gold/15 text-cyber-gold border border-cyber-gold/30">
                    KEY: {puz.finalAnswer}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {puz.clues.map((c) => (
                    <div key={c.id} className="p-2 rounded bg-navy-950 border border-slate-800">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300">
                          0{c.clueNumber}. {c.title}
                        </span>
                        <span className="text-cyber-cyan font-mono font-bold">
                          "{c.expectedFragment}"
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                        {c.prompt}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COORDINATORS & INSTITUTION */}
      {activeTab === 'coordinators' && (
        <div className="cyber-card rounded-2xl p-6 space-y-6">
          <div className="text-center border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold font-display uppercase text-white">
              Ramco Institute of Technology
            </h3>
            <p className="text-xs text-cyber-gold">Department of Computer Science and Engineering & IE(I) Student Chapter</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 space-y-2">
              <div className="font-bold text-cyber-cyan uppercase tracking-wider">Faculty Coordinators</div>
              <ul className="space-y-1 text-slate-300">
                <li>• Mrs. S. Vijaya Amala Devi (AP-I/CSE)</li>
                <li>• Mrs. A. Sofia Thanga Mary (AP/CSE)</li>
                <li>• Mrs. M. Arunthathi (AP-I/CSE)</li>
                <li>• Mrs. M. Deepa Lakshmi (AP-I/CSE)</li>
                <li>• Mrs. Priya K (AP/CSE)</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 space-y-2">
              <div className="font-bold text-cyber-teal uppercase tracking-wider">Student Coordinators</div>
              <ul className="space-y-1 text-slate-300">
                <li>• Subiksha S (III CSE-B)</li>
                <li>• Vaitheeswari (III CSE-B)</li>
                <li>• Bharathan B (II CSE-B)</li>
                <li>• Abishek R (II CSE-B)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT ROOM STATE */}
      {selectedRoomState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-navy-900 border border-cyber-cyan/40 rounded-2xl p-6 shadow-2xl my-8">
            <button
              onClick={() => setSelectedRoomState(null)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-navy-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold font-display uppercase text-white mb-1 flex items-center gap-2">
              <span>Room Audit: {selectedRoomState.room.teamName}</span>
              <span className="font-mono text-cyber-cyan text-sm">({selectedRoomState.room.code})</span>
            </h3>

            {(() => {
              const summary = roomsData.find((r) => r.room.id === selectedRoomState.room.id);
              return (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {summary?.rank && (
                    <span className="px-2.5 py-0.5 rounded-full bg-cyber-purple/20 border border-cyber-purple/40 text-cyber-purple text-[11px] font-bold font-mono">
                      Official Rank: #{summary.rank}
                    </span>
                  )}
                  {summary?.formattedDuration && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Finished in {summary.formattedDuration}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    Status: <span className="font-bold text-white uppercase">{selectedRoomState.room.status}</span> • Current Level: <span className="font-bold text-cyber-cyan">{selectedRoomState.room.currentPuzzleNumber} / 15</span>
                  </span>
                </div>
              );
            })()}

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              <div className="text-xs font-bold text-cyber-cyan uppercase">Clue Solvers Timeline:</div>
              {Object.values(selectedRoomState.clueProgress).length === 0 ? (
                <div className="text-slate-500 text-xs italic">No clues solved yet in this room.</div>
              ) : (
                Object.values(selectedRoomState.clueProgress).map((cp) => (
                  <div key={cp.id} className="p-2.5 rounded-lg bg-navy-950 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">Clue 0{cp.clueNumber}</span>
                      <span className="text-slate-400"> ({cp.puzzleId}) - Fragment: </span>
                      <span className="text-cyber-cyan font-mono font-bold">"{cp.earnedFragment}"</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Solved by <span className="text-slate-200">{cp.solvedByParticipantName || 'Team'}</span> at{' '}
                      {cp.solvedAt ? new Date(cp.solvedAt).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                ))
              )}

              <div className="text-xs font-bold text-cyber-gold uppercase pt-3">Submission Attempts Audit:</div>
              {selectedRoomState.submissions.length === 0 ? (
                <div className="text-slate-500 text-xs italic">No submission attempts logged.</div>
              ) : (
                selectedRoomState.submissions.slice(-10).reverse().map((sub) => (
                  <div key={sub.id} className="p-2 rounded bg-navy-950 border border-slate-850 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="text-white">{sub.submittedByParticipantName}</span>: <span className="font-mono">"{sub.answerText}"</span>
                    </div>
                    <span className={sub.isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                      {sub.isCorrect ? 'CORRECT' : 'INCORRECT'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM RESET DIALOG */}
      {resetConfirmRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-navy-900 border border-rose-500/50 rounded-2xl p-6 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold font-display uppercase text-white">
              Reset Room Progress?
            </h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to reset all solved clues, fragments, and progress for this room back to Level 1? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setResetConfirmRoomId(null)}
                className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmReset(resetConfirmRoomId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-display uppercase"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM ELIMINATE / REINSTATE DIALOG */}
      {eliminateConfirmRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-navy-900 border border-rose-500/60 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              {eliminateConfirmRoom.isEliminated ? (
                <UserCheck className="w-6 h-6 text-emerald-400" />
              ) : (
                <UserX className="w-6 h-6" />
              )}
            </div>
            
            <h3 className="text-base font-bold font-display uppercase text-white">
              {eliminateConfirmRoom.isEliminated ? 'Reinstate / Restore Team?' : 'Eliminate Team from Event?'}
            </h3>
            
            <p className="text-xs text-slate-300">
              {eliminateConfirmRoom.isEliminated ? (
                <>Restore team <strong className="text-white">"{eliminateConfirmRoom.teamName}"</strong> back to active competition?</>
              ) : (
                <>Are you sure you want to eliminate team <strong className="text-white">"{eliminateConfirmRoom.teamName}"</strong>? Their room status will become <span className="text-rose-400 font-bold">ELIMINATED</span>, further puzzle submissions will be blocked, and they will be removed from top podium placement.</>
              )}
            </p>
            
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setEliminateConfirmRoom(null)}
                className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  soundService.playClick();
                  gameService.adminEliminateRoom(eliminateConfirmRoom.id, !eliminateConfirmRoom.isEliminated);
                  setEliminateConfirmRoom(null);
                  refreshData();
                }}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold font-display uppercase tracking-wider ${
                  eliminateConfirmRoom.isEliminated 
                    ? 'bg-emerald-600 hover:bg-emerald-500' 
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {eliminateConfirmRoom.isEliminated ? 'Confirm Reinstate' : 'Confirm Eliminate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR ALL DATA DIALOG */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-navy-900 border border-rose-500/50 rounded-2xl p-6 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold font-display uppercase text-white">
              Clear All Participants & Rooms?
            </h3>
            <p className="text-xs text-slate-300">
              This will purge all created rooms, registered participants, answer attempts, and team progress across the entire event. Are you sure you want to proceed?
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-display uppercase"
              >
                Confirm Clear All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Sparkles,
  Server,
  Zap
} from 'lucide-react';
import { 
  isSupabaseConfigured, 
  currentSupabaseUrl, 
  currentSupabaseAnonKey, 
  setRuntimeSupabaseCredentials 
} from '../services/supabase';
import { soundService } from '../services/audioService';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [url, setUrl] = useState(currentSupabaseUrl);
  const [anonKey, setAnonKey] = useState(currentSupabaseAnonKey);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    soundService.playClick();
    setIsSaving(true);
    setStatusMsg(null);

    if (!url.trim().startsWith('https://')) {
      setStatusMsg({ text: 'Project URL must start with https:// (e.g., https://xyz.supabase.co)', isError: true });
      setIsSaving(false);
      return;
    }

    if (!anonKey.trim() || anonKey.trim().length < 20) {
      setStatusMsg({ text: 'Please enter a valid Supabase anon public API key.', isError: true });
      setIsSaving(false);
      return;
    }

    const success = setRuntimeSupabaseCredentials(url, anonKey);
    if (success) {
      setStatusMsg({ text: 'Supabase Realtime Database connected successfully!', isError: false });
      soundService.playClueSolved();
      if (onConnected) onConnected();
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setStatusMsg({ text: 'Failed to initialize Supabase client. Please check your credentials.', isError: true });
      soundService.playError();
    }
    setIsSaving(false);
  };

  const handleCopySql = () => {
    soundService.playClick();
    const sqlSchema = `-- ==========================================================
-- CRACK THE MYSTERY - RAMCO INSTITUTE OF TECHNOLOGY
-- MINI ESCAPE ROOM CHALLENGE DATABASE SCHEMA & MIGRATIONS
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    register_number VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    college VARCHAR(200) NOT NULL DEFAULT 'Ramco Institute of Technology',
    avatar_seed VARCHAR(50) NOT NULL DEFAULT 'cyber-detective',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    team_name VARCHAR(150) NOT NULL,
    leader_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    max_capacity INT NOT NULL DEFAULT 3,
    status VARCHAR(30) NOT NULL DEFAULT 'lobby',
    current_puzzle_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT true,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_participant UNIQUE (room_id, participant_id)
);

CREATE TABLE IF NOT EXISTS public.clue_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    puzzle_id VARCHAR(50) NOT NULL,
    clue_id VARCHAR(50) NOT NULL,
    clue_number INT NOT NULL,
    is_solved BOOLEAN NOT NULL DEFAULT true,
    solved_by_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    earned_fragment VARCHAR(100) NOT NULL,
    solved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_clue_progress UNIQUE (room_id, puzzle_id, clue_id)
);

CREATE TABLE IF NOT EXISTS public.puzzle_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    puzzle_id VARCHAR(50) NOT NULL,
    puzzle_number INT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT true,
    completed_by_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_puzzle_progress UNIQUE (room_id, puzzle_id)
);

CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    puzzle_id VARCHAR(50) NOT NULL,
    clue_id VARCHAR(50),
    clue_number INT,
    submitted_by_participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    submission_type VARCHAR(20) NOT NULL,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clue_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.puzzle_progress;

-- Open policies for participants
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clue_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_participants" ON public.participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rooms" ON public.rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_members" ON public.room_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_clues" ON public.clue_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_puzzles" ON public.puzzle_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);
`;

    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl cyber-card rounded-2xl p-6 sm:p-8 border border-cyber-cyan/30 shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyber-cyan via-emerald-400 to-cyber-purple" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-navy-900/60 hover:bg-navy-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display uppercase tracking-wide text-white flex items-center gap-2">
              <span>Connect Cloud Database</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-sans font-bold uppercase tracking-wider ${
                isSupabaseConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {isSupabaseConfigured ? 'Connected' : 'Setup Required'}
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Enables real-time WebSockets and cross-device room joining for all 60 participants.
            </p>
          </div>
        </div>

        {/* Quick Instructions Step Box */}
        <div className="p-3.5 rounded-xl bg-navy-900/80 border border-slate-800 mb-5 text-xs text-slate-300 space-y-2">
          <div className="flex items-center justify-between font-semibold text-cyber-cyan">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyber-gold" />
              <span>30-Second Setup Instructions:</span>
            </span>
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 font-mono text-[11px] transition-all"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
            </button>
          </div>

          <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
            <li>Open your project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-cyber-cyan underline">supabase.com</a>.</li>
            <li>Click <strong>SQL Editor</strong> → <strong>New Query</strong> → Paste the copied SQL schema → Click <strong>Run</strong>.</li>
            <li>Go to <strong>Project Settings</strong> → <strong>API</strong> → Copy the <strong>Project URL</strong> and <strong>anon public key</strong>.</li>
            <li>Paste them below and click <strong>Connect Database</strong>!</li>
          </ol>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Supabase Project URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project-id.supabase.co"
              className="cyber-input w-full px-3 py-2.5 rounded-lg text-xs sm:text-sm font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Supabase Anon Public API Key
            </label>
            <input
              type="text"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="cyber-input w-full px-3 py-2.5 rounded-lg text-xs sm:text-sm font-mono"
              required
            />
          </div>

          {statusMsg && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMsg.isError 
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300' 
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}>
              {statusMsg.isError ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-cyber-cyan hover:bg-cyan-300 text-navy-950 font-bold text-xs sm:text-sm tracking-wide shadow-glow-cyan transition-all flex items-center justify-center gap-2"
            >
              <Server className="w-4 h-4" />
              <span>{isSaving ? 'Connecting...' : 'Connect Database'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-850 text-slate-300 font-semibold text-xs border border-slate-700"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

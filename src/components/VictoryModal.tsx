import React from 'react';
import { Trophy, Award, Printer, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { RoomState } from '../types';
import { soundService } from '../services/audioService';

interface VictoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomState: RoomState;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  isOpen,
  onClose,
  roomState
}) => {
  if (!isOpen) return null;

  const { room, members, puzzleProgress } = roomState;
  const completedCount = Object.values(puzzleProgress).filter((p) => p.isCompleted).length;

  const handlePrint = () => {
    soundService.playClick();
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-navy-900 border-2 border-cyber-gold rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-950/80 my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-navy-800 text-slate-400 hover:text-white hover:bg-navy-750 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Certificate Container for display and print */}
        <div className="border-4 border-double border-cyber-gold/60 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-center relative overflow-hidden">
          
          {/* Subtle Background Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
            <Trophy className="w-96 h-96 text-cyber-gold" />
          </div>

          {/* Trophy Header */}
          <div className="inline-flex p-3 rounded-full bg-cyber-gold/20 border border-cyber-gold text-cyber-gold mb-3 shadow-glow-gold">
            <Trophy className="w-10 h-10 animate-bounce" />
          </div>

          <div className="text-xs font-bold tracking-widest text-cyber-gold uppercase font-sans">
            RAMCO INSTITUTE OF TECHNOLOGY
          </div>
          <div className="text-[11px] text-slate-400">
            Approved by AICTE | Affiliated to Anna University | NAAC 'A+' Grade
          </div>
          <div className="text-xs font-semibold text-cyber-cyan uppercase mt-1">
            Department of Computer Science and Engineering
          </div>
          <div className="text-[11px] text-cyber-purple font-medium mb-4">
            in association with IE(I) STUDENT CHAPTER
          </div>

          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-wider uppercase bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
            Certificate of Accomplishment
          </h2>
          <p className="text-xs text-cyber-teal font-sans tracking-wide mt-1">
            MINI ESCAPE ROOM CHALLENGE • CRACK THE MYSTERY
          </p>

          {/* Certificate Body */}
          <div className="my-6 space-y-3 text-slate-200 text-sm sm:text-base">
            <p>
              This is to honor and certify that team
            </p>
            <div className="text-xl sm:text-2xl font-black font-display text-cyber-cyan glow-text-cyan uppercase">
              "{room.teamName}"
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
              Comprising of members:{' '}
              <span className="font-semibold text-white">
                {members.map((m) => m.participant.name).join(', ')}
              </span>
            </p>
            <p className="text-xs sm:text-sm text-slate-300">
              has demonstrated exemplary problem-solving skills, algorithmic deduction, and teamwork by solving{' '}
              <span className="font-bold text-cyber-gold">{completedCount} of 15</span> main mystery puzzles and collecting the master cryptographic keys.
            </p>
          </div>

          {/* Signatures Row */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800 text-[11px] text-slate-300">
            <div>
              <div className="font-serif italic text-sm text-cyber-gold">Dr. K. Vijayalakshmi</div>
              <div className="font-bold text-slate-400 uppercase text-[10px] mt-0.5">Convenor (HOD/CSE)</div>
            </div>
            <div>
              <div className="font-serif italic text-sm text-cyber-gold">Dr. S. Rajakarunakaran</div>
              <div className="font-bold text-slate-400 uppercase text-[10px] mt-0.5">Principal</div>
            </div>
            <div>
              <div className="font-serif italic text-sm text-cyber-gold">Dr. L. Ganesan</div>
              <div className="font-bold text-slate-400 uppercase text-[10px] mt-0.5">Director</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Recorded in official event audit ledger</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4 text-cyber-cyan" />
              <span>Print Diploma</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-cyber-gold text-navy-950 text-xs font-black font-display uppercase tracking-wider shadow-glow-gold hover:brightness-110 transition-all"
            >
              Return to Arena
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

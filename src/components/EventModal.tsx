import React from 'react';
import { X, Calendar, Clock, MapPin, Award, Users, BookOpen, Sparkles } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-navy-900 border border-cyber-cyan/40 rounded-2xl p-6 shadow-2xl shadow-cyan-950/80 my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-navy-800 text-slate-400 hover:text-white hover:bg-navy-750 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Institution Header */}
        <div className="text-center pb-4 border-b border-slate-800">
          <div className="text-xs font-semibold text-cyber-gold tracking-widest uppercase">
            RAMCO INSTITUTE OF TECHNOLOGY (An Autonomous Institution)
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Approved by AICTE, New Delhi | Affiliated to Anna University, Chennai | Accredited by NAAC 'A+' | ISO 9001:2015
          </div>
          <div className="text-xs font-semibold text-cyber-cyan mt-1 uppercase">
            Department of Computer Science and Engineering
          </div>
          <div className="text-[11px] text-cyber-purple font-medium">
            in association with IE(I) STUDENT CHAPTER
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-display tracking-wider text-white mt-3 uppercase">
            Crack The Mystery
          </h2>
          <p className="text-xs text-cyber-teal font-sans tracking-wide">
            A Mini Escape Room Challenge • Solve • Explore • Escape
          </p>
        </div>

        {/* Event Schedule & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-4">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-navy-850 border border-slate-800 text-xs">
            <Calendar className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
            <div>
              <div className="text-slate-400 text-[10px]">DATE</div>
              <div className="font-semibold text-white">19 Sep 2026</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-navy-850 border border-slate-800 text-xs">
            <Clock className="w-4 h-4 text-cyber-gold flex-shrink-0" />
            <div>
              <div className="text-slate-400 text-[10px]">TIME WINDOW</div>
              <div className="font-semibold text-white">1:30 PM – 4:30 PM</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-navy-850 border border-slate-800 text-xs">
            <MapPin className="w-4 h-4 text-cyber-purple flex-shrink-0" />
            <div>
              <div className="text-slate-400 text-[10px]">VENUE</div>
              <div className="font-semibold text-white">Lab C2R06</div>
            </div>
          </div>
        </div>

        {/* 5-Step Escape Room Architecture */}
        <div className="bg-navy-950/60 p-3.5 rounded-xl border border-cyber-cyan/20 my-4">
          <div className="text-xs font-bold text-cyber-cyan uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Escape Room 5-Step Pipeline</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="p-2 rounded bg-navy-850 border border-slate-800">
              <div className="text-cyber-cyan font-bold font-display text-sm">01</div>
              <div className="text-slate-300 text-[11px] mt-0.5">Find Odd Word</div>
            </div>
            <div className="p-2 rounded bg-navy-850 border border-slate-800">
              <div className="text-cyber-teal font-bold font-display text-sm">02</div>
              <div className="text-slate-300 text-[11px] mt-0.5">Solve Riddle</div>
            </div>
            <div className="p-2 rounded bg-navy-850 border border-slate-800">
              <div className="text-cyber-gold font-bold font-display text-sm">03</div>
              <div className="text-slate-300 text-[11px] mt-0.5">Rearrange</div>
            </div>
            <div className="p-2 rounded bg-navy-850 border border-slate-800">
              <div className="text-cyber-purple font-bold font-display text-sm">04</div>
              <div className="text-slate-300 text-[11px] mt-0.5">Hidden Number</div>
            </div>
            <div className="col-span-2 sm:col-span-1 p-2 rounded bg-navy-850 border border-cyber-gold/40">
              <div className="text-cyber-gold font-bold font-display text-sm">05</div>
              <div className="text-cyber-gold text-[11px] mt-0.5 font-semibold">Master Unlock</div>
            </div>
          </div>
        </div>

        {/* Faculty & Student Coordinators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mt-4 pt-3 border-t border-slate-800">
          <div>
            <div className="font-bold text-cyber-cyan uppercase tracking-wider mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Faculty Coordinators</span>
            </div>
            <ul className="text-slate-300 space-y-0.5 text-[11px]">
              <li>• Mrs. S. Vijaya Amala Devi (AP-I/CSE)</li>
              <li>• Mrs. A. Sofia Thanga Mary (AP/CSE)</li>
              <li>• Mrs. M. Arunthathi (AP-I/CSE)</li>
              <li>• Mrs. M. Deepa Lakshmi (AP-I/CSE)</li>
              <li>• Mrs. Priya K (AP/CSE)</li>
            </ul>
          </div>
          <div>
            <div className="font-bold text-cyber-teal uppercase tracking-wider mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>Student Coordinators</span>
            </div>
            <ul className="text-slate-300 space-y-0.5 text-[11px]">
              <li>• Subiksha S (III CSE-B)</li>
              <li>• Vaitheeswari (III CSE-B)</li>
              <li>• Bharathan B (II CSE-B)</li>
              <li>• Abishek R (II CSE-B)</li>
            </ul>
          </div>
        </div>

        {/* Administration Footer */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] mt-4 pt-3 border-t border-slate-800 text-slate-400">
          <div>
            <div className="font-bold text-slate-200">Dr. K. Vijayalakshmi</div>
            <div>Convenor (HOD/CSE)</div>
          </div>
          <div>
            <div className="font-bold text-slate-200">Dr. S. Rajakarunakaran</div>
            <div>Principal</div>
          </div>
          <div>
            <div className="font-bold text-slate-200">Dr. L. Ganesan</div>
            <div>Director</div>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { EntryHub } from './components/EntryHub';
import { LobbyView } from './components/LobbyView';
import { PuzzleArena } from './components/PuzzleArena';
import { AdminDashboard } from './components/AdminDashboard';
import { EventModal } from './components/EventModal';
import { VictoryModal } from './components/VictoryModal';
import { DatabaseModal } from './components/DatabaseModal';
import { Participant, RoomState } from './types';
import { gameService } from './services/gameService';
import { soundService } from './services/audioService';

export function App() {
  const [participant, setParticipant] = useState<Participant | null>(() => {
    return gameService.getCurrentParticipant();
  });

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    return localStorage.getItem('mystery_active_room_id');
  });

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState<boolean>(false);

  // Subscribe to room updates in real-time
  useEffect(() => {
    if (!activeRoomId) {
      setRoomState(null);
      return;
    }

    const unsubscribe = gameService.subscribeToRoom(activeRoomId, (state) => {
      setRoomState(state);
      if (state.room.status === 'completed') {
        setShowVictoryModal(true);
      }
    });

    // Mark member as online
    if (participant) {
      gameService.updateMemberStatus(activeRoomId, participant.id, true);
    }

    const handleBeforeUnload = () => {
      if (participant && activeRoomId) {
        gameService.updateMemberStatus(activeRoomId, participant.id, false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeRoomId, participant]);

  // Handle room joined/created
  const handleRoomEntered = (roomId: string, currentParticipant: Participant) => {
    setParticipant(currentParticipant);
    setActiveRoomId(roomId);
    localStorage.setItem('mystery_active_room_id', roomId);
  };

  const handleLeaveRoom = () => {
    soundService.playClick();
    if (activeRoomId && participant) {
      gameService.updateMemberStatus(activeRoomId, participant.id, false);
    }
    setActiveRoomId(null);
    setRoomState(null);
    setParticipant(null);
    localStorage.removeItem('mystery_active_room_id');
    localStorage.removeItem('mystery_current_participant');
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col selection:bg-cyber-cyan/30 selection:text-white">
      {/* Global Navigation Header */}
      <Header
        participant={participant}
        room={roomState ? roomState.room : null}
        isAdminView={isAdminView}
        onToggleAdmin={() => {
          soundService.playClick();
          if (isAdminView) {
            sessionStorage.removeItem('mystery_admin_auth');
          }
          setIsAdminView(!isAdminView);
        }}
        onLeaveRoom={handleLeaveRoom}
        onShowCredits={() => {
          soundService.playClick();
          setShowEventModal(true);
        }}
        onOpenDatabaseModal={() => {
          soundService.playClick();
          setShowDatabaseModal(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {isAdminView ? (
          <AdminDashboard onExit={() => setIsAdminView(false)} />
        ) : !activeRoomId || !roomState ? (
          <EntryHub
            onRoomEntered={handleRoomEntered}
            onOpenEventModal={() => setShowEventModal(true)}
          />
        ) : roomState.room.status === 'lobby' ? (
          <LobbyView
            roomState={roomState}
            currentParticipant={participant!}
            onStartChallenge={() => {
              // Started by leader, room status will update to in_progress
            }}
            onOpenEventModal={() => setShowEventModal(true)}
          />
        ) : (
          <PuzzleArena
            roomState={roomState}
            currentParticipant={participant!}
            onAllCompleted={() => setShowVictoryModal(true)}
          />
        )}
      </main>

      {/* Footer Branding */}
      <footer className="border-t border-slate-900/80 bg-navy-950/90 py-4 px-4 text-center text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Ramco Institute of Technology • Department of Computer Science & Engineering
          </div>
          <div>
            In association with <span className="text-cyber-cyan">IE(I) Student Chapter</span> • Mini Escape Room Challenge
          </div>
        </div>
      </footer>

      {/* Database Setup & Cloud Credentials Modal */}
      <DatabaseModal
        isOpen={showDatabaseModal}
        onClose={() => setShowDatabaseModal(false)}
      />

      {/* Event Info & Coordinators Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
      />

      {/* Victory Celebration & Printable Certificate Modal */}
      {roomState && (
        <VictoryModal
          isOpen={showVictoryModal}
          onClose={() => setShowVictoryModal(false)}
          roomState={roomState}
        />
      )}
    </div>
  );
}

export default App;

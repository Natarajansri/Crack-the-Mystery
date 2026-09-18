import { 
  Participant, 
  Room, 
  RoomMember, 
  RoomState, 
  ClueProgress, 
  PuzzleProgress, 
  AnswerSubmission,
  AdminStats
} from '../types';
import { PUZZLES_DATA } from '../data/puzzlesData';
import { normalizeAnswer, generateRoomCode } from '../utils/answerUtils';
import { cloudSync } from './cloudSync';

const STORAGE_KEY_ROOMS = 'mystery_rooms_store';
const STORAGE_KEY_STATES = 'mystery_room_states_store';
const STORAGE_KEY_PARTICIPANTS = 'mystery_participants_store';

// Cross-tab broadcast channel for real-time multiplayer simulation
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('crack_the_mystery_realtime_sync')
  : null;

class GameService {
  private stateListeners: Map<string, Set<(state: RoomState) => void>> = new Map();
  private pollIntervals: Map<string, any> = new Map();
  private isSyncingMap: Map<string, boolean> = new Map();

  constructor() {
    if (syncChannel) {
      syncChannel.onmessage = (event) => {
        const { type, roomId, state } = event.data;
        if (type === 'ROOM_STATE_UPDATED' && roomId && state) {
          const states = this.loadRoomStates();
          states[roomId] = state;
          this.saveRoomStates(states);
          this.notifyListeners(roomId, state);
        } else if (type === 'ALL_DATA_CLEARED') {
          this.clearLocalDataOnly();
        }
      };
    }
  }

  // Helper to load all stored rooms
  public loadStoredRooms(): Record<string, Room> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ROOMS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  public saveStoredRooms(rooms: Record<string, Room>) {
    try {
      localStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(rooms));
    } catch (e) {
      console.error('Failed to save rooms', e);
    }
  }

  // Helper to load room state
  public loadRoomStates(): Record<string, RoomState> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_STATES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  public saveRoomStates(states: Record<string, RoomState>) {
    try {
      localStorage.setItem(STORAGE_KEY_STATES, JSON.stringify(states));
    } catch (e) {
      console.error('Failed to save room states', e);
    }
  }

  private notifyListeners(roomId: string, state: RoomState) {
    const listeners = this.stateListeners.get(roomId);
    if (listeners) {
      listeners.forEach((callback) => callback(state));
    }
  }

  private broadcastUpdate(roomId: string, state: RoomState) {
    this.notifyListeners(roomId, state);
    if (syncChannel) {
      syncChannel.postMessage({ type: 'ROOM_STATE_UPDATED', roomId, state });
    }
    // Asynchronously push update to Cloud Relay and Netlify Function
    cloudSync.saveRoomState(state).catch((e) => console.warn('Cloud sync push error:', e));
  }

  // Start polling cloud for a room's state (multiplayer sync across devices)
  private startCloudPolling(roomId: string) {
    if (this.pollIntervals.has(roomId)) return;

    const poll = async () => {
      if (this.isSyncingMap.get(roomId)) return;
      this.isSyncingMap.set(roomId, true);

      try {
        const localStates = this.loadRoomStates();
        const localState = localStates[roomId];
        const code = localState?.room?.code;

        const remoteState = await cloudSync.fetchRoomById(roomId, code);
        if (remoteState && remoteState.room) {
          const remoteTime = new Date(remoteState.room.updatedAt || remoteState.room.createdAt || 0).getTime();
          const localTime = localState ? new Date(localState.room.updatedAt || localState.room.createdAt || 0).getTime() : 0;

          // Check if remote state has new updates or if local state is missing
          const remoteMembersCount = remoteState.members?.length || 0;
          const localMembersCount = localState?.members?.length || 0;
          const remoteSubsCount = remoteState.submissions?.length || 0;
          const localSubsCount = localState?.submissions?.length || 0;

          const hasChanges = !localState ||
            remoteTime > localTime ||
            remoteMembersCount !== localMembersCount ||
            remoteSubsCount !== localSubsCount ||
            remoteState.room.status !== localState.room.status ||
            remoteState.room.currentPuzzleNumber !== localState.room.currentPuzzleNumber ||
            JSON.stringify(remoteState.clueProgress) !== JSON.stringify(localState.clueProgress);

          if (hasChanges) {
            // Update local store
            const rooms = this.loadStoredRooms();
            rooms[roomId] = remoteState.room;
            this.saveStoredRooms(rooms);

            localStates[roomId] = remoteState;
            this.saveRoomStates(localStates);

            this.notifyListeners(roomId, remoteState);
          }
        }
      } catch (err) {
        // quiet error to prevent console spamming
      } finally {
        this.isSyncingMap.set(roomId, false);
      }
    };

    // Initial fetch
    poll();

    // Poll every 2000ms with randomized jitter (1800ms - 2200ms) to avoid thundering herd across 60 participants
    const jitter = Math.floor(Math.random() * 400) - 200;
    const intervalTime = Math.max(1500, 2000 + jitter);
    const timerId = setInterval(poll, intervalTime);
    this.pollIntervals.set(roomId, timerId as any);
  }

  private stopCloudPolling(roomId: string) {
    const timerId = this.pollIntervals.get(roomId);
    if (timerId) {
      clearInterval(timerId as any);
      this.pollIntervals.delete(roomId);
    }
  }

  // Subscribe to real-time updates for a specific room
  public subscribeToRoom(roomId: string, callback: (state: RoomState) => void): () => void {
    if (!this.stateListeners.has(roomId)) {
      this.stateListeners.set(roomId, new Set());
    }
    this.stateListeners.get(roomId)!.add(callback);

    // Initial state trigger from local store
    const state = this.getRoomState(roomId);
    if (state) {
      callback(state);
    }

    // Start background cloud sync polling for this room
    this.startCloudPolling(roomId);

    // Return unsubscribe function
    return () => {
      const set = this.stateListeners.get(roomId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.stateListeners.delete(roomId);
          this.stopCloudPolling(roomId);
        }
      }
    };
  }

  // ==========================================
  // PARTICIPANT & PROFILE MANAGEMENT
  // ==========================================
  public getCurrentParticipant(): Participant | null {
    try {
      const data = localStorage.getItem('mystery_current_participant');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public saveCurrentParticipant(participant: Participant) {
    localStorage.setItem('mystery_current_participant', JSON.stringify(participant));
    try {
      const parts = this.loadStoredParticipants();
      parts[participant.id] = participant;
      localStorage.setItem(STORAGE_KEY_PARTICIPANTS, JSON.stringify(parts));
    } catch (e) {
      console.error(e);
    }
  }

  private loadStoredParticipants(): Record<string, Participant> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PARTICIPANTS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  // ==========================================
  // ROOM CREATION & JOINING (CLOUD + LOCAL)
  // ==========================================
  public async createRoom(
    teamName: string, 
    leader: Participant, 
    maxCapacity: number = 3
  ): Promise<{ room: Room; state: RoomState }> {
    const code = generateRoomCode();
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const room: Room = {
      id: roomId,
      code,
      teamName: teamName.trim(),
      leaderId: leader.id,
      maxCapacity: Math.min(Math.max(maxCapacity, 1), 3),
      status: 'lobby',
      currentPuzzleNumber: 1,
      createdAt: now,
      updatedAt: now,
    };

    const leaderMember: RoomMember = {
      id: `member-${Date.now()}`,
      roomId,
      participantId: leader.id,
      participant: leader,
      joinedAt: now,
      isOnline: true,
      isReady: true,
    };

    const state: RoomState = {
      room,
      members: [leaderMember],
      clueProgress: {},
      puzzleProgress: {},
      submissions: [],
    };

    // Save locally
    const rooms = this.loadStoredRooms();
    rooms[roomId] = room;
    this.saveStoredRooms(rooms);

    const states = this.loadRoomStates();
    states[roomId] = state;
    this.saveRoomStates(states);

    // Broadcast & Push to Cloud
    this.broadcastUpdate(roomId, state);
    this.startCloudPolling(roomId);

    return { room, state };
  }

  public async joinRoom(
    roomCode: string, 
    participant: Participant
  ): Promise<{ success: boolean; room?: Room; state?: RoomState; error?: string }> {
    const cleanCode = roomCode.trim().toUpperCase();
    const rooms = this.loadStoredRooms();
    const states = this.loadRoomStates();

    // 1. First check local store
    let foundRoom = Object.values(rooms).find((r) => r.code === cleanCode);
    let state = foundRoom ? states[foundRoom.id] : null;

    // 2. If not found locally, fetch from Cloud (crucial for cross-device support for 60 participants)
    if (!foundRoom || !state) {
      try {
        const cloudState = await cloudSync.fetchRoomByCode(cleanCode);
        if (cloudState && cloudState.room) {
          foundRoom = cloudState.room;
          state = cloudState;

          // Cache locally
          rooms[foundRoom.id] = foundRoom;
          this.saveStoredRooms(rooms);

          states[foundRoom.id] = state;
          this.saveRoomStates(states);
        }
      } catch (err) {
        console.warn('Error fetching room from cloud:', err);
      }
    }

    if (!foundRoom || !state) {
      return { success: false, error: 'Room code not found. Please check and try again.' };
    }

    if (foundRoom.status === 'locked') {
      return { success: false, error: 'This room is currently locked by the administrator.' };
    }

    // Check if participant is already a member (rejoining)
    const existingIndex = state.members.findIndex((m) => m.participantId === participant.id);
    if (existingIndex >= 0) {
      state.members[existingIndex].isOnline = true;
      state.room.updatedAt = new Date().toISOString();
      states[foundRoom.id] = state;
      this.saveRoomStates(states);
      this.broadcastUpdate(foundRoom.id, state);
      this.startCloudPolling(foundRoom.id);
      return { success: true, room: foundRoom, state };
    }

    // Check capacity (capped at max 3 members)
    if (state.members.length >= foundRoom.maxCapacity) {
      return { 
        success: false, 
        error: `Room is full. Maximum capacity is ${foundRoom.maxCapacity} members.` 
      };
    }

    // Add new member
    const newMember: RoomMember = {
      id: `member-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId: foundRoom.id,
      participantId: participant.id,
      participant,
      joinedAt: new Date().toISOString(),
      isOnline: true,
      isReady: false,
    };

    state.members.push(newMember);
    state.room.updatedAt = new Date().toISOString();
    foundRoom.updatedAt = state.room.updatedAt;

    rooms[foundRoom.id] = foundRoom;
    this.saveStoredRooms(rooms);

    states[foundRoom.id] = state;
    this.saveRoomStates(states);

    // Broadcast and push to Cloud
    this.broadcastUpdate(foundRoom.id, state);
    this.startCloudPolling(foundRoom.id);

    return { success: true, room: foundRoom, state };
  }

  public getRoomState(roomId: string): RoomState | null {
    const states = this.loadRoomStates();
    return states[roomId] || null;
  }

  public updateMemberStatus(roomId: string, participantId: string, isOnline: boolean, isReady?: boolean) {
    const states = this.loadRoomStates();
    const state = states[roomId];
    if (!state) return;

    const member = state.members.find((m) => m.participantId === participantId);
    if (member) {
      member.isOnline = isOnline;
      if (typeof isReady === 'boolean') {
        member.isReady = isReady;
      }
      state.room.updatedAt = new Date().toISOString();
      states[roomId] = state;
      this.saveRoomStates(states);
      this.broadcastUpdate(roomId, state);
    }
  }

  public startRoomChallenge(roomId: string, requesterParticipantId: string): { success: boolean; error?: string } {
    const states = this.loadRoomStates();
    const rooms = this.loadStoredRooms();
    const state = states[roomId];
    const room = rooms[roomId];

    if (!state || !room) {
      return { success: false, error: 'Room not found.' };
    }

    if (room.leaderId !== requesterParticipantId) {
      return { success: false, error: 'Only the team leader can start the challenge.' };
    }

    room.status = 'in_progress';
    room.updatedAt = new Date().toISOString();
    state.room = room;

    rooms[roomId] = room;
    states[roomId] = state;
    this.saveStoredRooms(rooms);
    this.saveRoomStates(states);

    this.broadcastUpdate(roomId, state);
    return { success: true };
  }

  // ==========================================
  // CLUE ANSWER SUBMISSION & FRAGMENT LOGIC
  // ==========================================
  public async submitClueAnswer(
    roomId: string,
    puzzleId: string,
    clueId: string,
    participant: Participant,
    rawAnswer: string
  ): Promise<{ 
    success: boolean; 
    message: string; 
    earnedFragment?: string; 
    isDuplicate?: boolean;
    nextClueUnlocked?: boolean;
  }> {
    const states = this.loadRoomStates();
    const state = states[roomId];

    if (!state) {
      return { success: false, message: 'Room not found.' };
    }

    if (state.room.status === 'locked') {
      return { success: false, message: 'This room is currently locked by the administrator.' };
    }

    // Locate puzzle and clue
    const puzzle = PUZZLES_DATA.find((p) => p.id === puzzleId);
    if (!puzzle) {
      return { success: false, message: 'Puzzle not found.' };
    }

    const clue = puzzle.clues.find((c) => c.id === clueId);
    if (!clue) {
      return { success: false, message: 'Clue not found.' };
    }

    // Key for clue progress
    const clueKey = `${puzzleId}_${clueId}`;
    const existingProgress = state.clueProgress[clueKey];

    if (existingProgress && existingProgress.isSolved) {
      return { 
        success: true, 
        message: 'This clue has already been solved by your team!', 
        earnedFragment: existingProgress.earnedFragment,
        isDuplicate: true 
      };
    }

    // Sequential verification: ensure previous clues in this puzzle are solved
    if (clue.clueNumber > 1) {
      const prevClue = puzzle.clues.find((c) => c.clueNumber === clue.clueNumber - 1);
      if (prevClue) {
        const prevKey = `${puzzleId}_${prevClue.id}`;
        if (!state.clueProgress[prevKey]?.isSolved) {
          return { 
            success: false, 
            message: `Sequential Lock: You must solve Clue ${prevClue.clueNumber} first!` 
          };
        }
      }
    }

    // Normalize and check answer
    const normalizedInput = normalizeAnswer(rawAnswer);
    const isCorrect = clue.acceptedAnswers.some((ans) => normalizeAnswer(ans) === normalizedInput);

    // Record submission audit
    const submission: AnswerSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId,
      puzzleId,
      clueId,
      clueNumber: clue.clueNumber,
      submittedByParticipantId: participant.id,
      submittedByParticipantName: participant.name,
      submissionType: 'clue',
      answerText: rawAnswer.trim(),
      isCorrect,
      timestamp: new Date().toISOString(),
    };
    state.submissions.push(submission);
    state.room.updatedAt = new Date().toISOString();

    if (!isCorrect) {
      states[roomId] = state;
      this.saveRoomStates(states);
      this.broadcastUpdate(roomId, state);
      return { 
        success: false, 
        message: 'Incorrect answer. Read the prompt carefully and recheck your deduction!' 
      };
    }

    // Correct answer: record progress
    const progress: ClueProgress = {
      id: `prog-${Date.now()}`,
      roomId,
      puzzleId,
      clueId,
      clueNumber: clue.clueNumber,
      isSolved: true,
      solvedByParticipantId: participant.id,
      solvedByParticipantName: participant.name,
      earnedFragment: clue.expectedFragment,
      solvedAt: new Date().toISOString(),
    };

    state.clueProgress[clueKey] = progress;
    states[roomId] = state;
    this.saveRoomStates(states);

    this.broadcastUpdate(roomId, state);
    return {
      success: true,
      message: `Clue ${clue.clueNumber} solved! Fragment acquired: "${clue.expectedFragment}"`,
      earnedFragment: clue.expectedFragment,
      nextClueUnlocked: clue.clueNumber < 5,
    };
  }

  // ==========================================
  // FINAL ANSWER UNLOCK FOR MAIN PUZZLE
  // ==========================================
  public async submitFinalAnswer(
    roomId: string,
    puzzleId: string,
    participant: Participant,
    rawAnswer: string
  ): Promise<{ 
    success: boolean; 
    message: string; 
    puzzleCompleted?: boolean;
    allPuzzlesCompleted?: boolean;
  }> {
    const states = this.loadRoomStates();
    const rooms = this.loadStoredRooms();
    const state = states[roomId];
    const room = rooms[roomId];

    if (!state || !room) {
      return { success: false, message: 'Room not found.' };
    }

    if (room.status === 'locked') {
      return { success: false, message: 'This room is locked by the administrator.' };
    }

    const puzzle = PUZZLES_DATA.find((p) => p.id === puzzleId);
    if (!puzzle) {
      return { success: false, message: 'Puzzle not found.' };
    }

    if (state.puzzleProgress[puzzleId]?.isCompleted) {
      return { 
        success: true, 
        message: 'This puzzle has already been completed by your team!', 
        puzzleCompleted: true 
      };
    }

    // Verify all 4 preceding clues are solved
    const missingClue = puzzle.clues
      .filter((c) => c.clueNumber < 5)
      .find((c) => !state.clueProgress[`${puzzleId}_${c.id}`]?.isSolved);

    if (missingClue) {
      return {
        success: false,
        message: `Vault Locked: You must collect all 4 fragments first! Clue ${missingClue.clueNumber} is still unresolved.`,
      };
    }

    // Check final answer
    const normalizedInput = normalizeAnswer(rawAnswer);
    const isCorrect = puzzle.acceptedFinalAnswers.some((ans) => normalizeAnswer(ans) === normalizedInput);

    // Record submission
    const submission: AnswerSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId,
      puzzleId,
      clueNumber: 5,
      submittedByParticipantId: participant.id,
      submittedByParticipantName: participant.name,
      submissionType: 'final',
      answerText: rawAnswer.trim(),
      isCorrect,
      timestamp: new Date().toISOString(),
    };
    state.submissions.push(submission);
    room.updatedAt = new Date().toISOString();
    state.room.updatedAt = room.updatedAt;

    if (!isCorrect) {
      states[roomId] = state;
      this.saveRoomStates(states);
      this.broadcastUpdate(roomId, state);
      return {
        success: false,
        message: 'Incorrect final combination. Review the fragment sequence in your vault!',
      };
    }

    // Mark puzzle completed
    const puzzleProg: PuzzleProgress = {
      id: `puzprog-${Date.now()}`,
      roomId,
      puzzleId,
      puzzleNumber: puzzle.puzzleNumber,
      isCompleted: true,
      completedByParticipantId: participant.id,
      completedByParticipantName: participant.name,
      completedAt: new Date().toISOString(),
    };
    state.puzzleProgress[puzzleId] = puzzleProg;

    // Check if clue 5 is also marked
    const clue5 = puzzle.clues.find((c) => c.clueNumber === 5);
    if (clue5) {
      state.clueProgress[`${puzzleId}_${clue5.id}`] = {
        id: `prog-${Date.now()}`,
        roomId,
        puzzleId,
        clueId: clue5.id,
        clueNumber: 5,
        isSolved: true,
        solvedByParticipantId: participant.id,
        solvedByParticipantName: participant.name,
        earnedFragment: puzzle.finalAnswer,
        solvedAt: new Date().toISOString(),
      };
    }

    // Check if ALL 15 puzzles are completed
    const completedCount = Object.values(state.puzzleProgress).filter((p) => p.isCompleted).length;
    const allCompleted = completedCount >= PUZZLES_DATA.length;

    if (allCompleted) {
      room.status = 'completed';
      state.room.status = 'completed';
    }

    // Advance room's active puzzle pointer if this was current
    if (room.currentPuzzleNumber === puzzle.puzzleNumber && puzzle.puzzleNumber < 15) {
      room.currentPuzzleNumber = puzzle.puzzleNumber + 1;
      state.room.currentPuzzleNumber = room.currentPuzzleNumber;
    }

    rooms[roomId] = room;
    states[roomId] = state;
    this.saveStoredRooms(rooms);
    this.saveRoomStates(states);

    this.broadcastUpdate(roomId, state);
    return {
      success: true,
      message: `PUZZLE ${puzzle.puzzleNumber} SOLVED! Master Keyword: ${puzzle.finalAnswer}`,
      puzzleCompleted: true,
      allPuzzlesCompleted: allCompleted,
    };
  }

  // ==========================================
  // ADMIN MONITORING & MANAGEMENT
  // ==========================================
  public async syncAllRoomsFromCloud(): Promise<void> {
    try {
      const cloudRoomsMap = await cloudSync.fetchAllRooms();
      const localRooms = this.loadStoredRooms();
      const localStates = this.loadRoomStates();
      let hasNew = false;

      for (const [code, meta] of Object.entries(cloudRoomsMap)) {
        const roomId = meta.roomId;
        if (!roomId) continue;

        // If not in local rooms or updated remotely, sync state
        if (!localRooms[roomId] || (meta.updatedAt && (!localRooms[roomId].updatedAt || meta.updatedAt > localRooms[roomId].updatedAt))) {
          const remoteState = await cloudSync.fetchRoomByCode(code);
          if (remoteState && remoteState.room) {
            localRooms[roomId] = remoteState.room;
            localStates[roomId] = remoteState;
            hasNew = true;
          }
        }
      }

      if (hasNew) {
        this.saveStoredRooms(localRooms);
        this.saveRoomStates(localStates);
      }
    } catch (e) {
      console.warn('Failed to sync all rooms from cloud:', e);
    }
  }

  public getAdminStats(): AdminStats {
    const rooms = Object.values(this.loadStoredRooms());
    const states = this.loadRoomStates();

    let totalParticipants = 0;
    let totalCluesSolved = 0;
    let totalPuzzlesSolved = 0;
    let activeRooms = 0;
    let completedRooms = 0;

    rooms.forEach((r) => {
      const state = states[r.id];
      if (state) {
        totalParticipants += state.members.length;
        totalCluesSolved += Object.values(state.clueProgress).filter((c) => c.isSolved).length;
        totalPuzzlesSolved += Object.values(state.puzzleProgress).filter((p) => p.isCompleted).length;
      }
      if (r.status === 'in_progress') activeRooms++;
      if (r.status === 'completed') completedRooms++;
    });

    return {
      totalRooms: rooms.length,
      totalParticipants,
      activeRooms,
      completedRooms,
      totalCluesSolved,
      totalPuzzlesSolved,
    };
  }

  public getAllRoomsData(): Array<{
    room: Room;
    members: RoomMember[];
    puzzlesSolvedCount: number;
    cluesSolvedCount: number;
    lastActive: string;
  }> {
    const rooms = Object.values(this.loadStoredRooms());
    const states = this.loadRoomStates();

    return rooms.map((room) => {
      const state = states[room.id];
      const puzzlesSolvedCount = state 
        ? Object.values(state.puzzleProgress).filter((p) => p.isCompleted).length 
        : 0;
      const cluesSolvedCount = state 
        ? Object.values(state.clueProgress).filter((c) => c.isSolved).length 
        : 0;

      const lastSub = state?.submissions[state.submissions.length - 1];
      const lastActive = lastSub ? lastSub.timestamp : room.updatedAt || room.createdAt;

      return {
        room,
        members: state ? state.members : [],
        puzzlesSolvedCount,
        cluesSolvedCount,
        lastActive,
      };
    });
  }

  public adminToggleLockRoom(roomId: string, lock: boolean): boolean {
    const rooms = this.loadStoredRooms();
    const states = this.loadRoomStates();
    const room = rooms[roomId];
    const state = states[roomId];

    if (!room || !state) return false;

    room.status = lock ? 'locked' : (state.members.length > 0 ? 'in_progress' : 'lobby');
    room.updatedAt = new Date().toISOString();
    state.room.status = room.status;
    state.room.updatedAt = room.updatedAt;

    rooms[roomId] = room;
    states[roomId] = state;
    this.saveStoredRooms(rooms);
    this.saveRoomStates(states);

    this.broadcastUpdate(roomId, state);
    return true;
  }

  public adminResetRoom(roomId: string): boolean {
    const rooms = this.loadStoredRooms();
    const states = this.loadRoomStates();
    const room = rooms[roomId];
    const state = states[roomId];

    if (!room || !state) return false;

    room.status = 'in_progress';
    room.currentPuzzleNumber = 1;
    room.updatedAt = new Date().toISOString();
    state.room = room;
    state.clueProgress = {};
    state.puzzleProgress = {};
    state.submissions = [];

    rooms[roomId] = room;
    states[roomId] = state;
    this.saveStoredRooms(rooms);
    this.saveRoomStates(states);

    this.broadcastUpdate(roomId, state);
    return true;
  }

  public generateLeaderboardCSV(): string {
    const roomsData = this.getAllRoomsData();
    const headers = [
      'Room Code',
      'Team Name',
      'Status',
      'Members Count',
      'Member Names',
      'Puzzles Solved (out of 15)',
      'Clues Solved (out of 75)',
      'Created At',
      'Last Active'
    ];

    const rows = roomsData.map((d) => [
      `"${d.room.code}"`,
      `"${d.room.teamName.replace(/"/g, '""')}"`,
      `"${d.room.status}"`,
      d.members.length,
      `"${d.members.map((m) => m.participant.name).join(', ').replace(/"/g, '""')}"`,
      d.puzzlesSolvedCount,
      d.cluesSolvedCount,
      `"${d.room.createdAt}"`,
      `"${d.lastActive}"`
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  private clearLocalDataOnly() {
    localStorage.removeItem(STORAGE_KEY_ROOMS);
    localStorage.removeItem(STORAGE_KEY_STATES);
    localStorage.removeItem(STORAGE_KEY_PARTICIPANTS);
    localStorage.removeItem('mystery_active_room_id');
    localStorage.removeItem('mystery_current_participant');
    this.stateListeners.clear();
    this.pollIntervals.forEach((timer) => clearInterval(timer));
    this.pollIntervals.clear();
  }

  public adminClearAllData(): boolean {
    try {
      this.clearLocalDataOnly();
      cloudSync.clearAllCloudData().catch((e) => console.warn('Cloud clear warning:', e));

      if (syncChannel) {
        syncChannel.postMessage({ type: 'ALL_DATA_CLEARED' });
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}

export const gameService = new GameService();

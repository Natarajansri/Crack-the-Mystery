export type Role = 'leader' | 'member';

export interface Participant {
  id: string;
  name: string;
  email: string;
  registerNumber: string;
  department: string;
  college: string;
  avatarSeed: string;
  role: Role;
  createdAt: string;
}

export type RoomStatus = 'lobby' | 'in_progress' | 'completed' | 'locked';

export interface Room {
  id: string;
  code: string;
  teamName: string;
  leaderId: string;
  maxCapacity: number;
  status: RoomStatus;
  currentPuzzleNumber: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  participantId: string;
  participant: Participant;
  joinedAt: string;
  isOnline: boolean;
  isReady: boolean;
}

export type ClueType = 
  | 'odd_word' 
  | 'riddle' 
  | 'rearrange' 
  | 'hidden_number' 
  | 'final_unlock'
  | 'logic_cipher';

export interface Clue {
  id: string;
  puzzleId: string;
  clueNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  type: ClueType;
  prompt: string;
  subPrompt?: string;
  hint?: string;
  fragmentLabel: string;
  fragmentDescription: string;
  expectedFragment: string;
  // normalized accepted answers (uppercased/trimmed)
  acceptedAnswers: string[];
}

export type PuzzleDifficulty = 'simple' | 'moderate' | 'hard';

export interface Puzzle {
  id: string;
  puzzleNumber: number;
  title: string;
  theme: string;
  difficulty: PuzzleDifficulty;
  story: string;
  clues: Clue[];
  finalAnswer: string;
  finalAnswerHint: string;
  fragmentFormula: string;
  acceptedFinalAnswers: string[];
}

export interface ClueProgress {
  id: string;
  roomId: string;
  puzzleId: string;
  clueId: string;
  clueNumber: number;
  isSolved: boolean;
  solvedByParticipantId?: string;
  solvedByParticipantName?: string;
  earnedFragment?: string;
  solvedAt?: string;
}

export interface PuzzleProgress {
  id: string;
  roomId: string;
  puzzleId: string;
  puzzleNumber: number;
  isCompleted: boolean;
  completedByParticipantId?: string;
  completedByParticipantName?: string;
  completedAt?: string;
}

export interface AnswerSubmission {
  id: string;
  roomId: string;
  puzzleId: string;
  clueId?: string;
  clueNumber?: number;
  submittedByParticipantId: string;
  submittedByParticipantName: string;
  submissionType: 'clue' | 'final';
  answerText: string;
  isCorrect: boolean;
  timestamp: string;
}

export interface RoomState {
  room: Room;
  members: RoomMember[];
  clueProgress: Record<string, ClueProgress>; // key: `${puzzleId}_${clueId}`
  puzzleProgress: Record<string, PuzzleProgress>; // key: puzzleId
  submissions: AnswerSubmission[];
}

export interface AdminStats {
  totalRooms: number;
  totalParticipants: number;
  activeRooms: number;
  completedRooms: number;
  totalCluesSolved: number;
  totalPuzzlesSolved: number;
}

export interface RoomSummaryData {
  room: Room;
  members: RoomMember[];
  puzzlesSolvedCount: number;
  cluesSolvedCount: number;
  lastActive: string;
  finishedAt?: string;
  durationMs?: number;
  formattedDuration?: string;
  rank?: number;
  isFinished?: boolean;
}

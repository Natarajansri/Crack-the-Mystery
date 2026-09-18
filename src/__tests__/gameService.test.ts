import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeAnswer, generateRoomCode } from '../utils/answerUtils';
import { gameService } from '../services/gameService';
import { PUZZLES_DATA } from '../data/puzzlesData';
import { Participant } from '../types';

// In-memory mock for localStorage in test environment
let mockStore: Record<string, string> = {};
const storageMock = {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => { mockStore[key] = value.toString(); },
  clear: () => { mockStore = {}; },
  removeItem: (key: string) => { delete mockStore[key]; },
  get length() { return Object.keys(mockStore).length; },
  key: (i: number) => Object.keys(mockStore)[i] || null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
  configurable: true
});

describe('Crack The Mystery - Core Logic Tests', () => {
  const dummyLeader: Participant = {
    id: 'leader-1',
    name: 'Karthik Leader',
    email: 'karthik@ritrjpm.ac.in',
    registerNumber: '953621104001',
    department: 'CSE',
    college: 'Ramco Institute of Technology',
    avatarSeed: 'karthik',
    role: 'leader',
    createdAt: new Date().toISOString(),
  };

  const dummyMember: Participant = {
    id: 'member-2',
    name: 'Subiksha Member',
    email: 'subiksha@ritrjpm.ac.in',
    registerNumber: '953621104002',
    department: 'CSE',
    college: 'Ramco Institute of Technology',
    avatarSeed: 'subiksha',
    role: 'member',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('Answer Normalizer & Room Code', () => {
    it('normalizes answers correctly across cases, spaces, and punctuation', () => {
      expect(normalizeAnswer('  Technology ')).toBe('TECHNOLOGY');
      expect(normalizeAnswer('tech-no-log-y!')).toBe('TECHNOLOGY');
      expect(normalizeAnswer('Twenty Five')).toBe('TWENTYFIVE');
      expect(normalizeAnswer('GLORY.')).toBe('GLORY');
      expect(normalizeAnswer('25')).toBe('25');
    });

    it('generates a valid 6-character alphanumeric room code', () => {
      const code1 = generateRoomCode();
      const code2 = generateRoomCode();
      expect(code1).toHaveLength(6);
      expect(code2).toHaveLength(6);
      expect(code1).toMatch(/^[A-Z2-9]{6}$/);
    });
  });

  describe('Puzzles Structure Validation', () => {
    it('contains exactly 15 main puzzles', () => {
      expect(PUZZLES_DATA).toHaveLength(15);
    });

    it('contains exactly 5 Simple, 5 Moderate, and 5 Hard puzzles', () => {
      const simple = PUZZLES_DATA.filter((p) => p.difficulty === 'simple');
      const moderate = PUZZLES_DATA.filter((p) => p.difficulty === 'moderate');
      const hard = PUZZLES_DATA.filter((p) => p.difficulty === 'hard');

      expect(simple).toHaveLength(5);
      expect(moderate).toHaveLength(5);
      expect(hard).toHaveLength(5);
    });

    it('every puzzle has exactly 5 connected clues (total 75 clues)', () => {
      let totalClues = 0;
      PUZZLES_DATA.forEach((p, idx) => {
        expect(p.puzzleNumber).toBe(idx + 1);
        expect(p.clues).toHaveLength(5);
        expect(p.clues.map((c) => c.clueNumber)).toEqual([1, 2, 3, 4, 5]);
        expect(p.clues[4].type).toBe('final_unlock');
        totalClues += p.clues.length;
      });
      expect(totalClues).toBe(75);
    });

    it('starter puzzle (Level 1) precisely mirrors the uploaded event document clues', () => {
      const p1 = PUZZLES_DATA[0];
      expect(p1.puzzleNumber).toBe(1);
      expect(p1.finalAnswer).toBe('TECHNOLOGY');

      // Clue 1: Odd word (Tech, Net, Wire, Wifi)
      expect(p1.clues[0].prompt).toContain('Tech | Net | Wire | Wifi');
      expect(p1.clues[0].acceptedAnswers).toContain('TECH');
      expect(p1.clues[0].expectedFragment).toBe('Tech');

      // Clue 2: Riddle (snow -> middle letters -> no)
      expect(p1.clues[1].prompt).toContain('I am white and cold');
      expect(p1.clues[1].acceptedAnswers).toContain('SNOW');
      expect(p1.clues[1].expectedFragment).toBe('no');

      // Clue 3: Rearrange letters (YOLRG -> GLORY -> log)
      expect(p1.clues[2].prompt).toContain('Y O L R G');
      expect(p1.clues[2].acceptedAnswers).toContain('GLORY');
      expect(p1.clues[2].expectedFragment).toBe('log');

      // Clue 4: Hidden number (50 - 25 + 10 - 10 = 25 -> y)
      expect(p1.clues[3].prompt).toContain('50 - 25 + 10 - 10');
      expect(p1.clues[3].acceptedAnswers).toContain('25');
      expect(p1.clues[3].expectedFragment).toBe('y');

      // Clue 5: Final Unlock (TECHNOLOGY)
      expect(p1.clues[4].acceptedAnswers).toContain('TECHNOLOGY');
    });
  });

  describe('Room Lifecycle & Collaboration', () => {
    it('creates a room with leader, sets lobby status and assigns code', async () => {
      const { room, state } = await gameService.createRoom('RIT Hackers', dummyLeader, 3);

      expect(room.code).toHaveLength(6);
      expect(room.teamName).toBe('RIT Hackers');
      expect(room.leaderId).toBe(dummyLeader.id);
      expect(room.status).toBe('lobby');
      expect(state.members).toHaveLength(1);
      expect(state.members[0].participantId).toBe(dummyLeader.id);
    });

    it('allows members to join room with valid room code up to capacity', async () => {
      const { room } = await gameService.createRoom('RIT Hackers', dummyLeader, 2);

      const joinRes = await gameService.joinRoom(room.code, dummyMember);
      expect(joinRes.success).toBe(true);
      expect(joinRes.state?.members).toHaveLength(2);

      // Attempting to add a 3rd member beyond max capacity of 2 should fail
      const thirdMember: Participant = {
        ...dummyMember,
        id: 'member-3',
        name: 'Third Member',
      };
      const overCapacityRes = await gameService.joinRoom(room.code, thirdMember);
      expect(overCapacityRes.success).toBe(false);
      expect(overCapacityRes.error).toContain('Room is full');
    });

    it('rejects joining when an invalid room code is provided', async () => {
      const joinRes = await gameService.joinRoom('ZZZZ99', dummyMember);
      expect(joinRes.success).toBe(false);
      expect(joinRes.error).toContain('Room code not found');
    });

    it('enforces sequential clue unlocking (Clue 2 cannot be solved before Clue 1)', async () => {
      const { room } = await gameService.createRoom('RIT Hackers', dummyLeader, 3);
      gameService.startRoomChallenge(room.id, dummyLeader.id);

      const p1 = PUZZLES_DATA[0];

      // Try submitting Clue 2 directly without solving Clue 1
      const clue2 = p1.clues[1];
      const directClue2Attempt = await gameService.submitClueAnswer(
        room.id,
        p1.id,
        clue2.id,
        dummyLeader,
        'snow'
      );

      expect(directClue2Attempt.success).toBe(false);
      expect(directClue2Attempt.message).toContain('Sequential Lock');
    });

    it('allows sequential clue solving and accumulates fragments in vault', async () => {
      const { room } = await gameService.createRoom('RIT Hackers', dummyLeader, 3);
      gameService.startRoomChallenge(room.id, dummyLeader.id);

      const p1 = PUZZLES_DATA[0];

      // Solve Clue 1: Tech
      const r1 = await gameService.submitClueAnswer(room.id, p1.id, p1.clues[0].id, dummyLeader, 'Tech');
      expect(r1.success).toBe(true);
      expect(r1.earnedFragment).toBe('Tech');

      // Solve Clue 2: snow
      const r2 = await gameService.submitClueAnswer(room.id, p1.id, p1.clues[1].id, dummyMember, 'snow');
      expect(r2.success).toBe(true);
      expect(r2.earnedFragment).toBe('no');

      // Solve Clue 3: GLORY
      const r3 = await gameService.submitClueAnswer(room.id, p1.id, p1.clues[2].id, dummyLeader, 'GLORY');
      expect(r3.success).toBe(true);
      expect(r3.earnedFragment).toBe('log');

      // Solve Clue 4: 25
      const r4 = await gameService.submitClueAnswer(room.id, p1.id, p1.clues[3].id, dummyMember, '25');
      expect(r4.success).toBe(true);
      expect(r4.earnedFragment).toBe('y');

      // Solve Final Step 5: TECHNOLOGY
      const r5 = await gameService.submitFinalAnswer(room.id, p1.id, dummyLeader, 'TECHNOLOGY');
      expect(r5.success).toBe(true);
      expect(r5.puzzleCompleted).toBe(true);

      // Verify updated room state
      const updatedState = gameService.getRoomState(room.id);
      expect(updatedState?.puzzleProgress[p1.id]?.isCompleted).toBe(true);
      expect(updatedState?.clueProgress[`${p1.id}_${p1.clues[0].id}`]?.isSolved).toBe(true);
    });

    it('prevents final answer unlock until all 4 prior fragments are solved', async () => {
      const { room } = await gameService.createRoom('RIT Hackers', dummyLeader, 3);
      gameService.startRoomChallenge(room.id, dummyLeader.id);

      const p1 = PUZZLES_DATA[0];
      // Only solve clue 1
      await gameService.submitClueAnswer(room.id, p1.id, p1.clues[0].id, dummyLeader, 'Tech');

      // Attempt to submit final answer
      const prematureFinal = await gameService.submitFinalAnswer(room.id, p1.id, dummyLeader, 'TECHNOLOGY');
      expect(prematureFinal.success).toBe(false);
      expect(prematureFinal.message).toContain('Vault Locked');
    });

    it('safely handles duplicate correct submissions without corrupting state', async () => {
      const { room } = await gameService.createRoom('RIT Hackers', dummyLeader, 3);
      gameService.startRoomChallenge(room.id, dummyLeader.id);
      const p1 = PUZZLES_DATA[0];

      // First solver
      const firstSolve = await gameService.submitClueAnswer(room.id, p1.id, p1.clues[0].id, dummyLeader, 'Tech');
      expect(firstSolve.success).toBe(true);
      expect(firstSolve.isDuplicate).toBeFalsy();

      // Second solver submits same clue after it was already solved
      const duplicateSolve = await gameService.submitClueAnswer(room.id, p1.id, p1.clues[0].id, dummyMember, 'Tech');
      expect(duplicateSolve.success).toBe(true);
      expect(duplicateSolve.isDuplicate).toBe(true);
    });
  });

  describe('Admin Operations', () => {
    it('computes accurate admin statistics and room lists', async () => {
      const { room } = await gameService.createRoom('RIT Hackers', dummyLeader, 3);
      await gameService.joinRoom(room.code, dummyMember);
      gameService.startRoomChallenge(room.id, dummyLeader.id);

      const stats = gameService.getAdminStats();
      expect(stats.totalRooms).toBe(1);
      expect(stats.totalParticipants).toBe(2);
      expect(stats.activeRooms).toBe(1);
    });

    it('allows admin to toggle lock on a room', async () => {
      const { room } = await gameService.createRoom('RIT Hackers', dummyLeader, 3);
      expect(gameService.adminToggleLockRoom(room.id, true)).toBe(true);

      const lockedState = gameService.getRoomState(room.id);
      expect(lockedState?.room.status).toBe('locked');

      // Solving in locked room should be rejected
      const p1 = PUZZLES_DATA[0];
      const lockedSubmit = await gameService.submitClueAnswer(room.id, p1.id, p1.clues[0].id, dummyLeader, 'Tech');
      expect(lockedSubmit.success).toBe(false);
      expect(lockedSubmit.message).toContain('locked by the administrator');
    });

    it('exports clean leaderboard CSV string', async () => {
      await gameService.createRoom('RIT Decoders', dummyLeader, 3);
      const csv = gameService.generateLeaderboardCSV();

      expect(csv).toContain('Room Code,Team Name,Status');
      expect(csv).toContain('"RIT Decoders"');
    });

    it('allows admin to clear all participants and room data', async () => {
      await gameService.createRoom('RIT Purge', dummyLeader, 3);
      expect(gameService.getAllRoomsData().length).toBeGreaterThan(0);

      const cleared = gameService.adminClearAllData();
      expect(cleared).toBe(true);
      expect(gameService.getAllRoomsData()).toHaveLength(0);
      expect(gameService.getAdminStats().totalRooms).toBe(0);
      expect(gameService.getAdminStats().totalParticipants).toBe(0);
    });

    it('enforces maximum 3 members per room for 60 participant capacity', async () => {
      const { room } = await gameService.createRoom('Team Trident', dummyLeader, 3);
      expect(room.maxCapacity).toBe(3);

      const m2: Participant = { ...dummyMember, id: 'm2', name: 'Member 2' };
      const m3: Participant = { ...dummyMember, id: 'm3', name: 'Member 3' };
      const m4: Participant = { ...dummyMember, id: 'm4', name: 'Member 4' };

      const j2 = await gameService.joinRoom(room.code, m2);
      expect(j2.success).toBe(true);

      const j3 = await gameService.joinRoom(room.code, m3);
      expect(j3.success).toBe(true);

      // 4th member must be rejected
      const j4 = await gameService.joinRoom(room.code, m4);
      expect(j4.success).toBe(false);
      expect(j4.error).toContain('Room is full');
    });
  });
});

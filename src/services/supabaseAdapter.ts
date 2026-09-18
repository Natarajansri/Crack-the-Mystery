import { supabase, isSupabaseConfigured } from './supabase';
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

export class SupabaseAdapter {
  public isAvailable(): boolean {
    return isSupabaseConfigured && supabase !== null;
  }

  /**
   * Save or upsert participant profile
   */
  public async upsertParticipant(participant: Participant): Promise<void> {
    if (!this.isAvailable() || !supabase) return;
    try {
      await supabase.from('participants').upsert({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        register_number: participant.registerNumber,
        department: participant.department,
        college: participant.college,
        avatar_seed: participant.avatarSeed,
      });
    } catch (e) {
      console.warn('Failed to upsert participant to Supabase:', e);
    }
  }

  /**
   * Create a new Escape Room
   */
  public async createRoom(
    teamName: string, 
    leader: Participant, 
    maxCapacity: number = 3
  ): Promise<{ room: Room; state: RoomState } | null> {
    if (!this.isAvailable() || !supabase) return null;

    try {
      await this.upsertParticipant(leader);

      const code = generateRoomCode();
      const now = new Date().toISOString();
      const cap = Math.min(Math.max(maxCapacity, 1), 3);

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code,
          team_name: teamName.trim(),
          leader_id: leader.id,
          max_capacity: cap,
          status: 'lobby',
          current_puzzle_number: 1,
        })
        .select()
        .single();

      if (roomError || !roomData) {
        console.error('Supabase create room error:', roomError);
        return null;
      }

      const roomId = roomData.id;

      // Insert leader as member
      const { data: memberData, error: memberError } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          participant_id: leader.id,
          is_online: true,
          is_ready: true,
        })
        .select()
        .single();

      if (memberError || !memberData) {
        console.error('Supabase add leader error:', memberError);
        return null;
      }

      const room: Room = {
        id: roomId,
        code: roomData.code,
        teamName: roomData.team_name,
        leaderId: roomData.leader_id,
        maxCapacity: roomData.max_capacity,
        status: roomData.status,
        currentPuzzleNumber: roomData.current_puzzle_number,
        createdAt: roomData.created_at,
        updatedAt: roomData.updated_at,
      };

      const leaderMember: RoomMember = {
        id: memberData.id,
        roomId,
        participantId: leader.id,
        participant: leader,
        joinedAt: memberData.joined_at,
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

      return { room, state };
    } catch (err) {
      console.error('Supabase createRoom exception:', err);
      return null;
    }
  }

  /**
   * Join Room with room code
   */
  public async joinRoom(
    roomCode: string, 
    participant: Participant
  ): Promise<{ success: boolean; room?: Room; state?: RoomState; error?: string }> {
    if (!this.isAvailable() || !supabase) {
      return { success: false, error: 'Database not connected' };
    }

    try {
      const cleanCode = roomCode.trim().toUpperCase();

      // 1. Look up room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (roomError || !roomData) {
        return { success: false, error: 'Room code not found. Please check and try again.' };
      }

      if (roomData.status === 'locked') {
        return { success: false, error: 'This room is currently locked by the administrator.' };
      }

      // 2. Fetch members
      const { data: membersData } = await supabase
        .from('room_members')
        .select('*, participant:participants(*)')
        .eq('room_id', roomData.id);

      const currentMembers: RoomMember[] = (membersData || []).map((m: any) => ({
        id: m.id,
        roomId: m.room_id,
        participantId: m.participant_id,
        participant: m.participant ? {
          id: m.participant.id,
          name: m.participant.name,
          email: m.participant.email,
          registerNumber: m.participant.register_number,
          department: m.participant.department,
          college: m.participant.college,
          avatarSeed: m.participant.avatar_seed,
          role: m.participant_id === roomData.leader_id ? 'leader' : 'member',
          createdAt: m.participant.created_at,
        } : participant,
        joinedAt: m.joined_at,
        isOnline: m.is_online,
        isReady: m.is_ready,
      }));

      // Check if participant already in room
      const existing = currentMembers.find((m) => m.participantId === participant.id);
      if (existing) {
        await supabase
          .from('room_members')
          .update({ is_online: true })
          .eq('id', existing.id);
        existing.isOnline = true;

        const fullState = await this.fetchFullRoomState(roomData.id);
        return { success: true, room: fullState?.room || undefined, state: fullState || undefined };
      }

      // Check capacity limit (capped at 3 members)
      if (currentMembers.length >= roomData.max_capacity) {
        return { 
          success: false, 
          error: `Room is full. Maximum capacity is ${roomData.max_capacity} members.` 
        };
      }

      // Insert participant
      await this.upsertParticipant(participant);

      // Insert member
      const { data: newMemData, error: joinErr } = await supabase
        .from('room_members')
        .insert({
          room_id: roomData.id,
          participant_id: participant.id,
          is_online: true,
          is_ready: false,
        })
        .select()
        .single();

      if (joinErr || !newMemData) {
        return { success: false, error: 'Could not join room. Please try again.' };
      }

      const fullState = await this.fetchFullRoomState(roomData.id);
      return { 
        success: true, 
        room: fullState?.room || undefined, 
        state: fullState || undefined 
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Database error joining room.' };
    }
  }

  /**
   * Fetch full room state from Supabase
   */
  public async fetchFullRoomState(roomId: string): Promise<RoomState | null> {
    if (!this.isAvailable() || !supabase) return null;

    try {
      const [roomRes, membersRes, cluesRes, puzzlesRes, subsRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('room_members').select('*, participant:participants(*)').eq('room_id', roomId),
        supabase.from('clue_progress').select('*').eq('room_id', roomId),
        supabase.from('puzzle_progress').select('*').eq('room_id', roomId),
        supabase.from('submissions').select('*').eq('room_id', roomId).order('submitted_at', { ascending: true })
      ]);

      if (!roomRes.data) return null;
      const r = roomRes.data;

      const room: Room = {
        id: r.id,
        code: r.code,
        teamName: r.team_name,
        leaderId: r.leader_id,
        maxCapacity: r.max_capacity,
        status: r.status,
        currentPuzzleNumber: r.current_puzzle_number,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };

      const members: RoomMember[] = (membersRes.data || []).map((m: any) => ({
        id: m.id,
        roomId: m.room_id,
        participantId: m.participant_id,
        participant: m.participant ? {
          id: m.participant.id,
          name: m.participant.name,
          email: m.participant.email,
          registerNumber: m.participant.register_number,
          department: m.participant.department,
          college: m.participant.college,
          avatarSeed: m.participant.avatar_seed,
          role: m.participant_id === r.leader_id ? 'leader' : 'member',
          createdAt: m.participant.created_at,
        } : {
          id: m.participant_id,
          name: 'Agent',
          email: '',
          registerNumber: '',
          department: '',
          college: '',
          avatarSeed: 'agent',
          role: 'member',
          createdAt: m.joined_at,
        },
        joinedAt: m.joined_at,
        isOnline: m.is_online,
        isReady: m.is_ready,
      }));

      const clueProgress: Record<string, ClueProgress> = {};
      (cluesRes.data || []).forEach((c: any) => {
        clueProgress[`${c.puzzle_id}_${c.clue_id}`] = {
          id: c.id,
          roomId: c.room_id,
          puzzleId: c.puzzle_id,
          clueId: c.clue_id,
          clueNumber: c.clue_number,
          isSolved: c.is_solved,
          solvedByParticipantId: c.solved_by_participant_id,
          earnedFragment: c.earned_fragment,
          solvedAt: c.solved_at,
        };
      });

      const puzzleProgress: Record<string, PuzzleProgress> = {};
      (puzzlesRes.data || []).forEach((p: any) => {
        puzzleProgress[p.puzzle_id] = {
          id: p.id,
          roomId: p.room_id,
          puzzleId: p.puzzle_id,
          puzzleNumber: p.puzzle_number,
          isCompleted: p.is_completed,
          completedByParticipantId: p.completed_by_participant_id,
          completedAt: p.completed_at,
        };
      });

      const submissions: AnswerSubmission[] = (subsRes.data || []).map((s: any) => ({
        id: s.id,
        roomId: s.room_id,
        puzzleId: s.puzzle_id,
        clueId: s.clue_id,
        clueNumber: s.clue_number,
        submittedByParticipantId: s.submitted_by_participant_id,
        submittedByParticipantName: 'Agent',
        submissionType: s.submission_type,
        answerText: s.answer_text,
        isCorrect: s.is_correct,
        timestamp: s.submitted_at,
      }));

      return {
        room,
        members,
        clueProgress,
        puzzleProgress,
        submissions,
      };
    } catch (e) {
      console.error('fetchFullRoomState error:', e);
      return null;
    }
  }

  /**
   * Subscribe to live Supabase Realtime channel for a room
   */
  public subscribeToRoom(roomId: string, onUpdate: (state: RoomState) => void): () => void {
    if (!this.isAvailable() || !supabase) {
      return () => {};
    }

    const channel = supabase.channel(`realtime_room_${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, async () => {
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, async () => {
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clue_progress', filter: `room_id=eq.${roomId}` }, async () => {
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puzzle_progress', filter: `room_id=eq.${roomId}` }, async () => {
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }

  /**
   * Update Ready or Online status in Supabase
   */
  public async updateMemberStatus(roomId: string, participantId: string, isOnline: boolean, isReady?: boolean) {
    if (!this.isAvailable() || !supabase) return;
    try {
      const updatePayload: any = { is_online: isOnline };
      if (typeof isReady === 'boolean') {
        updatePayload.is_ready = isReady;
      }
      await supabase
        .from('room_members')
        .update(updatePayload)
        .eq('room_id', roomId)
        .eq('participant_id', participantId);
    } catch (e) {
      console.warn('updateMemberStatus error:', e);
    }
  }

  /**
   * Start Room Challenge in Supabase
   */
  public async startRoomChallenge(roomId: string): Promise<boolean> {
    if (!this.isAvailable() || !supabase) return false;
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', roomId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all rooms for Admin Dashboard
   */
  public async getAllRoomsData(): Promise<any[]> {
    if (!this.isAvailable() || !supabase) return [];
    try {
      const { data: rooms } = await supabase
        .from('rooms')
        .select(`
          *,
          room_members(*, participant:participants(*)),
          puzzle_progress(*),
          clue_progress(*)
        `)
        .order('created_at', { ascending: false });

      if (!rooms) return [];

      return rooms.map((r: any) => {
        const room: Room = {
          id: r.id,
          code: r.code,
          teamName: r.team_name,
          leaderId: r.leader_id,
          maxCapacity: r.max_capacity,
          status: r.status,
          currentPuzzleNumber: r.current_puzzle_number,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };

        const members: RoomMember[] = (r.room_members || []).map((m: any) => ({
          id: m.id,
          roomId: m.room_id,
          participantId: m.participant_id,
          participant: m.participant ? {
            id: m.participant.id,
            name: m.participant.name,
            email: m.participant.email,
            registerNumber: m.participant.register_number,
            department: m.participant.department,
            college: m.participant.college,
            avatarSeed: m.participant.avatar_seed,
            role: m.participant_id === r.leader_id ? 'leader' : 'member',
            createdAt: m.participant.created_at,
          } : {
            id: m.participant_id,
            name: 'Agent',
            email: '',
            registerNumber: '',
            department: '',
            college: '',
            avatarSeed: 'agent',
            role: 'member',
            createdAt: m.joined_at,
          },
          joinedAt: m.joined_at,
          isOnline: m.is_online,
          isReady: m.is_ready,
        }));

        const puzzlesSolvedCount = (r.puzzle_progress || []).filter((p: any) => p.is_completed).length;
        const cluesSolvedCount = (r.clue_progress || []).filter((c: any) => c.is_solved).length;

        return {
          room,
          members,
          puzzlesSolvedCount,
          cluesSolvedCount,
          lastActive: r.updated_at || r.created_at,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Admin Reset / Clear All in Supabase
   */
  public async adminClearAllData(): Promise<boolean> {
    if (!this.isAvailable() || !supabase) return false;
    try {
      await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clue_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('puzzle_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('room_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return true;
    } catch {
      return false;
    }
  }
}

export const supabaseAdapter = new SupabaseAdapter();

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Participant, 
  Room, 
  RoomMember, 
  RoomState, 
  RoomStatus,
  ClueProgress, 
  PuzzleProgress, 
  AnswerSubmission 
} from '../types';
import { PUZZLES_DATA } from '../data/puzzlesData';
import { normalizeAnswer, generateRoomCode, ensureUUID } from '../utils/answerUtils';

export class SupabaseAdapter {
  public isAvailable(): boolean {
    return isSupabaseConfigured && supabase !== null;
  }

  /**
   * Save or upsert participant profile with verified UUID
   */
  public async upsertParticipant(participant: Participant): Promise<string> {
    if (!this.isAvailable() || !supabase) {
      return participant.id;
    }

    const validId = ensureUUID(participant.id);
    participant.id = validId;

    try {
      console.log('[Supabase] Upserting participant:', { id: validId, name: participant.name });
      const { error } = await supabase.from('participants').upsert({
        id: validId,
        name: participant.name.trim(),
        email: participant.email.trim(),
        register_number: participant.registerNumber.trim().toUpperCase(),
        department: participant.department.trim(),
        college: participant.college.trim() || 'Ramco Institute of Technology',
        avatar_seed: participant.avatarSeed || participant.name.trim().toLowerCase().replace(/\s+/g, '-'),
      });

      if (error) {
        console.error('[Supabase upsertParticipant Error]:', error);
      } else {
        console.log('[Supabase] Participant upserted successfully:', validId);
      }
    } catch (e) {
      console.error('[Supabase upsertParticipant Exception]:', e);
    }

    return validId;
  }

  /**
   * Create a new Escape Room in Supabase
   */
  public async createRoom(
    teamName: string, 
    leader: Participant, 
    maxCapacity: number = 3
  ): Promise<{ success: boolean; room?: Room; state?: RoomState; error?: string }> {
    if (!this.isAvailable() || !supabase) {
      return { success: false, error: 'Database is not connected.' };
    }

    try {
      // 1. Ensure leader is inserted with valid UUID
      const leaderId = await this.upsertParticipant(leader);
      leader.id = leaderId;

      const code = generateRoomCode();
      const cap = Math.min(Math.max(maxCapacity, 1), 3);

      console.log('[Supabase] Inserting room into public.rooms:', {
        code,
        team_name: teamName.trim(),
        leader_id: leaderId,
        max_capacity: cap,
      });

      // 2. Insert room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code,
          team_name: teamName.trim(),
          leader_id: leaderId,
          max_capacity: cap,
          status: 'lobby',
          current_puzzle_number: 1,
        })
        .select()
        .single();

      if (roomError || !roomData) {
        console.error('[Supabase createRoom Error]:', roomError);
        return { 
          success: false, 
          error: `Failed to insert room into database: ${roomError?.message || 'Unknown database error'}` 
        };
      }

      console.log('[Supabase] Room inserted successfully into public.rooms:', roomData);
      const roomId = roomData.id;

      // 3. Insert leader into room_members
      const { data: memberData, error: memberError } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          participant_id: leaderId,
          is_online: true,
          is_ready: true,
        })
        .select()
        .single();

      if (memberError || !memberData) {
        console.error('[Supabase addLeaderMember Error]:', memberError);
        return { 
          success: false, 
          error: `Room created but failed to attach leader member: ${memberError?.message || 'Member insert error'}` 
        };
      }

      console.log('[Supabase] Leader member attached successfully:', memberData);

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
        participantId: leaderId,
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

      return { success: true, room, state };
    } catch (err: any) {
      console.error('[Supabase createRoom Exception]:', err);
      return { 
        success: false, 
        error: `Supabase Exception: ${err?.message || 'Unexpected database error'}` 
      };
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
      return { success: false, error: 'Database is not connected.' };
    }

    try {
      const cleanCode = roomCode.trim().toUpperCase();
      console.log('[Supabase] Looking up room with code:', cleanCode);

      // 1. Look up room in public.rooms
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (roomError) {
        console.error('[Supabase joinRoom Lookup Error]:', roomError);
        return { success: false, error: `Database error querying room: ${roomError.message}` };
      }

      if (!roomData) {
        console.warn(`[Supabase joinRoom] No room found matching code: "${cleanCode}"`);
        return { success: false, error: 'Room code not found. Please check and try again.' };
      }

      console.log('[Supabase] Room found:', roomData);

      if (roomData.status === 'locked') {
        return { success: false, error: 'This room is currently locked by the administrator.' };
      }

      // 2. Fetch current room members
      const { data: membersData, error: membersError } = await supabase
        .from('room_members')
        .select('*, participant:participants(*)')
        .eq('room_id', roomData.id);

      if (membersError) {
        console.error('[Supabase joinRoom Members Error]:', membersError);
      }

      const participantId = await this.upsertParticipant(participant);
      participant.id = participantId;

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

      // Check if participant is already in room (rejoining)
      const existing = currentMembers.find((m) => m.participantId === participantId);
      if (existing) {
        console.log('[Supabase] Participant rejoining existing room:', existing.id);
        await supabase
          .from('room_members')
          .update({ is_online: true })
          .eq('id', existing.id);
        existing.isOnline = true;

        const fullState = await this.fetchFullRoomState(roomData.id);
        return { success: true, room: fullState?.room || undefined, state: fullState || undefined };
      }

      // Check capacity limit (strictly max 3 members)
      if (currentMembers.length >= roomData.max_capacity) {
        console.warn(`[Supabase] Room ${cleanCode} is at full capacity: ${currentMembers.length}/${roomData.max_capacity}`);
        return { 
          success: false, 
          error: `Room is full. Maximum capacity is ${roomData.max_capacity} members.` 
        };
      }

      // 3. Insert new member into room_members
      console.log('[Supabase] Inserting new member into room_members:', {
        room_id: roomData.id,
        participant_id: participantId,
      });

      const { data: newMemData, error: joinErr } = await supabase
        .from('room_members')
        .insert({
          room_id: roomData.id,
          participant_id: participantId,
          is_online: true,
          is_ready: false,
        })
        .select()
        .single();

      if (joinErr || !newMemData) {
        console.error('[Supabase joinRoom Insert Member Error]:', joinErr);
        return { success: false, error: `Could not join room: ${joinErr?.message || 'Member insert failed'}` };
      }

      console.log('[Supabase] Member joined room successfully:', newMemData);

      const fullState = await this.fetchFullRoomState(roomData.id);
      return { 
        success: true, 
        room: fullState?.room || undefined, 
        state: fullState || undefined 
      };
    } catch (err: any) {
      console.error('[Supabase joinRoom Exception]:', err);
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
      console.error('[Supabase fetchFullRoomState Exception]:', e);
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

    console.log('[Supabase] Subscribing to Realtime channel for room:', roomId);

    const channel = supabase.channel(`realtime_room_${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, async () => {
        console.log('[Supabase Realtime] Rooms table changed for room:', roomId);
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, async () => {
        console.log('[Supabase Realtime] Room members table changed for room:', roomId);
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clue_progress', filter: `room_id=eq.${roomId}` }, async () => {
        console.log('[Supabase Realtime] Clue progress changed for room:', roomId);
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puzzle_progress', filter: `room_id=eq.${roomId}` }, async () => {
        console.log('[Supabase Realtime] Puzzle progress changed for room:', roomId);
        const state = await this.fetchFullRoomState(roomId);
        if (state) onUpdate(state);
      })
      .subscribe((status) => {
        console.log(`[Supabase Realtime Channel Status for ${roomId}]:`, status);
      });

    return () => {
      console.log('[Supabase] Unsubscribing from Realtime channel for room:', roomId);
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
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_members(*, participant:participants(*)),
          puzzle_progress(*),
          clue_progress(*)
        `)
        .order('created_at', { ascending: false });

      if (error || !rooms) {
        console.error('[Supabase getAllRoomsData Error]:', error);
        return [];
      }

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

        const completedPuzzles = (r.puzzle_progress || []).filter((p: any) => p.is_completed);
        const puzzlesSolvedCount = completedPuzzles.length;
        const cluesSolvedCount = (r.clue_progress || []).filter((c: any) => c.is_solved).length;
        const isFinished = puzzlesSolvedCount >= 15 || r.status === 'completed';

        let finishedAt: string | undefined = undefined;
        if (isFinished) {
          const p15 = completedPuzzles.find((p: any) => p.puzzle_number === 15 || p.puzzle_id === 'puz-15');
          if (p15 && p15.completed_at) {
            finishedAt = p15.completed_at;
          } else {
            const dates = completedPuzzles
              .map((p: any) => p.completed_at)
              .filter(Boolean)
              .sort();
            finishedAt = dates[dates.length - 1] || r.updated_at || r.created_at;
          }
          room.completedAt = finishedAt;
        }

        return {
          room,
          members,
          puzzlesSolvedCount,
          cluesSolvedCount,
          lastActive: r.updated_at || r.created_at,
          finishedAt,
          isFinished,
        };
      });
    } catch (e) {
      console.error('[Supabase getAllRoomsData Exception]:', e);
      return [];
    }
  }

  /**
   * Update Room Status (e.g. locked, eliminated, in_progress)
   */
  public async updateRoomStatus(roomId: string, status: RoomStatus): Promise<boolean> {
    if (!this.isAvailable() || !supabase) return false;
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', roomId);

      if (error) {
        console.error('[Supabase updateRoomStatus Error]:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Supabase updateRoomStatus Exception]:', e);
      return false;
    }
  }

  /**
   * Delete a single room
   */
  public async deleteRoom(roomId: string): Promise<boolean> {
    if (!this.isAvailable() || !supabase) return false;
    try {
      await supabase.from('submissions').delete().eq('room_id', roomId);
      await supabase.from('clue_progress').delete().eq('room_id', roomId);
      await supabase.from('puzzle_progress').delete().eq('room_id', roomId);
      await supabase.from('room_members').delete().eq('room_id', roomId);
      const { error } = await supabase.from('rooms').delete().eq('id', roomId);
      return !error;
    } catch (e) {
      console.error('[Supabase deleteRoom Exception]:', e);
      return false;
    }
  }

  /**
   * Admin Reset / Clear All in Supabase
   */
  public async adminClearAllData(): Promise<boolean> {
    if (!this.isAvailable() || !supabase) return false;
    try {
      console.log('[Supabase] Clearing all data...');
      await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clue_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('puzzle_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('room_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('[Supabase] All data cleared successfully.');
      return true;
    } catch (e) {
      console.error('[Supabase adminClearAllData Exception]:', e);
      return false;
    }
  }
}

export const supabaseAdapter = new SupabaseAdapter();

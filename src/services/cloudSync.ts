import { RoomState } from '../types';

const MASTER_INDEX_OBJECT_ID = 'ff808181a09d98f701a0b5d30b4d3862';
const RESTFUL_API_BASE = 'https://api.restful-api.dev/objects';
const CLOUD_ID_CACHE_KEY = 'mystery_cloud_object_ids';

class CloudSyncService {
  // Map of roomId -> cloudObjectId on restful-api.dev
  private cloudIdMap: Record<string, string> = {};

  constructor() {
    this.loadCloudIds();
  }

  private loadCloudIds() {
    try {
      const data = localStorage.getItem(CLOUD_ID_CACHE_KEY);
      if (data) {
        this.cloudIdMap = JSON.parse(data);
      }
    } catch {
      this.cloudIdMap = {};
    }
  }

  private saveCloudIds() {
    try {
      localStorage.setItem(CLOUD_ID_CACHE_KEY, JSON.stringify(this.cloudIdMap));
    } catch {
      // ignore
    }
  }

  /**
   * Save or update RoomState to Cloud
   * Uses dual write: Netlify Function (/api/rooms) and Cloud Relay (api.restful-api.dev)
   */
  public async saveRoomState(state: RoomState): Promise<void> {
    if (!state || !state.room) return;

    const roomId = state.room.id;
    const cleanCode = state.room.code.trim().toUpperCase();

    // 1. Dual-write to Netlify Function if available
    try {
      const apiEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/rooms` : '/api/rooms';
      fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', state }),
      }).catch(() => {
        // Netlify function will fail gracefully if running purely static or local
      });
    } catch {
      // continue to Cloud Relay
    }

    // 2. Write to Cloud Relay (api.restful-api.dev) for cross-device support
    try {
      let cloudId = this.cloudIdMap[roomId];

      if (cloudId) {
        // Update existing cloud object
        const updateRes = await fetch(`${RESTFUL_API_BASE}/${cloudId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `RIT_ROOM_${cleanCode}`,
            data: state,
          }),
        });

        if (!updateRes.ok) {
          // If object expired or 404, reset and recreate
          cloudId = '';
        }
      }

      if (!cloudId) {
        // Create new cloud object
        const createRes = await fetch(RESTFUL_API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `RIT_ROOM_${cleanCode}`,
            data: state,
          }),
        });

        if (createRes.ok) {
          const created = await createRes.json();
          cloudId = created.id;
          this.cloudIdMap[roomId] = cloudId;
          this.saveCloudIds();
        }
      }

      // 3. Update Master Index with room registration
      if (cloudId) {
        this.registerInMasterIndex(cleanCode, {
          objectId: cloudId,
          roomId,
          code: cleanCode,
          teamName: state.room.teamName,
          status: state.room.status,
          membersCount: state.members.length,
          currentPuzzle: state.room.currentPuzzleNumber,
          updatedAt: state.room.updatedAt || new Date().toISOString(),
        }).catch((err) => console.warn('Master index registration warning:', err));
      }
    } catch (e) {
      console.warn('Cloud sync error:', e);
    }
  }

  /**
   * Register or update room metadata in Master Index
   */
  private async registerInMasterIndex(code: string, meta: any): Promise<void> {
    try {
      const getRes = await fetch(`${RESTFUL_API_BASE}/${MASTER_INDEX_OBJECT_ID}`);
      let currentRooms: Record<string, any> = {};

      if (getRes.ok) {
        const doc = await getRes.json();
        currentRooms = doc.data?.rooms || {};
      }

      currentRooms[code] = {
        ...currentRooms[code],
        ...meta,
        updatedAt: new Date().toISOString(),
      };

      await fetch(`${RESTFUL_API_BASE}/${MASTER_INDEX_OBJECT_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'RIT_ESCAPE_ROOM_MASTER_INDEX_V1',
          data: {
            rooms: currentRooms,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    } catch (e) {
      console.warn('Failed to update master index:', e);
    }
  }

  /**
   * Fetch room by 6-character room code from Cloud
   */
  public async fetchRoomByCode(roomCode: string): Promise<RoomState | null> {
    const cleanCode = roomCode.trim().toUpperCase();

    // 1. Try Netlify Function first
    try {
      const apiEndpoint = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/rooms?code=${cleanCode}` 
        : `/api/rooms?code=${cleanCode}`;

      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          if (json.state.room?.id) {
            // cache
            this.cloudIdMap[json.state.room.id] = json.state.room.id;
          }
          return json.state as RoomState;
        }
      }
    } catch {
      // fallback to Cloud Relay
    }

    // 2. Query Master Index on Cloud Relay
    try {
      const getIndex = await fetch(`${RESTFUL_API_BASE}/${MASTER_INDEX_OBJECT_ID}`);
      if (!getIndex.ok) return null;

      const indexDoc = await getIndex.json();
      const rooms = indexDoc.data?.rooms || {};
      const roomEntry = rooms[cleanCode];

      if (!roomEntry || !roomEntry.objectId) {
        return null;
      }

      // Fetch specific room object
      const getRoom = await fetch(`${RESTFUL_API_BASE}/${roomEntry.objectId}`);
      if (!getRoom.ok) return null;

      const roomDoc = await getRoom.json();
      const state = roomDoc.data as RoomState;

      if (state && state.room) {
        this.cloudIdMap[state.room.id] = roomEntry.objectId;
        this.saveCloudIds();
        return state;
      }
    } catch (e) {
      console.warn('fetchRoomByCode error:', e);
    }

    return null;
  }

  /**
   * Fetch room by room ID
   */
  public async fetchRoomById(roomId: string, code?: string): Promise<RoomState | null> {
    // 1. Try Netlify Function
    try {
      const apiEndpoint = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/rooms?id=${roomId}` 
        : `/api/rooms?id=${roomId}`;

      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          return json.state as RoomState;
        }
      }
    } catch {
      // fallback
    }

    // 2. Try known cloudId from cache
    const cloudId = this.cloudIdMap[roomId];
    if (cloudId) {
      try {
        const getRoom = await fetch(`${RESTFUL_API_BASE}/${cloudId}`);
        if (getRoom.ok) {
          const roomDoc = await getRoom.json();
          return roomDoc.data as RoomState;
        }
      } catch {
        // continue
      }
    }

    // 3. Try lookup via code if provided
    if (code) {
      return this.fetchRoomByCode(code);
    }

    return null;
  }

  /**
   * Fetch all registered rooms (for Admin Dashboard)
   */
  public async fetchAllRooms(): Promise<Record<string, any>> {
    // 1. Try Netlify Function
    try {
      const apiEndpoint = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/rooms?all=true` 
        : `/api/rooms?all=true`;

      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.rooms && Object.keys(json.rooms).length > 0) {
          return json.rooms;
        }
      }
    } catch {
      // fallback
    }

    // 2. Fetch from Master Index
    try {
      const getIndex = await fetch(`${RESTFUL_API_BASE}/${MASTER_INDEX_OBJECT_ID}`);
      if (getIndex.ok) {
        const indexDoc = await getIndex.json();
        return indexDoc.data?.rooms || {};
      }
    } catch (e) {
      console.warn('fetchAllRooms error:', e);
    }

    return {};
  }

  /**
   * Wipe all rooms from Cloud (Admin Reset)
   */
  public async clearAllCloudData(): Promise<boolean> {
    try {
      // Netlify clear
      const apiEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/rooms` : '/api/rooms';
      fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearAll' }),
      }).catch(() => {});

      // Master index reset
      await fetch(`${RESTFUL_API_BASE}/${MASTER_INDEX_OBJECT_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'RIT_ESCAPE_ROOM_MASTER_INDEX_V1',
          data: {
            rooms: {},
            updatedAt: new Date().toISOString(),
          },
        }),
      });

      this.cloudIdMap = {};
      this.saveCloudIds();
      return true;
    } catch {
      return false;
    }
  }
}

export const cloudSync = new CloudSyncService();

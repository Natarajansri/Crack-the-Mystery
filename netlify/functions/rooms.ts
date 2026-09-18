import { getStore } from "@netlify/blobs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const codeParam = url.searchParams.get("code");
    const idParam = url.searchParams.get("id");
    const allParam = url.searchParams.get("all");

    // Initialize Blobs store with fallback
    let store: any = null;
    try {
      store = getStore("crack_the_mystery_rooms");
    } catch {
      store = null;
    }

    if (req.method === "GET") {
      if (!store) {
        return new Response(
          JSON.stringify({ success: false, error: "Blobs store not initialized" }),
          { status: 200, headers: corsHeaders }
        );
      }

      if (codeParam) {
        const cleanCode = codeParam.trim().toUpperCase();
        // Look up by room code
        const state = await store.get(`room_code_${cleanCode}`, { type: "json" });
        if (state) {
          return new Response(JSON.stringify({ success: true, state, room: state.room }), {
            status: 200,
            headers: corsHeaders,
          });
        }
        return new Response(
          JSON.stringify({ success: false, error: "Room code not found" }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (idParam) {
        const state = await store.get(`room_id_${idParam}`, { type: "json" });
        if (state) {
          return new Response(JSON.stringify({ success: true, state, room: state.room }), {
            status: 200,
            headers: corsHeaders,
          });
        }
        return new Response(
          JSON.stringify({ success: false, error: "Room not found" }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (allParam) {
        const index = (await store.get("room_index", { type: "json" })) || {};
        return new Response(JSON.stringify({ success: true, rooms: index }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: "Missing query parameters" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action, state } = body;

      if (!store) {
        return new Response(
          JSON.stringify({ success: false, error: "Blobs store not initialized" }),
          { status: 200, headers: corsHeaders }
        );
      }

      if (action === "save" && state && state.room) {
        const cleanCode = state.room.code.trim().toUpperCase();
        const roomId = state.room.id;

        // Save state by code and by id
        await store.setJSON(`room_code_${cleanCode}`, state);
        await store.setJSON(`room_id_${roomId}`, state);

        // Update index
        const index = (await store.get("room_index", { type: "json" })) || {};
        index[cleanCode] = {
          roomId,
          code: cleanCode,
          teamName: state.room.teamName,
          status: state.room.status,
          membersCount: state.members.length,
          currentPuzzle: state.room.currentPuzzleNumber,
          updatedAt: state.room.updatedAt || new Date().toISOString(),
        };
        await store.setJSON("room_index", index);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      if (action === "clearAll") {
        await store.setJSON("room_index", {});
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: "Unknown action" }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

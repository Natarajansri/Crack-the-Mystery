// String normalizer for answer comparison
export function normalizeAnswer(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.,!?:;'"]/g, '');
}

// Generate human-friendly 6-character room code (avoiding easily confused chars like 0/O, 1/I)
export function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Standard RFC4122 v4 UUID generator (compatible with PostgreSQL UUID columns)
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Check if a string is a valid UUID
export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// Ensure an ID is a valid UUID (generates a new UUID if invalid)
export function ensureUUID(id?: string | null): string {
  if (id && isValidUUID(id)) {
    return id;
  }
  return generateUUID();
}

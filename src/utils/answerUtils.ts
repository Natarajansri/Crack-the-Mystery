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

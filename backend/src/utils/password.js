// Generates a strong temporary password that satisfies the Keycloak policy
// (>=12 chars, at least one digit and one special character).
import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*?';
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

function pick(set) {
  return set[randomInt(set.length)];
}

export function generateTempPassword(length = 16) {
  // Guarantee one of each required class, then fill the rest randomly.
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  for (let i = chars.length; i < length; i++) chars.push(pick(ALL));
  // Fisher–Yates shuffle so required chars aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

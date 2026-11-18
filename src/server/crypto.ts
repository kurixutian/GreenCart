import crypto from 'node:crypto';
import type { SafeUser } from '../shared/types.ts';

const SCRYPT_KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }
  const actualBuf = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function generateOpaqueReceiptToken(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `GC-${hex}`;
}

export function signSessionToken(user: SafeUser, secret: string): string {
  const payloadJson = JSON.stringify({
    account_id: user.account_id,
    username: user.username,
    account_type: user.account_type,
    full_name: user.full_name,
    iat: Date.now(),
  });
  const payloadB64 = Buffer.from(payloadJson, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): SafeUser | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SafeUser;
    if (
      typeof parsed.account_id !== 'number' ||
      typeof parsed.username !== 'string' ||
      (parsed.account_type !== 'customer' && parsed.account_type !== 'admin') ||
      typeof parsed.full_name !== 'string'
    ) {
      return null;
    }
    return {
      account_id: parsed.account_id,
      username: parsed.username,
      account_type: parsed.account_type,
      full_name: parsed.full_name,
    };
  } catch {
    return null;
  }
}

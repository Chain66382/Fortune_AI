import crypto from 'node:crypto';

const SCRYPT_KEY_LENGTH = 64;

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
};

export const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, hash] = storedHash.split(':');

  if (!salt || !hash) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derivedKey, 'hex'));
};

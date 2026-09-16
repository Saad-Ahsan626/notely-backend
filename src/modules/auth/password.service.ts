import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/**
 * OWASP baseline for argon2id (19 MiB memory, 2 iterations, 1 thread).
 * Memory cost is what makes GPU cracking expensive. Raise these over time:
 * existing users are upgraded automatically on their next login.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A real argon2id hash of a random throwaway value, used to spend the same time on logins
 * with an unknown email as on real ones. Without it, response timing reveals which
 * emails are registered.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$wc+AI1cf3pynSBnMNgZGuw$qs3lIxYSWUbeBM3CWYTcDSkrbB1aK+byvkg+uoRWJGE';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  /** False instead of throwing when the stored hash is malformed. */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Burns the same CPU time as a real verification, for unknown emails. */
  async verifyDummy(password: string): Promise<void> {
    await this.verify(DUMMY_HASH, password);
  }

  /** True when a hash was created with weaker settings than the current ones. */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, ARGON2_OPTIONS);
    } catch {
      return true;
    }
  }
}

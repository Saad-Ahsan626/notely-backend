import argon2 from 'argon2';
import { ARGON2_OPTIONS, PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();
  const password = 'CorrectHorseBattery1';

  it('produces an argon2id hash that is not the password', async () => {
    const hash = await service.hash(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(password);
  });

  it('salts every hash, so equal passwords look different', async () => {
    const [first, second] = await Promise.all([
      service.hash(password),
      service.hash(password),
    ]);

    expect(first).not.toBe(second);
    await expect(service.verify(first, password)).resolves.toBe(true);
    await expect(service.verify(second, password)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash(password);

    await expect(service.verify(hash, 'WrongPassword1')).resolves.toBe(false);
  });

  it('returns false instead of throwing on a malformed hash', async () => {
    await expect(service.verify('not-a-hash', password)).resolves.toBe(false);
  });

  it('does not ask for a rehash when the settings match', async () => {
    const hash = await service.hash(password);

    expect(service.needsRehash(hash)).toBe(false);
  });

  it('asks for a rehash when the stored hash used weaker settings', async () => {
    const weakHash = await argon2.hash(password, {
      ...ARGON2_OPTIONS,
      memoryCost: 8192,
    });

    expect(service.needsRehash(weakHash)).toBe(true);
  });

  it('spends real time on the dummy verification (timing defence)', async () => {
    const started = Date.now();
    await service.verifyDummy(password);

    expect(Date.now() - started).toBeGreaterThan(5);
  });
});

import type { UserModel } from '../../../generated/prisma/models.js';
import { toUserResponse } from './user-response.dto.js';

describe('toUserResponse', () => {
  const user: UserModel = {
    id: '01a0a4eb-be81-7015-b47f-565f552f45b4',
    email: 'alex@example.com',
    name: 'Alex Carter',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$secret-hash',
    createdAt: new Date('2026-09-15T10:30:00.000Z'),
    updatedAt: new Date('2026-09-16T08:00:00.000Z'),
  };

  it('returns only the public fields, as ISO timestamps', () => {
    expect(toUserResponse(user)).toEqual({
      id: user.id,
      name: 'Alex Carter',
      email: 'alex@example.com',
      createdAt: '2026-09-15T10:30:00.000Z',
      updatedAt: '2026-09-16T08:00:00.000Z',
    });
  });

  it('never exposes the password hash', () => {
    const response = toUserResponse(user);

    expect(response).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response)).not.toContain('argon2');
  });
});

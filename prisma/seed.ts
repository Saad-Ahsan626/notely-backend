/**
 * Development seed: creates a demo user with sample notes.
 *
 * Idempotent: running it again resets the demo user's notes to the same state instead of
 * creating duplicates. Refuses to run when NODE_ENV=production.
 *
 * Run with: npm run db:seed
 */
import { existsSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { hash } from 'argon2';
import { ARGON2_OPTIONS } from '../src/modules/auth/password.service.js';
import { validateEnv } from '../src/config/env.schema.js';
import { createPoolConfig } from '../src/database/database-connection.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Same validation as the app: a misconfigured seed fails fast with a clear message
const env = validateEnv(process.env);

if (env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed: NODE_ENV is "production".');
}

/** Local development credentials only. Documented in the README. */
const DEMO_USER = {
  email: 'demo@notely.dev',
  name: 'Demo User',
  password: 'DemoPassword123!',
};

const DEMO_NOTES = [
  {
    title: 'Welcome to Notely 👋',
    content: 'Your notes are stored in MySQL with full emoji support 🎉',
    isPinned: true,
  },
  {
    title: 'Grocery list',
    content: 'Milk, eggs 🥚, bread, coffee ☕',
  },
  {
    title: 'Project ideas',
    content: 'Offline sync for the Flutter app, note sharing, tags.',
    isArchived: true,
  },
  {
    title: 'Old draft',
    content: 'This note is soft-deleted and must never appear in the API.',
    deletedAt: new Date(),
  },
];

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(createPoolConfig(env)),
});

async function seed(): Promise<void> {
  // Same settings the API uses, so the demo user is not re-hashed on first login
  const passwordHash = await hash(DEMO_USER.password, ARGON2_OPTIONS);

  const user = await prisma.$transaction(async (tx) => {
    const demoUser = await tx.user.upsert({
      where: { email: DEMO_USER.email },
      update: { name: DEMO_USER.name, passwordHash },
      create: {
        email: DEMO_USER.email,
        name: DEMO_USER.name,
        passwordHash,
      },
    });

    // Notes have no natural unique key, so reset them to a known state instead of upserting
    await tx.note.deleteMany({ where: { userId: demoUser.id } });
    await tx.note.createMany({
      data: DEMO_NOTES.map((note) => ({ ...note, userId: demoUser.id })),
    });

    return demoUser;
  });

  const noteCount = await prisma.note.count({ where: { userId: user.id } });
  console.log(`Seeded ${user.email} with ${noteCount} notes.`);
}

try {
  await seed();
} catch (error) {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module.js';
import { validateEnv } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NotesModule } from './modules/notes/notes.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    // Infrastructure
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule,
    DatabaseModule,
    CommonModule,

    // Features
    HealthModule,
    AuthModule,
    UsersModule,
    NotesModule,
  ],
})
export class AppModule {}

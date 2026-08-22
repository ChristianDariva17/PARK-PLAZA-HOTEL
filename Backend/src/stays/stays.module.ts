import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StaysController } from './stays.controller.js';
import { StaysService } from './stays.service.js';

@Module({ imports: [AuthModule], controllers: [StaysController], providers: [StaysService] })
export class StaysModule {}

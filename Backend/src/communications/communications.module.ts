import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CommunicationsService } from './communications.service.js';
import { CommunicationsController } from './communications.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService]
})
export class CommunicationsModule {}

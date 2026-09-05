import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ExperiencesService } from './experiences.service.js';
import { ExperiencesController } from './experiences.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService]
})
export class ExperiencesModule {}

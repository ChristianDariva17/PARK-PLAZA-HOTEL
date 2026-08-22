import { Module } from '@nestjs/common';
import { PetsController } from './pets.controller.js';
import { PetsService } from './pets.service.js';

@Module({
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}

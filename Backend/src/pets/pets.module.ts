import { Module } from '@nestjs/common';
import { PetsController } from './pets.controller.js';
import { PetsService } from './pets.service.js';
import { FolioModule } from '../folios/folio.module.js';

@Module({
  controllers: [PetsController],
  imports: [FolioModule],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}

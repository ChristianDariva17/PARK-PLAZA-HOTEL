import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { FolioModule } from '../folios/folio.module.js';
import { AmenitiesController } from './amenities.controller.js';
import { AmenitiesService } from './amenities.service.js';

@Module({
  imports: [DatabaseModule, FolioModule],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}

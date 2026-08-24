import { Module } from '@nestjs/common';
import { ParkingController } from './parking.controller.js';
import { ParkingService } from './parking.service.js';
import { FolioModule } from '../folios/folio.module.js';

@Module({
  controllers: [ParkingController],
  imports: [FolioModule],
  providers: [ParkingService],
  exports: [ParkingService],
})
export class ParkingModule {}

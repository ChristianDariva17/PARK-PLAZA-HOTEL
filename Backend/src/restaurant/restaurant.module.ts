import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { FolioModule } from '../folios/folio.module.js';
import { RestaurantController } from './restaurant.controller.js';
import { RestaurantService } from './restaurant.service.js';

@Module({
  imports: [DatabaseModule, FolioModule],
  controllers: [RestaurantController],
  providers: [RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}

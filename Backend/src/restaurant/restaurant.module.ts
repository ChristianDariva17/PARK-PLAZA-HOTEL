import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { RestaurantController } from './restaurant.controller.js';
import { RestaurantService } from './restaurant.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [RestaurantController],
  providers: [RestaurantService],
})
export class RestaurantModule {}

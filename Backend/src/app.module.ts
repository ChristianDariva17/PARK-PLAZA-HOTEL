import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { GuestsModule } from './guests/guests.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { StaysModule } from './stays/stays.module.js';
import { CleaningModule } from './cleaning/cleaning.module.js';
import { IncidentsModule } from './incidents/incidents.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { CashModule } from './cash/cash.module.js';
import { RestaurantModule } from './restaurant/restaurant.module.js';
import { ParkingModule } from './parking/parking.module.js';
import { PetsModule } from './pets/pets.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    AccountsModule,
    GuestsModule,
    RoomsModule,
    ReservationsModule,
    StaysModule,
    CleaningModule,
    IncidentsModule,
    MaintenanceModule,
    CashModule,
    RestaurantModule,
    ParkingModule,
    PetsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

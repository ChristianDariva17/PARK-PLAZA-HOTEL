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
import { FolioModule } from './folios/folio.module.js';
import { ReceivablesModule } from './receivables/receivables.module.js';
import { CustomerModule } from './customer/customer.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { StaffModule } from './staff/staff.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AmenitiesModule } from './amenities/amenities.module.js';
import { RolesModule } from './roles/roles.module.js';
import { CommunicationsModule } from './communications/communications.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    DatabaseModule,
    RealtimeModule,
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
    FolioModule,
    ReceivablesModule,
    CustomerModule,
    DocumentsModule,
    SuppliersModule,
    StaffModule,
    AttendanceModule,
    AmenitiesModule,
    RolesModule,
    CommunicationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import type { Environment } from '../config/environment.js';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomerReservationsController } from './customer-reservations.controller.js';
import { CustomerRestaurantController } from './customer-restaurant.controller.js';
import { CustomerSessionGuard } from './customer-session.guard.js';
import { FIREBASE_TOKEN_VERIFIER } from './customer.tokens.js';
import { FirebaseTokenVerifier } from './firebase-token-verifier.js';
import { RestaurantModule } from '../restaurant/restaurant.module.js';
import { AmenitiesModule } from '../amenities/amenities.module.js';
import { CustomerAmenitiesController } from './customer-amenities.controller.js';
import { EventsModule } from '../events/events.module.js';
import { CustomerEventsController } from './customer-events.controller.js';
import { RoomsModule } from '../rooms/rooms.module.js';

@Module({
  imports: [AuditModule, AuthModule, ReservationsModule, RestaurantModule, AmenitiesModule, EventsModule, RoomsModule],
  controllers: [CustomerAuthController, CustomerReservationsController, CustomerRestaurantController, CustomerAmenitiesController, CustomerEventsController],
  providers: [
    CustomerAuthService,
    CustomerSessionGuard,
    {
      provide: FIREBASE_TOKEN_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => new FirebaseTokenVerifier(config.get('FIREBASE_PROJECT_ID', { infer: true })),
    },
  ],
})
export class CustomerModule {}

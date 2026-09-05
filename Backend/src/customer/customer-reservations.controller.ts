import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type { Environment } from '../config/environment.js';
import { parseCustomerAvailabilityQuery, parseCustomerBookingDto, parseCustomerIdempotencyKey, parseCustomerReservationId } from './customer.dto.js';
import { CustomerSessionGuard } from './customer-session.guard.js';
import type { CustomerAuthenticatedRequest } from './customer.types.js';

@Public()
@Controller('customer/reservations')
export class CustomerReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly rooms: RoomsService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get('amenities')
  amenities() {
    return this.rooms.listAmenities(this.config.get('CUSTOMER_PORTAL_PROPERTY_ID', { infer: true }));
  }

  @Get('availability')
  availability(@Query() query: unknown) {
    return this.reservations.customerAvailability(this.config.get('CUSTOMER_PORTAL_PROPERTY_ID', { infer: true }), parseCustomerAvailabilityQuery(query));
  }

  @Post()
  @UseGuards(CustomerSessionGuard)
  create(@Body() body: unknown, @Headers('idempotency-key') key: unknown, @Req() request: CustomerAuthenticatedRequest) {
    return this.reservations.createForCustomer(request.customer!, parseCustomerBookingDto(body), parseCustomerIdempotencyKey(key), getRequestContext(request));
  }

  @Get(':id')
  @UseGuards(CustomerSessionGuard)
  detail(@Param('id') id: string, @Req() request: CustomerAuthenticatedRequest) {
    return this.reservations.customerDetail(request.customer!, parseCustomerReservationId(id));
  }
}

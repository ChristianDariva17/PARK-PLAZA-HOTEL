import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator.js';
import { EventsService } from '../events/events.service.js';
import { customerCreateEventDto, quoteEventDto } from '../events/events.dto.js';
import { parseCustomerIdempotencyKey, parseCustomerReservationId } from './customer.dto.js';
import { CustomerSessionGuard } from './customer-session.guard.js';
import type { CustomerAuthenticatedRequest } from './customer.types.js';
import type { Environment } from '../config/environment.js';

const cancellationDto = z.object({ reason: z.string().min(1).max(500) });

@Public()
@Controller('customer/events')
export class CustomerEventsController {
  constructor(private readonly events: EventsService, private readonly config: ConfigService<Environment, true>) {}

  @Get('spaces')
  spaces() {
    return this.events.getSpaces(this.config.get('CUSTOMER_PORTAL_PROPERTY_ID', { infer: true }));
  }

  @Get('spaces/:id')
  spacePolicy(@Param('id') id: string) {
    return this.events.getSpacePolicy(this.config.get('CUSTOMER_PORTAL_PROPERTY_ID', { infer: true }), id);
  }

  @Post('quote')
  @UseGuards(CustomerSessionGuard)
  quote(@Body() body: unknown, @Req() request: CustomerAuthenticatedRequest) {
    return this.events.quote(request.customer!.propertyId, quoteEventDto.parse(body));
  }

  @Get()
  @UseGuards(CustomerSessionGuard)
  list(@Req() request: CustomerAuthenticatedRequest) {
    return this.events.listCustomerEvents(request.customer!);
  }

  @Post()
  @UseGuards(CustomerSessionGuard)
  create(@Body() body: unknown, @Headers('idempotency-key') key: unknown, @Req() request: CustomerAuthenticatedRequest) {
    return this.events.createCustomerPreReservation(request.customer!, customerCreateEventDto.parse(body), parseCustomerIdempotencyKey(key));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(CustomerSessionGuard)
  cancel(@Param('id') id: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @Req() request: CustomerAuthenticatedRequest) {
    return this.events.cancelCustomerEvent(request.customer!, parseCustomerReservationId(id), cancellationDto.parse(body).reason, parseCustomerIdempotencyKey(key));
  }
}

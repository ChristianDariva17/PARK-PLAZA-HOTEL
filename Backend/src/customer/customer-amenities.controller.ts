import { Controller, Post, Body, Req, Get, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { AmenitiesService } from '../amenities/amenities.service.js';
import { CustomerSessionGuard } from './customer-session.guard.js';
import type { CustomerAuthenticatedRequest } from './customer.types.js';
import { z } from 'zod';

const CreateReservationSchema = z.object({
  amenityType: z.string().min(1).max(50),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  pax: z.number().int().min(1).default(1),
  documentNumber: z.string().min(1).max(32).optional(),
  customerName: z.string().min(1).max(200).optional(),
});

@Controller('customer/amenities')
@Public()
export class CustomerAmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get('config')
  async getConfigs(@Req() req: any) {
    const propertyId =
      req.customer?.propertyId ||
      process.env.CUSTOMER_PORTAL_PROPERTY_ID ||
      '709c9100-9382-4a14-a22e-7c00aa54b185';
    return this.amenitiesService.getConfigs(propertyId);
  }

  @Get('reservations')
  @UseGuards(CustomerSessionGuard)
  async listReservations(@Req() req: CustomerAuthenticatedRequest) {
    return this.amenitiesService.listReservations(req.customer!);
  }

  @Post('reservations')
  @UseGuards(CustomerSessionGuard)
  async createReservation(@Req() req: CustomerAuthenticatedRequest, @Body() body: any) {
    const data = CreateReservationSchema.parse(body);
    return this.amenitiesService.createReservation(req.customer!, data);
  }
}

import { Body, Controller, Get, Headers, HttpCode, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator.js';
import { RestaurantService } from '../restaurant/restaurant.service.js';
import type { Environment } from '../config/environment.js';
import { parseCustomerCancelOrderDto, parseCustomerCreateOrderDto, parseCustomerIdempotencyKey, parseCustomerReservationId } from './customer.dto.js';
import { CustomerSessionGuard } from './customer-session.guard.js';
import type { CustomerAuthenticatedRequest } from './customer.types.js';

@Controller('customer/restaurant')
export class CustomerRestaurantController {
  constructor(private readonly restaurant: RestaurantService, private readonly config: ConfigService<Environment, true>) {}

  @Public()
  @Get('menu')
  menu() {
    return this.restaurant.listMenu(this.config.get('CUSTOMER_PORTAL_PROPERTY_ID', { infer: true }));
  }

  @Get('orders')
  @Public()
  @UseGuards(CustomerSessionGuard)
  orders(@Req() request: CustomerAuthenticatedRequest) {
    return this.restaurant.listCustomerOrders(request.customer!);
  }

  @Get('active-stays')
  @Public()
  @UseGuards(CustomerSessionGuard)
  activeStays(@Req() request: CustomerAuthenticatedRequest) {
    return this.restaurant.listCustomerActiveStays(request.customer!);
  }

  @Post('orders')
  @Public()
  @UseGuards(CustomerSessionGuard)
  create(@Body() body: unknown, @Headers('idempotency-key') key: unknown, @Req() request: CustomerAuthenticatedRequest) {
    if (!body || typeof body !== 'object' || (!('stayId' in body && body.stayId) && !('amenityReservationId' in body && body.amenityReservationId))) {
      throw new HttpException({ version: 1, outcome: 'rejected', code: 'TARGET_ACCOUNT_REQUIRED' }, HttpStatus.BAD_REQUEST);
    }
    return this.restaurant.createCustomerOrder(
      request.customer!,
      parseCustomerCreateOrderDto(body),
      parseCustomerIdempotencyKey(key)
    );
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Public()
  @UseGuards(CustomerSessionGuard)
  cancel(@Param('id') id: string, @Body() body: unknown, @Headers('idempotency-key') key: unknown, @Req() request: CustomerAuthenticatedRequest) {
    return this.restaurant.cancelCustomerOrder(request.customer!, parseCustomerReservationId(id), parseCustomerCancelOrderDto(body), parseCustomerIdempotencyKey(key));
  }
}

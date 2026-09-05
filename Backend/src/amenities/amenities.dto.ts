import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateAmenityConfigDto {
  @IsString()
  @IsIn(['piscina', 'mirador'])
  amenityKey!: 'piscina' | 'mirador';

  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceExternal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceGuest?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxPax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  capacity?: number;

  @IsOptional()
  @IsString()
  openingHour?: string;

  @IsOptional()
  @IsString()
  closingHour?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateManualAmenityPassDto {
  @IsString()
  @IsIn(['piscina', 'mirador', 'Piscina', 'Mirador'])
  amenityType!: string;

  @IsOptional()
  @IsString()
  stayId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  documentNumber?: string;

  @IsString()
  @Length(2, 200)
  customerName!: string;

  @IsInt()
  @Min(1)
  @Max(30)
  pax!: number;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customPrice?: number;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'open_tab', 'paid'])
  paymentStatus?: 'pending' | 'open_tab' | 'paid';

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class CreateAmenityBlockDto {
  @IsString()
  @IsIn(['piscina', 'mirador', 'Piscina', 'Mirador'])
  amenityKey!: string;

  @IsString()
  @Length(3, 250)
  reason!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;
}

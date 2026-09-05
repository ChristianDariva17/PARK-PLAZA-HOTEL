import { IsString, IsUUID, IsOptional, IsEnum, IsBoolean, IsNumber, Min, IsDateString, IsInt, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExperienceDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  type!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxCapacity?: number;

  @IsBoolean()
  requiresReservation!: boolean;

  @IsNumber()
  @Min(0)
  price!: number;
}

export class UpdateExperienceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxCapacity?: number;

  @IsBoolean()
  @IsOptional()
  requiresReservation?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

export class CreateParticipationDto {
  @IsUUID()
  @IsOptional()
  stayId?: string;

  @IsUUID()
  @IsOptional()
  guestId?: string;

  @IsInt()
  @Min(1)
  pax!: number;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class ListExperiencesQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  type?: string;
}

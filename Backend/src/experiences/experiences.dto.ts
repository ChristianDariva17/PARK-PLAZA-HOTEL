import { IsString, IsUUID, IsOptional, IsBoolean, IsNumber, Min, IsDateString, IsInt, Max, IsIn, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export const EXPERIENCE_TYPES = ['POOL', 'WELLNESS', 'TOUR', 'DINING', 'EVENT'] as const;
export const EXPERIENCE_STATUSES = ['DRAFT', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED'] as const;

export class CreateExperienceDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsIn(EXPERIENCE_TYPES)
  type!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  maxCapacity?: number;

  @IsBoolean()
  requiresReservation!: boolean;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  price!: number;
}

export class UpdateExperienceDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  maxCapacity?: number;

  @IsBoolean()
  @IsOptional()
  requiresReservation?: boolean;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  @IsIn(EXPERIENCE_STATUSES)
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
  @Max(100000)
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

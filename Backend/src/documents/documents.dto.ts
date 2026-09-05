import { IsString, IsUUID, IsOptional, IsEnum, IsObject, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContractDto {
  @IsUUID()
  @IsOptional()
  reservationId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class TransitionContractDto {
  @IsString()
  targetState!: 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'ARCHIVED' | 'VOID';

  @IsString()
  @IsOptional()
  reason?: string;
}

export class LinkEvidenceDto {
  @IsUUID()
  evidenceId!: string;
}

export class RegisterEvidenceDto {
  @IsString()
  sourceType!: 'MAINTENANCE' | 'CLEANING' | 'CONTRACTS' | 'INCIDENTS';

  @IsString()
  evidenceType!: string;

  @IsString()
  referenceId!: string;

  @IsString()
  description!: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsUUID()
  idempotencyKey!: string;
}

export class ListContractsQueryDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

export class ListEvidenceQueryDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  referenceId?: string;
}

export class ListAuditEventsQueryDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  eventType?: string;

  @IsString()
  @IsOptional()
  subjectType?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsUUID()
  @IsOptional()
  actorAccountId?: string;

  @IsISO8601()
  @IsOptional()
  from?: string;

  @IsISO8601()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  search?: string;
}

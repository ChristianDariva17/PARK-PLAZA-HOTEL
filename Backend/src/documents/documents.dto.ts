import { IsString, IsUUID, IsOptional, IsObject, IsInt, Min, Max, IsISO8601, IsIn, MaxLength, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export const CONTRACT_TARGET_STATES = ['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'ARCHIVED', 'VOID'] as const;
export const CONTRACT_STATUSES = ['Borrador', 'Pendiente', 'Vigente', 'Reemplazado', 'Cancelado'] as const;

export class CreateContractDto {
  @IsUUID()
  @IsOptional()
  reservationId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  reference?: string;

  @IsString()
  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class TransitionContractDto {
  @IsString()
  @IsIn(CONTRACT_TARGET_STATES)
  targetState!: typeof CONTRACT_TARGET_STATES[number];

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class LinkEvidenceDto {
  @IsUUID()
  evidenceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  relationType!: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class RegisterEvidenceDto {
  @IsString()
  @IsIn(['MAINTENANCE', 'CLEANING', 'CONTRACTS', 'INCIDENTS'])
  sourceType!: 'MAINTENANCE' | 'CLEANING' | 'CONTRACTS' | 'INCIDENTS';

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  evidenceType!: string;

  @IsUUID()
  referenceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
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
  @MaxLength(128)
  reference?: string;

  @IsString()
  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
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
  @IsIn(['maintenance', 'cleaning', 'contract', 'incident', 'MAINTENANCE', 'CLEANING', 'CONTRACTS', 'INCIDENTS'])
  source?: string;

  @IsUUID()
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
  @MaxLength(128)
  eventType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  subjectType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
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
  @MaxLength(255)
  search?: string;
}

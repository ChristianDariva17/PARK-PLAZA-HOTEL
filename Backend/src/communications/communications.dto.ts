import { IsString, IsUUID, IsOptional, IsEnum, IsBoolean, IsObject, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePreferenceDto {
  @IsString()
  channel!: string;

  @IsString()
  purpose!: string;

  @IsBoolean()
  optIn!: boolean;

  @IsString()
  @IsOptional()
  consentVersion?: string;
}

export class MarkNotificationReadDto {
  @IsBoolean()
  isRead!: boolean;
}

export class ListNotificationsQueryDto {
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

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  unreadOnly?: boolean;
}

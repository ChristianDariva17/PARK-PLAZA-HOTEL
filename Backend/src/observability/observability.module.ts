import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ClientTelemetryController } from './client-telemetry.controller.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [MetricsController, ClientTelemetryController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule {}

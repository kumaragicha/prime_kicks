import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Lean data for the admin dashboard home (admin only). */
  @Roles('ADMIN')
  @Get('dashboard')
  dashboard() {
    return this.analytics.dashboard();
  }

  /** Rich analytics for the Analytics page (admin only). `days` = trend window. */
  @Roles('ADMIN')
  @Get('insights')
  insights(@Query('days') days?: string) {
    return this.analytics.insights(Number(days ?? 30));
  }
}

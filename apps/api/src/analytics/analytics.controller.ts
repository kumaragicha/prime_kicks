import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Lean data for the admin dashboard home (admin only). `from`/`to` are
   * optional YYYY-MM-DD (IST) bounds; when omitted the dashboard reflects today.
   */
  @Roles('ADMIN')
  @Get('dashboard')
  dashboard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.dashboard(from, to);
  }

  /** Rich analytics for the Analytics page (admin only). `days` = trend window. */
  @Roles('ADMIN')
  @Get('insights')
  insights(@Query('days') days?: string) {
    return this.analytics.insights(Number(days ?? 30));
  }

  /** Current stock snapshot for the Inventory page (admin only). */
  @Roles('ADMIN')
  @Get('inventory')
  inventory() {
    return this.analytics.inventory();
  }
}

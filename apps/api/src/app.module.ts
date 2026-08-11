import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AddressModule } from './address/address.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CartModule } from './cart/cart.module';
import { CourierConfigModule } from './courier-config/courier-config.module';
import { CreditCustomersModule } from './credit-customers/credit-customers.module';
import { DimensionsModule } from './dimensions/dimensions.module';
import { HealthController } from './health/health.controller';
import { HeroModule } from './hero/hero.module';
import { MailModule } from './mail/mail.module';
import { MastersModule } from './masters/masters.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SettingsModule } from './settings/settings.module';
import { ShipmozoModule } from './shipmozo/shipmozo.module';
import { SizesModule } from './sizes/sizes.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditLogModule,
    MailModule,
    StorageModule,
    AuthModule,
    ProductsModule,
    UsersModule,
    SizesModule,
    MastersModule,
    DimensionsModule,
    CreditCustomersModule,
    SettingsModule,
    ShipmozoModule,
    CourierConfigModule,
    CartModule,
    OrdersModule,
    UploadsModule,
    AddressModule,
    AnalyticsModule,
    HeroModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then check roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

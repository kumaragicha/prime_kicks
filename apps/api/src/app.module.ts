import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AddressModule } from './address/address.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CartModule } from './cart/cart.module';
import { HealthController } from './health/health.controller';
import { MastersModule } from './masters/masters.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SizesModule } from './sizes/sizes.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    ProductsModule,
    UsersModule,
    SizesModule,
    MastersModule,
    CartModule,
    OrdersModule,
    UploadsModule,
    AddressModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then check roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

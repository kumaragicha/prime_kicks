import { Module } from '@nestjs/common';
import { CreditCustomersController } from './credit-customers.controller';
import { CreditCustomersService } from './credit-customers.service';

@Module({
  controllers: [CreditCustomersController],
  providers: [CreditCustomersService],
  exports: [CreditCustomersService],
})
export class CreditCustomersModule {}

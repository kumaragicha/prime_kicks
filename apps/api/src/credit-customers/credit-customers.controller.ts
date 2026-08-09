import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createCreditCustomerSchema,
  creditCustomerQuerySchema,
  updateCreditCustomerSchema,
  type CreateCreditCustomerSchema,
  type CreditCustomerQuerySchema,
  type UpdateCreditCustomerSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CreditCustomersService } from './credit-customers.service';

@Roles('ADMIN')
@Controller('credit-customers')
export class CreditCustomersController {
  constructor(private readonly creditCustomers: CreditCustomersService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(creditCustomerQuerySchema)) query: CreditCustomerQuerySchema,
  ) {
    return this.creditCustomers.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creditCustomers.findOne(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createCreditCustomerSchema)) body: CreateCreditCustomerSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.creditCustomers.create(body, user.email);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCreditCustomerSchema)) body: UpdateCreditCustomerSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.creditCustomers.update(id, body, user.email);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.creditCustomers.remove(id, user.email);
  }
}

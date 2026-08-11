import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createCourierConfigSchema,
  updateCourierConfigSchema,
  type CreateCourierConfigSchema,
  type UpdateCourierConfigSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CourierConfigService } from './courier-config.service';

@Controller('courier-config')
export class CourierConfigController {
  constructor(private readonly courierConfig: CourierConfigService) {}

  @Roles('ADMIN')
  @Get()
  findAll() {
    return this.courierConfig.findAll();
  }

  @Roles('ADMIN')
  @Get('weight-slab/:weightSlab')
  findByWeightSlab(@Param('weightSlab') weightSlab: string) {
    return this.courierConfig.findByWeightSlab(weightSlab);
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courierConfig.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  create(
    @Body(new ZodValidationPipe(createCourierConfigSchema)) body: CreateCourierConfigSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courierConfig.create(body, user.email);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCourierConfigSchema)) body: UpdateCourierConfigSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courierConfig.update(id, body, user.email);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.courierConfig.remove(id, user.email);
  }
}

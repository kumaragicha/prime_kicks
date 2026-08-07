import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createDimensionSchema,
  updateDimensionSchema,
  type CreateDimensionSchema,
  type UpdateDimensionSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DimensionsService } from './dimensions.service';

@Controller('dimensions')
export class DimensionsController {
  constructor(private readonly dimensions: DimensionsService) {}

  @Public()
  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.dimensions.findAll(includeInactive === 'true');
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dimensions.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  create(
    @Body(new ZodValidationPipe(createDimensionSchema)) body: CreateDimensionSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dimensions.create(body, user.email);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDimensionSchema)) body: UpdateDimensionSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dimensions.update(id, body, user.email);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dimensions.remove(id, user.email);
  }
}

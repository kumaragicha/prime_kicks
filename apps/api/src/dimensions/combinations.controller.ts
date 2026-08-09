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
  createDimensionCombinationSchema,
  updateDimensionCombinationSchema,
  type CreateDimensionCombinationSchema,
  type UpdateDimensionCombinationSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CombinationsService } from './combinations.service';

@Controller('dimension-combinations')
export class CombinationsController {
  constructor(private readonly combinations: CombinationsService) {}

  @Public()
  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.combinations.findAll(includeInactive === 'true');
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.combinations.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  create(
    @Body(new ZodValidationPipe(createDimensionCombinationSchema))
    body: CreateDimensionCombinationSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.combinations.create(body, user.email);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDimensionCombinationSchema))
    body: UpdateDimensionCombinationSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.combinations.update(id, body, user.email);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.combinations.remove(id, user.email);
  }
}

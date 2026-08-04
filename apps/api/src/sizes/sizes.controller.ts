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
  createSizeSchema,
  createSizeTypeSchema,
  updateSizeSchema,
  updateSizeTypeSchema,
  type CreateSizeSchema,
  type CreateSizeTypeSchema,
  type UpdateSizeSchema,
  type UpdateSizeTypeSchema,
} from '@prime-kicks/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SizesService } from './sizes.service';

@Controller()
export class SizesController {
  constructor(private readonly sizes: SizesService) {}

  /* --------------------------------- Size types --------------------------------- */

  @Public()
  @Get('size-types')
  findAllTypes(@Query('includeInactive') includeInactive?: string) {
    return this.sizes.findAllTypes(includeInactive === 'true');
  }

  @Public()
  @Get('size-types/:id')
  findType(@Param('id') id: string) {
    return this.sizes.findType(id);
  }

  @Roles('ADMIN')
  @Post('size-types')
  createType(
    @Body(new ZodValidationPipe(createSizeTypeSchema)) body: CreateSizeTypeSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sizes.createType(body, user.email);
  }

  @Roles('ADMIN')
  @Patch('size-types/:id')
  updateType(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSizeTypeSchema)) body: UpdateSizeTypeSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sizes.updateType(id, body, user.email);
  }

  @Roles('ADMIN')
  @Delete('size-types/:id')
  removeType(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sizes.removeType(id, user.email);
  }

  /* ----------------------------------- Sizes ------------------------------------ */

  @Roles('ADMIN')
  @Post('size-types/:id/sizes')
  addSize(
    @Param('id') sizeTypeId: string,
    @Body(new ZodValidationPipe(createSizeSchema)) body: CreateSizeSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sizes.addSize(sizeTypeId, body, user.email);
  }

  @Roles('ADMIN')
  @Patch('sizes/:id')
  updateSize(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSizeSchema)) body: UpdateSizeSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sizes.updateSize(id, body, user.email);
  }

  @Roles('ADMIN')
  @Delete('sizes/:id')
  removeSize(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sizes.removeSize(id, user.email);
  }
}

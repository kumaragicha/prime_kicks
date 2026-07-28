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
  createType(@Body(new ZodValidationPipe(createSizeTypeSchema)) body: CreateSizeTypeSchema) {
    return this.sizes.createType(body);
  }

  @Roles('ADMIN')
  @Patch('size-types/:id')
  updateType(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSizeTypeSchema)) body: UpdateSizeTypeSchema,
  ) {
    return this.sizes.updateType(id, body);
  }

  @Roles('ADMIN')
  @Delete('size-types/:id')
  removeType(@Param('id') id: string) {
    return this.sizes.removeType(id);
  }

  /* ----------------------------------- Sizes ------------------------------------ */

  @Roles('ADMIN')
  @Post('size-types/:id/sizes')
  addSize(
    @Param('id') sizeTypeId: string,
    @Body(new ZodValidationPipe(createSizeSchema)) body: CreateSizeSchema,
  ) {
    return this.sizes.addSize(sizeTypeId, body);
  }

  @Roles('ADMIN')
  @Patch('sizes/:id')
  updateSize(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSizeSchema)) body: UpdateSizeSchema,
  ) {
    return this.sizes.updateSize(id, body);
  }

  @Roles('ADMIN')
  @Delete('sizes/:id')
  removeSize(@Param('id') id: string) {
    return this.sizes.removeSize(id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createProductSchema,
  productQuerySchema,
  updateProductSchema,
  type CreateProductSchema,
  type ProductQuerySchema,
  type UpdateProductSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(
    @Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuerySchema,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.products.findAll(query, user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.products.findOne(id, user);
  }

  /** Similar-products rail for a product page (public; priced by role). */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/similar')
  findSimilar(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.products.findSimilar(id, user);
  }

  @Roles('ADMIN', 'RESELLER')
  @Post()
  create(
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.create(body, user.email);
  }

  @Roles('ADMIN', 'RESELLER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.update(id, body, user.email);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.products.remove(id, user.email);
  }
}

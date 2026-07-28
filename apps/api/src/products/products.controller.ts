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
  createProductSchema,
  productQuerySchema,
  updateProductSchema,
  type CreateProductSchema,
  type ProductQuerySchema,
  type UpdateProductSchema,
} from '@prime-kicks/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  findAll(
    @Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuerySchema,
  ) {
    return this.products.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Roles('ADMIN', 'RESELLER')
  @Post()
  create(
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductSchema,
  ) {
    return this.products.create(body);
  }

  @Roles('ADMIN', 'RESELLER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductSchema,
  ) {
    return this.products.update(id, body);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}

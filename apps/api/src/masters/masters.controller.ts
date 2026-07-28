import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { MastersService } from './masters.service';

type BodyInput = { name?: string; isActive?: boolean };

@Controller()
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  @Public() @Get('filters') filters() { return this.masters.filters(); }

  @Public() @Get('brands') brands(@Query('includeInactive') inactive?: string) { return this.masters.list('brand', inactive === 'true'); }
  @Roles('ADMIN') @Post('brands') createBrand(@Body() body: BodyInput) { return this.masters.create('brand', body.name?.trim() ?? ''); }
  @Roles('ADMIN') @Patch('brands/:id') updateBrand(@Param('id') id: string, @Body() body: BodyInput) { return this.masters.update('brand', id, body); }
  @Roles('ADMIN') @Delete('brands/:id') deleteBrand(@Param('id') id: string) { return this.masters.remove('brand', id); }

  @Public() @Get('product-types') types(@Query('includeInactive') inactive?: string) { return this.masters.list('productType', inactive === 'true'); }
  @Roles('ADMIN') @Post('product-types') createType(@Body() body: BodyInput) { return this.masters.create('productType', body.name?.trim() ?? ''); }
  @Roles('ADMIN') @Patch('product-types/:id') updateType(@Param('id') id: string, @Body() body: BodyInput) { return this.masters.update('productType', id, body); }
  @Roles('ADMIN') @Delete('product-types/:id') deleteType(@Param('id') id: string) { return this.masters.remove('productType', id); }

  @Public() @Get('categories') categories(@Query('includeInactive') inactive?: string) { return this.masters.list('category', inactive === 'true'); }
  @Roles('ADMIN') @Post('categories') createCategory(@Body() body: BodyInput) { return this.masters.create('category', body.name?.trim() ?? ''); }
  @Roles('ADMIN') @Patch('categories/:id') updateCategory(@Param('id') id: string, @Body() body: BodyInput) { return this.masters.update('category', id, body); }
  @Roles('ADMIN') @Delete('categories/:id') deleteCategory(@Param('id') id: string) { return this.masters.remove('category', id); }
}

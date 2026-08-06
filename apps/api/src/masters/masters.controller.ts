import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { MastersService } from './masters.service';

type BodyInput = { name?: string; isActive?: boolean };

@Controller()
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  @Public() @Get('filters') filters() { return this.masters.filters(); }

  @Public() @Get('brands') brands(@Query('includeInactive') inactive?: string) { return this.masters.list('brand', inactive === 'true'); }
  @Roles('ADMIN') @Post('brands') createBrand(@Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.create('brand', body.name?.trim() ?? '', user.email); }
  @Roles('ADMIN') @Patch('brands/:id') updateBrand(@Param('id') id: string, @Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.update('brand', id, body, user.email); }
  @Roles('ADMIN') @Delete('brands/:id') deleteBrand(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.masters.remove('brand', id, user.email); }

  @Public() @Get('product-types') types(@Query('includeInactive') inactive?: string) { return this.masters.list('productType', inactive === 'true'); }
  @Roles('ADMIN') @Post('product-types') createType(@Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.create('productType', body.name?.trim() ?? '', user.email); }
  @Roles('ADMIN') @Patch('product-types/:id') updateType(@Param('id') id: string, @Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.update('productType', id, body, user.email); }
  @Roles('ADMIN') @Delete('product-types/:id') deleteType(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.masters.remove('productType', id, user.email); }

  @Public() @Get('categories') categories(@Query('includeInactive') inactive?: string) { return this.masters.list('category', inactive === 'true'); }
  @Roles('ADMIN') @Post('categories') createCategory(@Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.create('category', body.name?.trim() ?? '', user.email); }
  @Roles('ADMIN') @Patch('categories/:id') updateCategory(@Param('id') id: string, @Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.update('category', id, body, user.email); }
  @Roles('ADMIN') @Delete('categories/:id') deleteCategory(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.masters.remove('category', id, user.email); }

  @Public() @Get('tags') tags(@Query('includeInactive') inactive?: string) { return this.masters.list('tag', inactive === 'true'); }
  @Roles('ADMIN') @Post('tags') createTag(@Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.create('tag', body.name?.trim() ?? '', user.email); }
  @Roles('ADMIN') @Patch('tags/:id') updateTag(@Param('id') id: string, @Body() body: BodyInput, @CurrentUser() user: AuthenticatedUser) { return this.masters.update('tag', id, body, user.email); }
  @Roles('ADMIN') @Delete('tags/:id') deleteTag(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.masters.remove('tag', id, user.email); }
}

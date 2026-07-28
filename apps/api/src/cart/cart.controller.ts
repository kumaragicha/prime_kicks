import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get() get(@CurrentUser() user: AuthenticatedUser) { return this.cart.get(user.id); }
  @Post('items') add(@CurrentUser() user: AuthenticatedUser, @Body() body: { productId: string; variantId: string; quantity?: number }) { return this.cart.add(user.id, body); }
  @Patch('items/:id') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: { quantity: number }) { return this.cart.update(user.id, id, body.quantity); }
  @Delete('items/:id') remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.cart.remove(user.id, id); }
}

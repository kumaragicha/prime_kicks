import { Body, Controller, Get, Put } from '@nestjs/common';
import type { HeroUpdateSchema } from '@prime-kicks/validation';
import { heroUpdateSchema } from '@prime-kicks/validation';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { HeroService } from './hero.service';

@Controller('hero')
export class HeroController {
  constructor(private readonly hero: HeroService) {}

  /** Active carousel slides for the storefront. */
  @Public()
  @Get()
  slides() {
    return this.hero.publicSlides();
  }

  /** Full slide list for the admin editor. */
  @Roles('ADMIN')
  @Get('admin')
  adminSlides() {
    return this.hero.allSlides();
  }

  /** Replace the carousel with a new ordered set (admin only). */
  @Roles('ADMIN')
  @Put()
  replace(@Body(new ZodValidationPipe(heroUpdateSchema)) body: HeroUpdateSchema) {
    return this.hero.replace(body);
  }
}

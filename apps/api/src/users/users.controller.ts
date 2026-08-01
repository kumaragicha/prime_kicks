import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { userQuerySchema, type UserQuerySchema } from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll(@Query(new ZodValidationPipe(userQuerySchema)) query: UserQuerySchema) {
    return this.users.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id/disable')
  disable(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.setActive(id, false, actor.id);
  }

  @Patch(':id/enable')
  enable(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.setActive(id, true, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.remove(id, actor.id);
  }
}

import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { userQuerySchema, type UserQuerySchema } from '@prime-kicks/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
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
  disable(@Param('id') id: string) {
    return this.users.setActive(id, false);
  }

  @Patch(':id/enable')
  enable(@Param('id') id: string) {
    return this.users.setActive(id, true);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}

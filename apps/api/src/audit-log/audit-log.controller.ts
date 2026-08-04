import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditLogService } from './audit-log.service';
import { listAuditLogsSchema, type ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Roles('ADMIN')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listAuditLogsSchema)) query: ListAuditLogsDto) {
    return this.auditLog.list(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.auditLog.findById(id);
  }
}

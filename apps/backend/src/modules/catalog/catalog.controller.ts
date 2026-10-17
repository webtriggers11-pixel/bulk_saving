import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { ServiceDto } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { CatalogQueryDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

/**
 * Resident-facing catalog (FEAT-002). `GET /catalog` returns the services
 * available to the CALLER'S society. Tenant scope comes only from the verified
 * auth context (`ctx.societyId`), never from the request (ADR-0003).
 */
@Controller('catalog')
@UseGuards(AccessTokenGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@CurrentAuth() ctx: AuthContext, @Query() query: CatalogQueryDto): Promise<ServiceDto[]> {
    // The query can narrow the list; it can never name a society (ADR-0003).
    return this.catalog.listForSociety(ctx.societyId, query);
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogAdminController } from './catalog-admin.controller';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/**
 * Catalog domain (FEAT-002, ADR-0009): the resident-facing `GET /catalog` read
 * and the super-admin master-service + per-society-offering management API.
 * Imports AuthModule for the shared access-token + roles guards.
 */
@Module({
  imports: [AuthModule],
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogService, CatalogAdminService],
  exports: [CatalogService, CatalogAdminService],
})
export class CatalogModule {}

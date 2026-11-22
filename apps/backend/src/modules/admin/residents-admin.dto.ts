import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { MAX_SEARCH, Role, type AdminResidentsQuery, type UpdateResidentBody } from '@bulk/shared';
import { PageQueryDto } from '../../common/pagination';

const ROLES = [Role.RESIDENT, Role.SUPER_ADMIN] as const;
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** `GET /admin/residents` (FEAT-033, ADR-0044). */
export class AdminResidentsQueryDto extends PageQueryDto implements AdminResidentsQuery {
  @IsOptional()
  @IsString()
  @Length(0, MAX_SEARCH)
  q?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  societyId?: string;

  @IsOptional()
  @IsIn(ROLES, { message: `role must be one of: ${ROLES.join(', ')}.` })
  role?: Role;
}

/** `PATCH /admin/residents/:id`: a name (null clears it) and/or a role. */
export class UpdateResidentDto implements UpdateResidentBody {
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name?: string | null;

  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(ROLES, { message: `role must be one of: ${ROLES.join(', ')}.` })
  role?: Role;
}

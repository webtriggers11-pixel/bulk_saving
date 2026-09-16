import { SetMetadata } from '@nestjs/common';
import type { Role } from '@bulk/shared';

export const ROLES_KEY = 'roles';

/** Restrict a route to one or more roles; enforced by {@link RolesGuard}. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

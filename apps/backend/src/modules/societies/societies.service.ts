import { Injectable } from '@nestjs/common';
import type { Society } from '@prisma/client';
import type { AdminSocietyDto } from '@bulk/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** Read access to societies. Tenant binding is resolved here from invite codes. */
@Injectable()
export class SocietiesService {
  constructor(private readonly prisma: PrismaService) {}

  findByInviteCode(inviteCode: string): Promise<Society | null> {
    return this.prisma.society.findUnique({ where: { inviteCode } });
  }

  findById(id: string): Promise<Society | null> {
    return this.prisma.society.findUnique({ where: { id } });
  }

  /**
   * Every society, ordered by name, for the super-admin (FEAT-005). This is the
   * explicit cross-tenant read: only the SUPER_ADMIN-guarded admin route calls it.
   */
  listAll(): Promise<AdminSocietyDto[]> {
    return this.prisma.society.findMany({
      select: { id: true, name: true, city: true, inviteCode: true },
      orderBy: { name: 'asc' },
    });
  }
}

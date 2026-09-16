import { Injectable } from '@nestjs/common';
import type { Society } from '@prisma/client';
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
}

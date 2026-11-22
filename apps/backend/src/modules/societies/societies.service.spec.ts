import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { SocietiesService } from './societies.service';

const known = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });
const row = { id: 's1', name: 'S', city: 'C', inviteCode: 'AB23CD45', createdAt: new Date(0), updatedAt: new Date(0), _count: { residents: 0, rounds: 0 } };

/** V2 P3 (FEAT-032): concurrency races answer 404/409, never a 500. */
describe('SocietiesService — race outcomes', () => {
  it('a society deleted between read and write: update and rotate answer 404', async () => {
    const prisma = {
      society: { findUnique: jest.fn().mockResolvedValue(row), update: jest.fn().mockRejectedValue(known('P2025')) },
    } as unknown as PrismaService;
    const service = new SocietiesService(prisma);
    await expect(service.update('s1', { name: 'New' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.rotateInviteCode('s1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a serialization failure while deleting answers 409', async () => {
    const prisma = { $transaction: jest.fn().mockRejectedValue(known('P2034')) } as unknown as PrismaService;
    await expect(new SocietiesService(prisma).remove('s1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('a code clash on rotate is retried with a fresh code', async () => {
    const update = jest.fn().mockRejectedValueOnce(known('P2002')).mockResolvedValue(row);
    const prisma = { society: { findUnique: jest.fn().mockResolvedValue(row), update } } as unknown as PrismaService;
    await expect(new SocietiesService(prisma).rotateInviteCode('s1')).resolves.toMatchObject({ id: 's1' });
    expect(update).toHaveBeenCalledTimes(2);
  });
});

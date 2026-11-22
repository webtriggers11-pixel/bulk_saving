import { ConflictException } from '@nestjs/common';
import type { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { ResidentsAdminService } from './residents-admin.service';

/** The last-admin guard (ADR-0044 §3): untestable against the shared DB, which always holds seeded admins. */
describe('ResidentsAdminService — last admin (FEAT-033)', () => {
  function serviceWith(admins: number) {
    const lone = { id: 'r_admin', role: 'SUPER_ADMIN', societyId: 's', _count: { roundParticipations: 0 } };
    const tx = {
      resident: {
        findUnique: jest.fn().mockResolvedValue(lone),
        count: jest.fn().mockResolvedValue(admins),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
    const auth = { revokeAllSessions: jest.fn() } as unknown as AuthService;
    return { service: new ResidentsAdminService(prisma, auth), tx, auth };
  }

  it('refuses to demote the last admin', async () => {
    const { service, tx } = serviceWith(1);
    await expect(service.update('someone_else', 'r_admin', { role: 'RESIDENT' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.resident.update).not.toHaveBeenCalled();
  });

  it('refuses to remove the last admin, and leaves their sessions alone', async () => {
    const { service, tx, auth } = serviceWith(1);
    await expect(service.remove('someone_else', 'r_admin')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.resident.delete).not.toHaveBeenCalled();
    expect(auth.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('with a second admin, the demotion goes through', async () => {
    const { service, tx } = serviceWith(2);
    tx.resident.update.mockResolvedValue({
      id: 'r_admin', name: null, phone: '+919999900001', role: 'RESIDENT', verifiedAt: null, createdAt: new Date(0),
      society: { id: 's', name: 'S' }, _count: { roundParticipations: 0 },
    });
    await expect(service.update('someone_else', 'r_admin', { role: 'RESIDENT' })).resolves.toMatchObject({ role: 'RESIDENT' });
  });
});

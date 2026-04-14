import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('AuthService', () => {
  const tempRoot = path.join(os.tmpdir(), 'fortune-ai-auth-test');
  const databasePath = path.join(tempRoot, 'fortune_ai_auth.db');

  beforeEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.mkdir(tempRoot, { recursive: true });
    process.env.FORTUNE_DATABASE_PATH = databasePath;
    jest.resetModules();
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    delete process.env.FORTUNE_DATABASE_PATH;
  });

  it('creates, resolves and clears an auth session', async () => {
    const { UserRepository } = await import('@/models/repositories/userRepository');
    const { hashPassword } = await import('@/lib/passwords');
    const { AuthService } = await import('@/services/auth/authService');

    const userRepository = new UserRepository();
    const authService = new AuthService();
    const now = new Date().toISOString();
    const user = await userRepository.create({
      id: 'user_auth_1',
      contactType: 'email',
      contactValue: 'auth-user@example.com',
      passwordHash: hashPassword('secret12'),
      displayName: '星河',
      consultationCredits: 5,
      membershipPlan: 'monthly_membership',
      membershipExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now
    });

    const session = await authService.authenticate({
      contactType: 'email',
      contactValue: user.contactValue,
      password: 'secret12'
    });

    expect(session.user.id).toBe(user.id);
    expect(session.user.consultationCredits).toBe(5);

    const resolvedUser = await authService.getAuthenticatedUserByToken(session.sessionToken);
    expect(resolvedUser?.id).toBe(user.id);

    await authService.clearSession(session.sessionToken);
    const clearedUser = await authService.getAuthenticatedUserByToken(session.sessionToken);
    expect(clearedUser).toBeNull();
  });

  it('auto-creates an account and logs in when the contact is not registered yet', async () => {
    const { AuthService } = await import('@/services/auth/authService');

    const authService = new AuthService();
    const session = await authService.authenticate({
      contactType: 'email',
      contactValue: 'new-user@example.com',
      password: 'secret12'
    });

    expect(session.user.contactValue).toBe('new-user@example.com');
    expect(session.user.displayName).toBe('new-user');
  });

  it('asks for the correct password when the account is already registered', async () => {
    const { UserRepository } = await import('@/models/repositories/userRepository');
    const { hashPassword } = await import('@/lib/passwords');
    const { AuthService } = await import('@/services/auth/authService');

    const userRepository = new UserRepository();
    const authService = new AuthService();
    const now = new Date().toISOString();

    await userRepository.create({
      id: 'user_auth_2',
      contactType: 'phone',
      contactValue: '13800000000',
      passwordHash: hashPassword('secret12'),
      displayName: '已注册用户',
      consultationCredits: 0,
      membershipPlan: undefined,
      membershipExpiresAt: undefined,
      createdAt: now,
      updatedAt: now
    });

    await expect(
      authService.authenticate({
        contactType: 'phone',
        contactValue: '13800000000',
        password: 'wrong-pass'
      })
    ).rejects.toMatchObject({
      message: '该账号已经注册，请输入正确的密码。'
    });
  });
});

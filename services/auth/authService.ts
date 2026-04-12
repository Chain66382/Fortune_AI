import { createId } from '@/lib/ids';
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  buildSessionExpiry,
  createSessionToken,
  hashSessionToken
} from '@/lib/auth';
import { verifyPassword } from '@/lib/passwords';
import { SessionRepository } from '@/models/repositories/sessionRepository';
import { UserRepository } from '@/models/repositories/userRepository';
import { AppError } from '@/services/errors';
import type { AuthenticatedUser, LoginInput } from '@/types/auth';
import type { UserAccountRecord } from '@/types/consultation';

const normalizeLoginInput = (input: LoginInput): LoginInput => ({
  contactType: input.contactType,
  contactValue: input.contactValue.trim(),
  password: input.password.trim()
});

const toAuthenticatedUser = (user: UserAccountRecord): AuthenticatedUser => ({
  id: user.id,
  displayName: user.displayName,
  contactType: user.contactType,
  contactValue: user.contactValue,
  consultationCredits: user.consultationCredits,
  membershipPlan: user.membershipPlan,
  membershipExpiresAt: user.membershipExpiresAt
});

export class AuthService {
  private readonly userRepository = new UserRepository();
  private readonly sessionRepository = new SessionRepository();

  getSessionMaxAgeSeconds(): number {
    return AUTH_SESSION_MAX_AGE_SECONDS;
  }

  async getUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.userRepository.getById(id);
    return user ? toAuthenticatedUser(user) : null;
  }

  async getAuthenticatedUserByToken(token?: string): Promise<AuthenticatedUser | null> {
    if (!token) {
      return null;
    }

    const session = await this.sessionRepository.getByTokenHash(hashSessionToken(token));

    if (!session) {
      return null;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.sessionRepository.deleteByTokenHash(session.tokenHash);
      return null;
    }

    const user = await this.userRepository.getById(session.userId);

    if (!user) {
      await this.sessionRepository.deleteByTokenHash(session.tokenHash);
      return null;
    }

    return toAuthenticatedUser(user);
  }

  async authenticate(input: LoginInput): Promise<{
    user: AuthenticatedUser;
    sessionToken: string;
    expiresAt: string;
  }> {
    const normalizedInput = normalizeLoginInput(input);
    const user = await this.userRepository.getByContactValue(normalizedInput.contactValue);

    if (!user || user.contactType !== normalizedInput.contactType) {
      throw new AppError('Account not found.', 404);
    }

    if (!verifyPassword(normalizedInput.password, user.passwordHash)) {
      throw new AppError('Incorrect password.', 401);
    }

    return this.createSessionForUser(user.id);
  }

  async createSessionForUser(userId: string): Promise<{
    user: AuthenticatedUser;
    sessionToken: string;
    expiresAt: string;
  }> {
    const user = await this.userRepository.getById(userId);

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const sessionToken = createSessionToken();
    const expiresAt = buildSessionExpiry();

    await this.sessionRepository.create({
      id: createId('session'),
      userId,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
      createdAt: new Date().toISOString()
    });

    return {
      user: toAuthenticatedUser(user),
      sessionToken,
      expiresAt
    };
  }

  async clearSession(token?: string): Promise<void> {
    if (!token) {
      return;
    }

    await this.sessionRepository.deleteByTokenHash(hashSessionToken(token));
  }
}

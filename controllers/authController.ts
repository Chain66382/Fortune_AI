import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import { AuthService } from '@/services/auth/authService';
import type { AuthenticatedUser } from '@/types/auth';

const authService = new AuthService();

const setAuthCookie = async (sessionToken: string, expiresAt: string) => {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
    maxAge: authService.getSessionMaxAgeSeconds()
  });
};

const clearAuthCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
};

export const authController = {
  async getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    return authService.getAuthenticatedUserByToken(sessionToken);
  },

  async createSessionForUser(userId: string): Promise<AuthenticatedUser> {
    const session = await authService.createSessionForUser(userId);
    await setAuthCookie(session.sessionToken, session.expiresAt);
    return session.user;
  },

  async login(request: Request) {
    const body = await request.json();
    const session = await authService.authenticate(body);
    await setAuthCookie(session.sessionToken, session.expiresAt);
    return Response.json({ user: session.user }, { status: 201 });
  },

  async logout() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    await authService.clearSession(sessionToken);
    await clearAuthCookie();
    return Response.json({ ok: true });
  },

  async getCurrentUser() {
    const user = await this.getAuthenticatedUser();
    return Response.json({ user });
  }
};

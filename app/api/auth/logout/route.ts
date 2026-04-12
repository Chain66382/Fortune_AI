import { authController } from '@/controllers/authController';
import { handleRouteError } from '@/lib/http';

export async function POST() {
  try {
    return await authController.logout();
  } catch (error) {
    return handleRouteError(error);
  }
}

import { authController } from '@/controllers/authController';
import { handleRouteError } from '@/lib/http';

export async function GET() {
  try {
    return await authController.getCurrentUser();
  } catch (error) {
    return handleRouteError(error);
  }
}

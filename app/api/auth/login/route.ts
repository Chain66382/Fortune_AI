import { authController } from '@/controllers/authController';
import { handleRouteError } from '@/lib/http';

export async function POST(request: Request) {
  try {
    return await authController.login(request);
  } catch (error) {
    return handleRouteError(error);
  }
}

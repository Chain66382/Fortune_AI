import { consultationController } from '@/controllers/consultationController';
import { handleRouteError } from '@/lib/http';

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    return await consultationController.updateProfile(request, id);
  } catch (error) {
    return handleRouteError(error);
  }
}

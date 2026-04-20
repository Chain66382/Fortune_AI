import { consultationController } from '@/controllers/consultationController';
import { handleRouteError } from '@/lib/http';

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    return await consultationController.attachAssets(request, id);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    return await consultationController.removeAsset(request, id);
  } catch (error) {
    return handleRouteError(error);
  }
}

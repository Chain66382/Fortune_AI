import { consultationController } from '@/controllers/consultationController';
import { handleRouteError } from '@/lib/http';

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    return await consultationController.listMessages(id);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    return await consultationController.createMessage(request, id);
  } catch (error) {
    return handleRouteError(error);
  }
}

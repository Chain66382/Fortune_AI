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
    return await consultationController.getReport(id);
  } catch (error) {
    return handleRouteError(error);
  }
}

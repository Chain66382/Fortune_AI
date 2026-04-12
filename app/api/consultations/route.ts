import { consultationController } from '@/controllers/consultationController';
import { handleRouteError } from '@/lib/http';

export async function POST(request: Request) {
  try {
    return await consultationController.createConsultation(request);
  } catch (error) {
    return handleRouteError(error);
  }
}

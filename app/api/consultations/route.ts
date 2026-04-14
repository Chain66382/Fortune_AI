import { consultationController } from '@/controllers/consultationController';
import { handleRouteError } from '@/lib/http';

export async function GET() {
  try {
    return await consultationController.getLatestConsultation();
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    return await consultationController.createConsultation(request);
  } catch (error) {
    return handleRouteError(error);
  }
}

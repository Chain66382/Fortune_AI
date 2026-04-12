import { AppError } from '@/services/errors';

export const handleRouteError = (error: unknown): Response => {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, details: error.details || null },
      { status: error.statusCode }
    );
  }

  console.error(error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
};

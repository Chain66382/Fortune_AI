import { authController } from '@/controllers/authController';
import { env } from '@/lib/env';
import { ConsultationService } from '@/services/consultation/consultationService';
import { AppError } from '@/services/errors';
import type { AnswerPayload, ConsultationStageEvent, ConsultationStreamEvent } from '@/types/consultation';

const consultationService = new ConsultationService();

const encoder = new TextEncoder();

const renderAnswerContent = (answer: AnswerPayload) =>
  [answer.summary, ...answer.details, ...answer.guidance].filter(Boolean).join('\n\n');

const splitAnswerIntoDeltas = (content: string) => {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return content ? [content] : [];
  }

  return paragraphs.map((paragraph, index) => `${index === 0 ? '' : '\n\n'}${paragraph}`);
};

const createStreamResponse = (
  runner: (send: (event: ConsultationStreamEvent) => void) => Promise<void>
) =>
  new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: ConsultationStreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          await runner(send);
          send({ type: 'done' });
        } catch (error) {
          if (error instanceof AppError) {
            send({
              type: 'error',
              error: error.message,
              details: error.details || null,
              status: error.statusCode
            });
          } else {
            console.error(error);
            send({
              type: 'error',
              error: 'Internal server error',
              status: 500
            });
          }
        } finally {
          controller.close();
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    }
  );

const shouldStream = (request: Request) => request.headers.get('x-fortune-stream') === '1';

export const consultationController = {
  async getLatestConsultation() {
    const authenticatedUser = await authController.getAuthenticatedUser();

    if (!authenticatedUser) {
      return Response.json({ consultation: null, messages: [] });
    }

    const payload = await consultationService.getLatestConsultationForUser(authenticatedUser.id);

    return Response.json(
      payload || {
        consultation: null,
        messages: []
      }
    );
  },

  async createConsultation(request: Request) {
    const authenticatedUser = await authController.getAuthenticatedUser();
    const body = await request.json();
    const consultation = await consultationService.createConsultation(body, authenticatedUser?.id);

    if (consultation.userId && consultation.userId !== authenticatedUser?.id) {
      await authController.createSessionForUser(consultation.userId);
    }

    return Response.json(consultation, { status: 201 });
  },

  async createPreview(request: Request, consultationId: string) {
    const body = await request.json();

    if (shouldStream(request)) {
      return createStreamResponse(async (send) => {
        const payload = await consultationService.generatePreviewStream(
          consultationId,
          body,
          async (stage: ConsultationStageEvent) => {
            send({
              type: 'stage',
              stage
            });
          }
        );

        send({
          type: 'answer',
          answer: payload.previewAnswer,
          paymentRequired: payload.paymentRequired,
          requiresRegistrationForPayment: payload.requiresRegistrationForPayment,
          freeTurnsRemaining: payload.freeTurnsRemaining,
          paid: payload.paid
        });

        for (const delta of splitAnswerIntoDeltas(renderAnswerContent(payload.previewAnswer))) {
          send({
            type: 'delta',
            delta
          });
        }
      });
    }

    const payload = await consultationService.generatePreview(consultationId, body);
    return Response.json(payload);
  },

  async updateProfile(request: Request, consultationId: string) {
    const body = await request.json();
    const payload = await consultationService.updateConsultationProfile(consultationId, body.profile);
    return Response.json(payload);
  },

  async createOrderIntent(request: Request, consultationId: string) {
    const body = await request.json();
    const payload = await consultationService.createOrderIntent(
      consultationId,
      body,
      env.demoUnlockAfterIntent
    );
    return Response.json(payload, { status: 201 });
  },

  async getReport(consultationId: string) {
    const payload = await consultationService.getReport(consultationId);
    return Response.json(payload);
  },

  async listMessages(consultationId: string) {
    const messages = await consultationService.getMessages(consultationId);
    return Response.json(messages);
  },

  async createMessage(request: Request, consultationId: string) {
    const body = await request.json();

    if (shouldStream(request)) {
      return createStreamResponse(async (send) => {
        const payload = await consultationService.createFollowUpMessageStream(
          consultationId,
          body,
          async (stage: ConsultationStageEvent) => {
            send({
              type: 'stage',
              stage
            });
          }
        );

        send({
          type: 'answer',
          answer: payload.answer,
          paymentRequired: payload.paymentRequired,
          requiresRegistrationForPayment: payload.requiresRegistrationForPayment,
          freeTurnsRemaining: payload.freeTurnsRemaining,
          paid: payload.paid
        });

        for (const delta of splitAnswerIntoDeltas(renderAnswerContent(payload.answer))) {
          send({
            type: 'delta',
            delta
          });
        }
      });
    }

    const payload = await consultationService.createFollowUpMessage(consultationId, body);
    return Response.json(payload, { status: 201 });
  },

  async checkoutConsultation(request: Request, consultationId: string) {
    const authenticatedUser = await authController.getAuthenticatedUser();
    const body = await request.json();
    const payload = await consultationService.checkoutConsultation(
      consultationId,
      body,
      authenticatedUser?.id
    );

    if (payload.userId && payload.userId !== authenticatedUser?.id) {
      await authController.createSessionForUser(payload.userId);
    }

    return Response.json(payload, { status: 201 });
  },

  async attachAssets(request: Request, consultationId: string) {
    const body = await request.json();
    const payload = await consultationService.attachAssets(consultationId, body);
    return Response.json(payload, { status: 201 });
  },

  async removeAsset(request: Request, consultationId: string) {
    const body = await request.json();
    const payload = await consultationService.removeAsset(consultationId, body.assetId);
    return Response.json(payload);
  }
};

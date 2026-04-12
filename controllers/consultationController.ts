import { authController } from '@/controllers/authController';
import { env } from '@/lib/env';
import { ConsultationService } from '@/services/consultation/consultationService';

const consultationService = new ConsultationService();

export const consultationController = {
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
  }
};

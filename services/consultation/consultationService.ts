import { createId } from '@/lib/ids';
import { getPaymentPlanConfig } from '@/lib/paymentPlans';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import { ConsultationRepository } from '@/models/repositories/consultationRepository';
import { MessageRepository } from '@/models/repositories/messageRepository';
import { OrderIntentRepository } from '@/models/repositories/orderIntentRepository';
import { PaymentRepository } from '@/models/repositories/paymentRepository';
import { UserRepository } from '@/models/repositories/userRepository';
import {
  validateAttachAssetsInput,
  validateChatInput,
  validateCheckoutInput,
  validateCreateConsultation,
  validateOrderIntentInput,
  validatePreviewInput,
  validateProfile
} from '@/services/consultation/validation';
import { AppError } from '@/services/errors';
import { KnowledgeService } from '@/services/knowledge/knowledgeService';
import { ReportService } from '@/services/report/reportService';
import type {
  AttachAssetsInput,
  ChatInput,
  CheckoutInput,
  ConsultationMessage,
  ConsultationRecord,
  ConsultationReplyPayload,
  ConsultationStageEvent,
  CreateConsultationInput,
  FocusArea,
  OrderIntentInput,
  PaymentRecord,
  PreviewConsultationInput,
  UserAccountRecord
} from '@/types/consultation';

const FREE_TURN_LIMIT = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface AccessState {
  user?: UserAccountRecord;
  hasPaidAccess: boolean;
  accessKind: 'none' | 'membership' | 'credits';
}

interface PreviewGenerationResult {
  consultationId: string;
  previewAnswer: ConsultationReplyPayload['answer'];
  lockedReportOutline?: ConsultationRecord['lockedReportOutline'];
  evidence: ConsultationMessage['evidence'];
  freeTurnsRemaining: number;
  paymentRequired: boolean;
  requiresRegistrationForPayment: boolean;
  paid: boolean;
}

const stageRetrievingDocs: ConsultationStageEvent = {
  key: 'retrieving_docs',
  label: '正在检索知识库'
};

const inferFocusArea = (question: string): FocusArea => {
  const normalizedQuestion = question.toLowerCase();

  if (/梦|梦见|噩梦/u.test(normalizedQuestion)) {
    return 'dream';
  }

  if (/风水|居住|办公|办公室|房间|卧室|客厅|工位|布局|朝向/u.test(normalizedQuestion)) {
    return 'feng_shui';
  }

  if (/感情|恋爱|婚姻|桃花|复合|对象/u.test(normalizedQuestion)) {
    return 'love';
  }

  if (/工作|事业|跳槽|晋升|合作|职场/u.test(normalizedQuestion)) {
    return 'career';
  }

  if (/财运|赚钱|收入|投资|财富/u.test(normalizedQuestion)) {
    return 'wealth';
  }

  if (/健康|睡眠|情绪|身体/u.test(normalizedQuestion)) {
    return 'health';
  }

  if (/流年|今年|明年|运势|阶段/u.test(normalizedQuestion)) {
    return 'fortune_cycle';
  }

  return 'overall';
};

const hasActiveMembership = (user?: UserAccountRecord): boolean => {
  if (!user?.membershipExpiresAt) {
    return false;
  }

  return new Date(user.membershipExpiresAt).getTime() > Date.now();
};

const buildQuestionFromImages = (images: ConsultationMessage['uploadedAssets'] = []) => {
  const categories = Array.from(new Set((images || []).map((image) => image.category)));

  if (categories.includes('space')) {
    return '请结合我刚上传的这一组空间图片，先做整体布局与风水方向的初步判断。';
  }

  if (categories.includes('face')) {
    return '请结合我刚上传的这一组面相图片，先做整体气色与状态方向的辅助判断。';
  }

  if (categories.includes('palm')) {
    return '请结合我刚上传的这一组手相图片，先做整体走势的辅助判断。';
  }

  return '请先根据我刚上传的图片资料做初步判断，并告诉我还需要补充什么。';
};

const resolveMessageText = (message?: string, images: ConsultationMessage['uploadedAssets'] = []) => {
  const normalizedMessage = message?.trim() || '';

  if (normalizedMessage) {
    return normalizedMessage;
  }

  return buildQuestionFromImages(images);
};

const validateMessagePayload = (
  message?: string,
  images: ConsultationMessage['uploadedAssets'] = []
) => {
  if (!message?.trim() && (!images || images.length === 0)) {
    throw new AppError('请输入问题或先上传图片后再发送。');
  }
};

export class ConsultationService {
  private readonly consultationRepository = new ConsultationRepository();
  private readonly messageRepository = new MessageRepository();
  private readonly orderIntentRepository = new OrderIntentRepository();
  private readonly userRepository = new UserRepository();
  private readonly paymentRepository = new PaymentRepository();
  private readonly knowledgeService = new KnowledgeService();
  private readonly reportService = new ReportService();

  private async resolveRegisteredUser(input: CreateConsultationInput) {
    if (input.savePreference !== 'save' || !input.registration) {
      return undefined;
    }

    const existingUser = await this.userRepository.getByContactValue(input.registration.contactValue);

    if (existingUser) {
      if (!verifyPassword(input.registration.password, existingUser.passwordHash)) {
        throw new AppError('该账号已经注册，请输入正确的密码。', 409);
      }

      await this.userRepository.updateDisplayName(existingUser.id, input.profile.displayName);
      return this.userRepository.getById(existingUser.id);
    }

    const now = new Date().toISOString();
    return this.userRepository.create({
      id: createId('user'),
      contactType: input.registration.contactType,
      contactValue: input.registration.contactValue,
      passwordHash: hashPassword(input.registration.password),
      displayName: input.profile.displayName,
      consultationCredits: 0,
      membershipPlan: undefined,
      membershipExpiresAt: undefined,
      createdAt: now,
      updatedAt: now
    });
  }

  private async getConsultationOrThrow(id: string): Promise<ConsultationRecord> {
    const consultation = await this.consultationRepository.getById(id);

    if (!consultation) {
      throw new AppError('Consultation not found.', 404);
    }

    return consultation;
  }

  private async getUserOrThrow(userId: string): Promise<UserAccountRecord> {
    const user = await this.userRepository.getById(userId);

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    return user;
  }

  private buildAccessState(user?: UserAccountRecord): AccessState {
    if (!user) {
      return {
        hasPaidAccess: false,
        accessKind: 'none'
      };
    }

    if (hasActiveMembership(user)) {
      return {
        user,
        hasPaidAccess: true,
        accessKind: 'membership'
      };
    }

    if (user.consultationCredits > 0) {
      return {
        user,
        hasPaidAccess: true,
        accessKind: 'credits'
      };
    }

    return {
      user,
      hasPaidAccess: false,
      accessKind: 'none'
    };
  }

  private async getAccessStateForUser(userId?: string): Promise<AccessState> {
    if (!userId) {
      return {
        hasPaidAccess: false,
        accessKind: 'none'
      };
    }

    const user = await this.userRepository.getById(userId);
    return this.buildAccessState(user);
  }

  private async consumeConsultationCredit(user: UserAccountRecord): Promise<void> {
    if (user.consultationCredits <= 0) {
      return;
    }

    await this.userRepository.updateAccessState(user.id, {
      consultationCredits: user.consultationCredits - 1,
      membershipPlan: user.membershipPlan,
      membershipExpiresAt: user.membershipExpiresAt
    });
  }

  private async applyPurchasedPlan(user: UserAccountRecord, planCode: CheckoutInput['paymentPlan']) {
    const paymentPlan = getPaymentPlanConfig(planCode || 'consultation_pack_1000');
    const nextCredits = user.consultationCredits + paymentPlan.consultationCreditsGranted;
    let nextMembershipPlan = user.membershipPlan;
    let nextMembershipExpiresAt = user.membershipExpiresAt;

    if (paymentPlan.membershipDays) {
      const existingExpiryTime =
        nextMembershipExpiresAt && new Date(nextMembershipExpiresAt).getTime() > Date.now()
          ? new Date(nextMembershipExpiresAt).getTime()
          : Date.now();
      nextMembershipExpiresAt = new Date(
        existingExpiryTime + paymentPlan.membershipDays * DAY_IN_MS
      ).toISOString();
      nextMembershipPlan = paymentPlan.code;
    }

    await this.userRepository.updateAccessState(user.id, {
      consultationCredits: nextCredits,
      membershipPlan: nextMembershipPlan,
      membershipExpiresAt: nextMembershipExpiresAt
    });

    return {
      paymentPlan,
      updatedUser: await this.getUserOrThrow(user.id),
      membershipExpiresAt: nextMembershipExpiresAt,
      consultationCreditsGranted: paymentPlan.consultationCreditsGranted
    };
  }

  private async resolveCheckoutUser(
    consultation: ConsultationRecord,
    input: CheckoutInput,
    authenticatedUserId?: string
  ): Promise<UserAccountRecord> {
    if (authenticatedUserId) {
      const authenticatedUser = await this.getUserOrThrow(authenticatedUserId);
      await this.userRepository.updateDisplayName(authenticatedUser.id, consultation.profile.displayName);
      return this.getUserOrThrow(authenticatedUser.id);
    }

    if (consultation.userId) {
      return this.getUserOrThrow(consultation.userId);
    }

    const validatedInput = validateCheckoutInput(input, true);
    const existingUser = await this.userRepository.getByContactValue(
      validatedInput.registration!.contactValue
    );

    if (existingUser) {
      if (!verifyPassword(validatedInput.registration!.password, existingUser.passwordHash)) {
        throw new AppError('该账号已经注册，请输入正确的密码。', 409);
      }

      await this.userRepository.updateDisplayName(existingUser.id, consultation.profile.displayName);
      return this.getUserOrThrow(existingUser.id);
    }

    const now = new Date().toISOString();
    return this.userRepository.create({
      id: createId('user'),
      contactType: validatedInput.registration!.contactType,
      contactValue: validatedInput.registration!.contactValue,
      passwordHash: hashPassword(validatedInput.registration!.password),
      displayName: consultation.profile.displayName,
      consultationCredits: 0,
      membershipPlan: undefined,
      membershipExpiresAt: undefined,
      createdAt: now,
      updatedAt: now
    });
  }

  async createConsultation(
    input: CreateConsultationInput,
    authenticatedUserId?: string
  ): Promise<ConsultationRecord> {
    const shouldBindToAuthenticatedUser = Boolean(authenticatedUserId && input.savePreference === 'save');
    const validatedInput = validateCreateConsultation(input, shouldBindToAuthenticatedUser);
    const authenticatedUser = shouldBindToAuthenticatedUser
      ? await this.getUserOrThrow(authenticatedUserId!)
      : undefined;
    const registeredUser = authenticatedUser || (await this.resolveRegisteredUser(validatedInput));

    if (registeredUser) {
      await this.userRepository.updateDisplayName(registeredUser.id, validatedInput.profile.displayName);
    }

    const now = new Date().toISOString();
    const record: ConsultationRecord = {
      id: createId('consultation'),
      userId: registeredUser?.id,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      savePreference: registeredUser ? 'save' : validatedInput.savePreference,
      unlocked: false,
      freeTurnsUsed: 0,
      profile: validatedInput.profile
    };

    return this.consultationRepository.create(record);
  }

  async updateConsultationProfile(id: string, profile: ConsultationRecord['profile']) {
    const consultation = await this.getConsultationOrThrow(id);
    const nextProfile = validateProfile(profile);
    const updatedAt = new Date().toISOString();

    await this.consultationRepository.upsert({
      ...consultation,
      updatedAt,
      profile: nextProfile
    });

    if (consultation.userId) {
      await this.userRepository.updateDisplayName(consultation.userId, nextProfile.displayName);
    }

    return {
      consultationId: consultation.id,
      profile: nextProfile,
      updatedAt
    };
  }

  private async buildPreviewResponse(
    id: string,
    input: PreviewConsultationInput,
    onStage?: (stage: ConsultationStageEvent) => void | Promise<void>
  ): Promise<PreviewGenerationResult> {
    const consultation = await this.getConsultationOrThrow(id);
    const validatedInput = validatePreviewInput(input);
    validateMessagePayload(validatedInput.question, validatedInput.images);
    const effectiveQuestion = resolveMessageText(validatedInput.question, validatedInput.images);
    console.debug('[consultation.preview] payload', {
      consultationId: id,
      question: validatedInput.question || '',
      images: validatedInput.images?.length || 0
    });
    const nextProfile = {
      ...consultation.profile,
      focusArea:
        consultation.profile.focusArea === 'overall'
          ? inferFocusArea(effectiveQuestion)
          : consultation.profile.focusArea,
      currentChallenge: consultation.profile.currentChallenge || effectiveQuestion
    };
    const consultationForAnswer: ConsultationRecord = {
      ...consultation,
      profile: nextProfile
    };

    await onStage?.(stageRetrievingDocs);
    const evidence = await this.knowledgeService.retrieveEvidence(nextProfile, effectiveQuestion);
    await onStage?.({
      ...stageRetrievingDocs,
      detail: `已命中 ${evidence.length} 条相关资料`
    });

    const previewAnswer = await this.reportService.createPreview(
      consultationForAnswer,
      effectiveQuestion,
      evidence,
      onStage,
      validatedInput.images || []
    );
    const accessState = await this.getAccessStateForUser(consultation.userId);
    const updatedConsultation: ConsultationRecord = {
      ...consultationForAnswer,
      updatedAt: new Date().toISOString(),
      status: accessState.hasPaidAccess ? 'paid' : 'preview_ready',
      freeTurnsUsed: 1,
      initialQuestion: effectiveQuestion,
      previewAnswer,
      lockedReportOutline: this.reportService.buildLockedOutlineForConsultation(consultation),
      lastEvidence: evidence
    };

    await this.consultationRepository.upsert(updatedConsultation);

    const userMessage: ConsultationMessage = {
      id: createId('message'),
      consultationId: consultation.id,
      role: 'user',
      content: validatedInput.question?.trim() || '',
      createdAt: updatedConsultation.updatedAt,
      evidence: [],
      uploadedAssets: validatedInput.images || []
    };
    const assistantMessage: ConsultationMessage = {
      id: createId('message'),
      consultationId: consultation.id,
      role: 'assistant',
      headline: previewAnswer.headline,
      content: [previewAnswer.summary, ...previewAnswer.details, ...previewAnswer.guidance].join('\n\n'),
      createdAt: updatedConsultation.updatedAt,
      evidence,
      debug: previewAnswer.debug
    };

    await this.messageRepository.create(userMessage);
    await this.messageRepository.create(assistantMessage);

    return {
      consultationId: consultation.id,
      previewAnswer,
      lockedReportOutline: updatedConsultation.lockedReportOutline,
      evidence,
      freeTurnsRemaining: FREE_TURN_LIMIT - updatedConsultation.freeTurnsUsed,
      paymentRequired: false,
      requiresRegistrationForPayment: !updatedConsultation.userId,
      paid: accessState.hasPaidAccess
    };
  }

  async generatePreview(id: string, input: PreviewConsultationInput) {
    return this.buildPreviewResponse(id, input);
  }

  async createOrderIntent(id: string, input: OrderIntentInput, demoUnlockAfterIntent: boolean) {
    const consultation = await this.getConsultationOrThrow(id);

    if (!consultation.previewAnswer || !consultation.initialQuestion) {
      throw new AppError('Generate a preview before creating an order intent.');
    }

    const validatedInput = validateOrderIntentInput(input);
    const now = new Date().toISOString();
    const orderIntent = await this.orderIntentRepository.create({
      id: createId('order'),
      consultationId: id,
      contactName: validatedInput.contactName,
      contactChannel: validatedInput.contactChannel,
      note: validatedInput.note,
      createdAt: now,
      unlockedAt: demoUnlockAfterIntent ? now : undefined
    });
    const evidence =
      consultation.lastEvidence ||
      (await this.knowledgeService.retrieveEvidence(consultation.profile, consultation.initialQuestion));
    const report = consultation.report
      ? consultation.report
      : demoUnlockAfterIntent
        ? await this.reportService.createFullReport(consultation, evidence)
        : undefined;

    const updatedConsultation: ConsultationRecord = {
      ...consultation,
      updatedAt: now,
      orderIntentId: orderIntent.id,
      unlocked: demoUnlockAfterIntent,
      status: demoUnlockAfterIntent ? 'report_ready' : consultation.status,
      report
    };

    await this.consultationRepository.upsert(updatedConsultation);

    return {
      orderIntentId: orderIntent.id,
      unlocked: updatedConsultation.unlocked,
      report: updatedConsultation.unlocked ? updatedConsultation.report : undefined
    };
  }

  async getReport(id: string) {
    const consultation = await this.getConsultationOrThrow(id);

    if (!consultation.previewAnswer) {
      throw new AppError('No report is available before preview generation.');
    }

    if (!consultation.unlocked) {
      return {
        unlocked: false,
        previewAnswer: consultation.previewAnswer,
        lockedReportOutline: consultation.lockedReportOutline || [],
        report: null
      };
    }

    let report = consultation.report;

    if (!report) {
      const evidence =
        consultation.lastEvidence ||
        (await this.knowledgeService.retrieveEvidence(consultation.profile, consultation.initialQuestion || ''));
      report = await this.reportService.createFullReport(consultation, evidence);
      await this.consultationRepository.upsert({
        ...consultation,
        updatedAt: new Date().toISOString(),
        report,
        status: 'report_ready'
      });
    }

    return {
      unlocked: true,
      previewAnswer: consultation.previewAnswer,
      lockedReportOutline: consultation.lockedReportOutline || [],
      report
    };
  }

  async getMessages(id: string): Promise<ConsultationMessage[]> {
    await this.getConsultationOrThrow(id);
    return this.messageRepository.findManyByConsultationId(id);
  }

  async getLatestConsultationForUser(userId: string) {
    const consultation = await this.consultationRepository.getLatestByUserId(userId);

    if (!consultation) {
      return null;
    }

    const messages = await this.messageRepository.findManyByConsultationId(consultation.id);

    return {
      consultation,
      messages
    };
  }

  async createFollowUpMessage(id: string, input: ChatInput): Promise<ConsultationReplyPayload> {
    return this.buildFollowUpResponse(id, input);
  }

  private async buildFollowUpResponse(
    id: string,
    input: ChatInput,
    onStage?: (stage: ConsultationStageEvent) => void | Promise<void>
  ): Promise<ConsultationReplyPayload> {
    const consultation = await this.getConsultationOrThrow(id);

    if (!consultation.previewAnswer) {
      throw new AppError('Start the conversation with your first question before sending follow-up messages.');
    }

    const accessState = await this.getAccessStateForUser(consultation.userId);

    if (!accessState.hasPaidAccess && consultation.freeTurnsUsed >= FREE_TURN_LIMIT) {
      throw new AppError('The free consultation is complete. Please continue with the paid consultation.', 402, {
        paymentRequired: true,
        requiresRegistrationForPayment: !consultation.userId,
        freeTurnsRemaining: 0
      });
    }

    const validatedInput = validateChatInput(input);
    validateMessagePayload(validatedInput.message, validatedInput.images);
    const effectiveMessage = resolveMessageText(validatedInput.message, validatedInput.images);
    console.debug('[consultation.chat] payload', {
      consultationId: id,
      message: validatedInput.message || '',
      images: validatedInput.images?.length || 0
    });
    await onStage?.(stageRetrievingDocs);
    const evidence = await this.knowledgeService.retrieveEvidence(consultation.profile, effectiveMessage);
    await onStage?.({
      ...stageRetrievingDocs,
      detail: `已命中 ${evidence.length} 条相关资料`
    });
    const answer = await this.reportService.createFollowUpAnswer(
      consultation,
      effectiveMessage,
      evidence,
      onStage,
      validatedInput.images || []
    );
    const now = new Date().toISOString();
    const hasConsumedAllFreeTurns = consultation.freeTurnsUsed >= FREE_TURN_LIMIT;
    const nextFreeTurnsUsed = hasConsumedAllFreeTurns
      ? consultation.freeTurnsUsed
      : consultation.freeTurnsUsed + 1;
    const userMessage: ConsultationMessage = {
      id: createId('message'),
      consultationId: id,
      role: 'user',
      content: validatedInput.message?.trim() || '',
      createdAt: now,
      evidence: [],
      uploadedAssets: validatedInput.images || []
    };
    const assistantMessage: ConsultationMessage = {
      id: createId('message'),
      consultationId: id,
      role: 'assistant',
      headline: answer.headline,
      content: [answer.summary, ...answer.details, ...answer.guidance].join('\n\n'),
      createdAt: now,
      evidence,
      debug: answer.debug
    };

    await this.messageRepository.create(userMessage);
    await this.messageRepository.create(assistantMessage);

    if (hasConsumedAllFreeTurns && accessState.accessKind === 'credits' && accessState.user) {
      await this.consumeConsultationCredit(accessState.user);
    }

    const nextAccessState = await this.getAccessStateForUser(consultation.userId);

    await this.consultationRepository.upsert({
      ...consultation,
      updatedAt: now,
      status:
        nextAccessState.hasPaidAccess || consultation.paidAt
          ? 'paid'
          : nextFreeTurnsUsed >= FREE_TURN_LIMIT
            ? 'payment_required'
            : consultation.status,
      freeTurnsUsed: nextFreeTurnsUsed,
      paidAt:
        consultation.paidAt ||
        (accessState.hasPaidAccess || nextAccessState.hasPaidAccess ? now : consultation.paidAt),
      unlocked: consultation.unlocked || accessState.hasPaidAccess || nextAccessState.hasPaidAccess,
      lastEvidence: evidence
    });

    return {
      answer,
      message: assistantMessage,
      paymentRequired: !nextAccessState.hasPaidAccess && nextFreeTurnsUsed >= FREE_TURN_LIMIT,
      requiresRegistrationForPayment: !consultation.userId,
      freeTurnsRemaining: nextAccessState.hasPaidAccess
        ? 0
        : Math.max(0, FREE_TURN_LIMIT - nextFreeTurnsUsed),
      paid: nextAccessState.hasPaidAccess
    };
  }

  async generatePreviewStream(
    id: string,
    input: PreviewConsultationInput,
    onStage?: (stage: ConsultationStageEvent) => void | Promise<void>
  ) {
    return this.buildPreviewResponse(id, input, onStage);
  }

  async createFollowUpMessageStream(
    id: string,
    input: ChatInput,
    onStage?: (stage: ConsultationStageEvent) => void | Promise<void>
  ) {
    return this.buildFollowUpResponse(id, input, onStage);
  }

  async attachAssets(id: string, input: AttachAssetsInput) {
    const consultation = await this.getConsultationOrThrow(id);
    const validatedInput = validateAttachAssetsInput(input);
    const existingAssetIds = new Set(consultation.profile.uploadedAssets.map((asset) => asset.id));
    const nextAssets = [
      ...consultation.profile.uploadedAssets,
      ...validatedInput.uploadedAssets.filter((asset) => !existingAssetIds.has(asset.id))
    ];
    const updatedConsultation: ConsultationRecord = {
      ...consultation,
      updatedAt: new Date().toISOString(),
      profile: {
        ...consultation.profile,
        uploadedAssets: nextAssets
      }
    };

    await this.consultationRepository.upsert(updatedConsultation);

    return {
      consultationId: id,
      uploadedAssets: nextAssets
    };
  }

  async removeAsset(id: string, assetId: string) {
    const consultation = await this.getConsultationOrThrow(id);
    const nextAssets = consultation.profile.uploadedAssets.filter((asset) => asset.id !== assetId);

    await this.consultationRepository.upsert({
      ...consultation,
      updatedAt: new Date().toISOString(),
      profile: {
        ...consultation.profile,
        uploadedAssets: nextAssets
      }
    });

    return {
      consultationId: id,
      uploadedAssets: nextAssets
    };
  }

  async checkoutConsultation(id: string, input: CheckoutInput, authenticatedUserId?: string) {
    const consultation = await this.getConsultationOrThrow(id);
    const requiresRegistration = !consultation.userId && !authenticatedUserId;
    const validatedInput = validateCheckoutInput(input, requiresRegistration);
    const user = await this.resolveCheckoutUser(consultation, validatedInput, authenticatedUserId);
    const paidAt = new Date().toISOString();
    const { paymentPlan, updatedUser, membershipExpiresAt, consultationCreditsGranted } =
      await this.applyPurchasedPlan(user, validatedInput.paymentPlan);
    const payment: PaymentRecord = {
      id: createId('payment'),
      consultationId: consultation.id,
      userId: updatedUser.id,
      amountCents: paymentPlan.amountCents,
      currency: paymentPlan.currency,
      paymentMethod: validatedInput.paymentMethod || 'usdt',
      planCode: paymentPlan.code,
      planName: paymentPlan.label,
      consultationCreditsGranted,
      membershipExpiresAt,
      status: 'paid',
      createdAt: paidAt,
      paidAt
    };

    await this.paymentRepository.create(payment);
    await this.consultationRepository.upsert({
      ...consultation,
      userId: updatedUser.id,
      savePreference: 'save',
      updatedAt: paidAt,
      paidAt,
      unlocked: true,
      status: 'paid'
    });

    return {
      paid: true,
      requiresRegistrationForPayment: false,
      userId: updatedUser.id,
      payment
    };
  }
}

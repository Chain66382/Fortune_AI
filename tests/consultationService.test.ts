import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('ConsultationService', () => {
  const tempRoot = path.join(os.tmpdir(), 'fortune-ai-flow-test');
  const dataDirectory = path.join(tempRoot, 'data');
  const knowledgeDirectory = path.join(tempRoot, 'knowledge');
  const databasePath = path.join(tempRoot, 'fortune_ai.db');
  const ragIndexPath = path.join(tempRoot, 'rag-index.json');

  beforeEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.mkdir(dataDirectory, { recursive: true });
    await fs.mkdir(knowledgeDirectory, { recursive: true });

    await fs.writeFile(
      path.join(knowledgeDirectory, 'career-guide.json'),
      JSON.stringify(
        {
          id: 'career-guide',
          sourceFile: '周易六十四卦全解.pdf',
          sourceType: 'knowledge_file',
          documentTitle: '周易六十四卦全解',
          overallThemes: ['事业'],
          sections: [
            {
              sectionTitle: '蓄势待发',
              topicTags: ['事业', '时机', '观察'],
              pageHint: '约第18页',
              content: '事业推进阻滞时，先蓄势而不是硬冲，等待时机成熟再发力更稳。'
            }
          ]
        },
        null,
        2
      ),
      'utf8'
    );

    process.env.FORTUNE_DATA_DIR = dataDirectory;
    process.env.FORTUNE_KNOWLEDGE_DIR = knowledgeDirectory;
    process.env.FORTUNE_DATABASE_PATH = databasePath;
    process.env.FORTUNE_RAG_INDEX_PATH = ragIndexPath;
    delete process.env.GEMINI_API_KEY;
    jest.resetModules();
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    delete process.env.FORTUNE_DATA_DIR;
    delete process.env.FORTUNE_KNOWLEDGE_DIR;
    delete process.env.FORTUNE_DATABASE_PATH;
    delete process.env.FORTUNE_RAG_INDEX_PATH;
  });

  it('runs the preview -> direct follow-up flow', async () => {
    const { ConsultationService } = await import('@/services/consultation/consultationService');
    const service = new ConsultationService();

    const consultation = await service.createConsultation({
      savePreference: 'do_not_save',
      profile: {
        displayName: '霁月',
        gender: 'female',
        birthDate: '1996-10-21',
        birthCalendarType: 'solar',
        birthTime: '09:18',
        birthLocation: '苏州',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    const preview = await service.generatePreview(consultation.id, {
      question: '我今年适合主动换工作吗？'
    });
    expect(preview.previewAnswer.summary).toContain('我今年适合主动换工作吗');

    const followUp = await service.createFollowUpMessage(consultation.id, {
      message: '如果我不立刻跳槽，应该先做什么准备？'
    });
    expect(followUp.answer.guidance.length).toBeGreaterThanOrEqual(2);
  });

  it('asks for photo materials before handling face reading requests', async () => {
    const { ConsultationService } = await import('@/services/consultation/consultationService');
    const service = new ConsultationService();

    const consultation = await service.createConsultation({
      savePreference: 'do_not_save',
      profile: {
        displayName: '清让',
        gender: 'male',
        birthDate: '1995-01-10',
        birthCalendarType: 'solar',
        birthTime: '',
        birthLocation: '',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    const preview = await service.generatePreview(consultation.id, {
      question: '你能帮我看看面相吗？'
    });

    expect(preview.previewAnswer.headline).toContain('面相');
    expect(preview.previewAnswer.details[0]).toContain('正脸');
  });

  it('registers upfront when the user chooses to save records and completes checkout for guests', async () => {
    const { ConsultationService } = await import('@/services/consultation/consultationService');
    const { UserRepository } = await import('@/models/repositories/userRepository');
    const service = new ConsultationService();
    const userRepository = new UserRepository();

    const savedConsultation = await service.createConsultation({
      savePreference: 'save',
      registration: {
        contactType: 'email',
        contactValue: 'saved-user@example.com',
        password: 'secret12'
      },
      profile: {
        displayName: '望舒',
        gender: 'female',
        birthDate: '1992-06-03',
        birthCalendarType: 'solar',
        birthTime: '',
        birthLocation: '',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    expect(savedConsultation.userId).toBeTruthy();

    const guestConsultation = await service.createConsultation({
      savePreference: 'do_not_save',
      profile: {
        displayName: '临川',
        gender: 'male',
        birthDate: '1991-04-09',
        birthCalendarType: 'solar',
        birthTime: '',
        birthLocation: '',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    await service.generatePreview(guestConsultation.id, {
      question: '这段时间我的事业会不会有新的机会？'
    });
    await service.createFollowUpMessage(guestConsultation.id, {
      message: '如果我继续等，会不会错过时机？'
    });
    const thirdReply = await service.createFollowUpMessage(guestConsultation.id, {
      message: '那我现在最该先做哪一步？'
    });

    expect(thirdReply.paymentRequired).toBe(true);

    const checkout = await service.checkoutConsultation(guestConsultation.id, {
      paymentPlan: 'consultation_pack_1000',
      registration: {
        contactType: 'phone',
        contactValue: '13800000000',
        password: 'secret12'
      }
    });

    expect(checkout.paid).toBe(true);
    expect(checkout.payment.paymentMethod).toBe('usdt');
    expect(checkout.payment.planCode).toBe('consultation_pack_1000');
    expect(checkout.payment.amountCents).toBe(200);
    const userAfterCheckout = await userRepository.getById(checkout.userId);
    expect(userAfterCheckout?.consultationCredits).toBe(1000);
    const paidReply = await service.createFollowUpMessage(guestConsultation.id, {
      message: '付费后我接下来应该怎么定节奏？'
    });
    expect(paidReply.paid).toBe(true);
    expect(paidReply.paymentRequired).toBe(false);
    const userAfterReply = await userRepository.getById(checkout.userId);
    expect(userAfterReply?.consultationCredits).toBe(999);
  });

  it('updates the saved consultation profile after the conversation has started', async () => {
    const { ConsultationService } = await import('@/services/consultation/consultationService');
    const { ConsultationRepository } = await import('@/models/repositories/consultationRepository');
    const service = new ConsultationService();
    const consultationRepository = new ConsultationRepository();

    const consultation = await service.createConsultation({
      savePreference: 'do_not_save',
      profile: {
        displayName: '初雪',
        gender: 'female',
        birthDate: '1994-08-12',
        birthCalendarType: 'solar',
        birthTime: '',
        birthLocation: '南京',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    const updatedProfile = {
      ...consultation.profile,
      displayName: '晚风',
      birthLocation: '杭州'
    };

    const updated = await service.updateConsultationProfile(consultation.id, updatedProfile);
    const stored = await consultationRepository.getById(consultation.id);

    expect(updated.profile.displayName).toBe('晚风');
    expect(updated.profile.birthLocation).toBe('杭州');
    expect(stored?.profile.displayName).toBe('晚风');
    expect(stored?.profile.birthLocation).toBe('杭州');
  });

  it('restores the latest saved consultation and message history for a logged-in user', async () => {
    const { ConsultationService } = await import('@/services/consultation/consultationService');
    const service = new ConsultationService();

    const consultation = await service.createConsultation(
      {
        savePreference: 'save',
        profile: {
          displayName: '望舒',
          gender: 'female',
          birthDate: '1992-06-03',
          birthCalendarType: 'solar',
          birthTime: '',
          birthLocation: '杭州',
          currentCity: '上海',
          focusArea: 'overall',
          currentChallenge: '最近想确认下一步方向。',
          dreamContext: '',
          fengShuiContext: '',
          uploadedAssets: []
        }
      },
      'missing-user'
    ).catch(async () => {
      return service.createConsultation({
        savePreference: 'save',
        registration: {
          contactType: 'email',
          contactValue: 'restore-user@example.com',
          password: 'secret12'
        },
        profile: {
          displayName: '望舒',
          gender: 'female',
          birthDate: '1992-06-03',
          birthCalendarType: 'solar',
          birthTime: '',
          birthLocation: '杭州',
          currentCity: '上海',
          focusArea: 'overall',
          currentChallenge: '最近想确认下一步方向。',
          dreamContext: '',
          fengShuiContext: '',
          uploadedAssets: []
        }
      });
    });

    await service.generatePreview(consultation.id, {
      question: '我接下来应该先稳住还是主动推进？'
    });

    const restored = await service.getLatestConsultationForUser(consultation.userId!);

    expect(restored?.consultation.id).toBe(consultation.id);
    expect(restored?.consultation.profile.displayName).toBe('望舒');
    expect(restored?.messages.some((message) => message.role === 'user')).toBe(true);
    expect(restored?.messages.some((message) => message.role === 'assistant')).toBe(true);
  });

  it('blocks duplicate contact registration and asks the user to log in with a password', async () => {
    const { ConsultationService } = await import('@/services/consultation/consultationService');
    const service = new ConsultationService();

    await service.createConsultation({
      savePreference: 'save',
      registration: {
        contactType: 'email',
        contactValue: 'existing-user@example.com',
        password: 'secret12'
      },
      profile: {
        displayName: '青岚',
        gender: 'female',
        birthDate: '1993-07-18',
        birthCalendarType: 'solar',
        birthTime: '',
        birthLocation: '',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    await expect(
      service.createConsultation({
        savePreference: 'save',
        registration: {
          contactType: 'email',
          contactValue: 'existing-user@example.com',
          password: 'wrong-pass'
        },
        profile: {
          displayName: '青岚',
          gender: 'female',
          birthDate: '1993-07-18',
          birthCalendarType: 'solar',
          birthTime: '',
          birthLocation: '',
          currentCity: '',
          focusArea: 'overall',
          currentChallenge: '',
          dreamContext: '',
          fengShuiContext: '',
          uploadedAssets: []
        }
      })
    ).rejects.toMatchObject({
      message: '该账号已经注册，请输入正确的密码。'
    });
  });
});

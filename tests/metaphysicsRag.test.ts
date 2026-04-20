import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({
      text: '穿搭问题宜结合颜色与材质判断。木水偏强时适合清爽、柔和、有流动感的颜色，避免过艳过躁。'.repeat(4)
    }),
    destroy: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('Metaphysics RAG chain', () => {
  const tempRoot = path.join(os.tmpdir(), 'fortune-ai-rag-test');
  const knowledgeDirectory = path.join(tempRoot, 'knowledge');
  const ragIndexPath = path.join(tempRoot, 'rag-index.json');
  const ragManifestPath = path.join(tempRoot, 'rag-manifest.json');
  const ragVerifyPath = path.join(tempRoot, 'rag-verify.json');

  beforeEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.mkdir(knowledgeDirectory, { recursive: true });
    process.env.FORTUNE_AI_KNOWLEDGE_DIRS = knowledgeDirectory;
    process.env.FORTUNE_RAG_INDEX_PATH = ragIndexPath;
    process.env.FORTUNE_RAG_MANIFEST_PATH = ragManifestPath;
    process.env.FORTUNE_RAG_VERIFY_PATH = ragVerifyPath;
    delete process.env.GEMINI_API_KEY;
    delete process.env.FORTUNE_AI_API_KEY;
    jest.resetModules();
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    delete process.env.FORTUNE_AI_KNOWLEDGE_DIRS;
    delete process.env.FORTUNE_RAG_INDEX_PATH;
    delete process.env.FORTUNE_RAG_MANIFEST_PATH;
    delete process.env.FORTUNE_RAG_VERIFY_PATH;
  });

  it('builds an index from PDF sources and retrieves top-k knowledge chunks', async () => {
    await fs.writeFile(
      path.join(knowledgeDirectory, '穿搭命理.pdf'),
      Buffer.from('%PDF-1.4 mock', 'utf8')
    );

    const { ingestDocuments } = await import('@/services/metaphysics-rag/ingestDocuments');
    const { retrieveKnowledge } = await import('@/services/metaphysics-rag/retrieveKnowledge');

    const { index, manifest } = await ingestDocuments();
    expect(index.chunks.length).toBeGreaterThan(0);
    expect(manifest.processedFiles[0].fileName).toBe('穿搭命理.pdf');
    expect(manifest.failedFiles).toHaveLength(0);

    const results = await retrieveKnowledge(
      {
        displayName: '星阑',
        gender: 'female',
        birthDate: '1997-03-14',
        birthCalendarType: 'solar',
        birthDateLunar: '农历 1997年二月初六',
        birthTime: '08:30',
        birthTimezone: 'UTC+8',
        birthLocation: '杭州',
        currentCity: '上海',
        focusArea: 'overall',
        currentChallenge: '我明天穿什么更合适',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      },
      '我明天穿什么衣服和配饰更合适？'
    );

    expect(results[0].sourceFile).toBe('穿搭命理.pdf');
    expect(results[0].snippet).toContain('颜色');
    expect(results[0].absolutePath).toContain('穿搭命理.pdf');
  });

  it('returns debug information with profile, bazi placeholder, docs and prompt preview', async () => {
    const { MetaphysicsAnswerService } = await import('@/services/metaphysics-rag/answerQuestion');

    const service = new MetaphysicsAnswerService();
    const answer = await service.answerQuestion({
      consultation: {
        id: 'consultation_debug_1',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        status: 'preview_ready',
        savePreference: 'do_not_save',
        unlocked: false,
        freeTurnsUsed: 0,
        profile: {
          displayName: '星阑',
          gender: 'female',
          birthDate: '1997-03-14',
          birthCalendarType: 'solar',
          birthDateLunar: '农历 1997年二月初六',
          birthTime: '08:30',
          birthTimezone: 'UTC+8',
          birthLocation: '杭州',
          currentCity: '上海',
          focusArea: 'overall',
          currentChallenge: '我明天穿什么更合适',
          dreamContext: '',
          fengShuiContext: '',
          uploadedAssets: []
        }
      },
      question: '我明天穿什么？',
      retrievedDocs: [
        {
          id: 'doc_1',
          sourceFile: '穿搭命理.pdf',
          sectionTitle: '衣着颜色',
          pageHint: '约第8页',
          content: '穿搭宜先看颜色和材质，再看整体气场。',
          relevanceScore: 0.91,
          snippet: '穿搭宜先看颜色和材质，再看整体气场。'
        }
      ]
    });

    expect(answer.debug?.bazi.status).toBe('ready');
    expect(answer.debug?.bazi.pillars?.year).toBeTruthy();
    expect(answer.debug?.retrievedDocuments[0].sourceFile).toBe('穿搭命理.pdf');
    expect(typeof answer.debug?.promptPreview).toBe('string');
  });

  it('normalizes timezone to UTC+8 before generating bazi', async () => {
    const { generateBazi } = await import('@/services/metaphysics-rag/generateBazi');

    const bazi = generateBazi({
      displayName: '晓山',
      gender: 'male',
      birthDate: '1997-03-14',
      birthCalendarType: 'solar',
      birthDateLunar: '农历 1997年二月初六',
      birthTime: '22:30',
      birthTimezone: 'UTC-8',
      birthLocation: '洛杉矶',
      currentCity: '上海',
      focusArea: 'overall',
      currentChallenge: '测试时区跨日',
      dreamContext: '',
      fengShuiContext: '',
      uploadedAssets: []
    });

    expect(bazi.status).toBe('ready');
    expect(bazi.notes).toContain('UTC+8');
  });

  it('classifies common scene questions into the expected scene type', async () => {
    const { detectQuestionScene } = await import('@/services/metaphysics-rag/decisionEngine');

    expect(detectQuestionScene('明天适合吃什么？')).toBe('food');
    expect(detectQuestionScene('明天适合去哪里？')).toBe('location');
    expect(detectQuestionScene('明天穿什么颜色比较好？')).toBe('outfit');
    expect(detectQuestionScene('这个项目接下来怎么推进？')).toBe('career');
    expect(detectQuestionScene('我现在要不要联系他？')).toBe('relationship');
    expect(detectQuestionScene('我现在很乱，怎么稳住自己？')).toBe('emotional');
  });

  it('uses scene-specific fallback answers that directly answer the user question', async () => {
    const { MetaphysicsAnswerService } = await import('@/services/metaphysics-rag/answerQuestion');

    const service = new MetaphysicsAnswerService();
    const consultation = {
      id: 'consultation_scene_guard_1',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      status: 'preview_ready' as const,
      savePreference: 'do_not_save' as const,
      unlocked: false,
      freeTurnsUsed: 0,
      profile: {
        displayName: '星阑',
        gender: 'female' as const,
        birthDate: '1997-03-14',
        birthCalendarType: 'solar' as const,
        birthDateLunar: '农历 1997年二月初六',
        birthTime: '08:30',
        birthTimezone: 'UTC+8',
        birthLocation: '杭州',
        currentCity: '上海',
        focusArea: 'overall' as const,
        currentChallenge: '测试问什么答什么',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    };

    const foodAnswer = await service.answerQuestion({
      consultation,
      question: '明天适合吃什么？',
      retrievedDocs: []
    });
    expect(foodAnswer.summary).toContain('命理依据');
    expect(foodAnswer.details[0]).toContain('一句话结论');
    expect(foodAnswer.details[0]).toMatch(/热汤面|米饭|清淡|温热/u);
    expect(foodAnswer.details.join('\n')).not.toMatch(/关键变量|最小动作|推进动作|保守动作|首轮调整|加码|观察反馈|当前事项/u);

    const locationAnswer = await service.answerQuestion({
      consultation,
      question: '明天适合去哪里？',
      retrievedDocs: []
    });
    expect(locationAnswer.details[0]).toMatch(/水边|公园|咖啡馆|图书馆|绿地/u);
    expect(locationAnswer.details.join('\n')).not.toMatch(/关键变量|推进动作|加码|观察反馈/u);

    const outfitAnswer = await service.answerQuestion({
      consultation,
      question: '明天穿什么颜色比较好？',
      retrievedDocs: []
    });
    expect(outfitAnswer.details[0]).toMatch(/米白|卡其|雾蓝|深灰/u);

    const careerAnswer = await service.answerQuestion({
      consultation,
      question: '这个项目接下来怎么推进？',
      retrievedDocs: []
    });
    expect(careerAnswer.details[0]).toMatch(/继续推进|先做|优先/u);

    const relationshipAnswer = await service.answerQuestion({
      consultation,
      question: '我现在要不要联系他？',
      retrievedDocs: []
    });
    expect(relationshipAnswer.details[0]).toMatch(/联系|主动|先别主动/u);

    const emotionalAnswer = await service.answerQuestion({
      consultation,
      question: '我现在很乱，怎么稳住自己？',
      retrievedDocs: []
    });
    expect(emotionalAnswer.details[0]).toMatch(/稳住|休息|减压|停下来/u);
  });

  it('writes a verification report that confirms processed PDFs can be retrieved', async () => {
    await fs.writeFile(path.join(knowledgeDirectory, '风水基础.pdf'), Buffer.from('%PDF-1.4 mock', 'utf8'));

    const { ingestDocuments } = await import('@/services/metaphysics-rag/ingestDocuments');
    const { verifyRagSources } = await import('@/services/metaphysics-rag/verifyRagSources');

    await ingestDocuments();
    const report = await verifyRagSources();

    expect(report.totalProcessedFiles).toBe(1);
    expect(report.matchedFileCount).toBe(1);
    expect(report.results[0].fileName).toBe('风水基础.pdf');
  });
});

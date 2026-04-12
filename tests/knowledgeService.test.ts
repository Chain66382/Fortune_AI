import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('KnowledgeService', () => {
  const tempKnowledgeDirectory = path.join(os.tmpdir(), 'fortune-ai-knowledge-test');

  beforeEach(async () => {
    await fs.rm(tempKnowledgeDirectory, { recursive: true, force: true });
    await fs.mkdir(tempKnowledgeDirectory, { recursive: true });
    process.env.FORTUNE_KNOWLEDGE_DIR = tempKnowledgeDirectory;
    jest.resetModules();
  });

  afterEach(async () => {
    await fs.rm(tempKnowledgeDirectory, { recursive: true, force: true });
    delete process.env.FORTUNE_KNOWLEDGE_DIR;
  });

  it('prefers evidence that matches the user focus and question', async () => {
    await fs.writeFile(
      path.join(tempKnowledgeDirectory, 'dream-guide.json'),
      JSON.stringify(
        {
          id: 'dream-guide',
          sourceFile: '周公解梦-第二版2003.pdf',
          sourceType: 'knowledge_file',
          documentTitle: '周公解梦',
          overallThemes: ['梦境'],
          sections: [
            {
              sectionTitle: '坠落梦象',
              topicTags: ['梦境', '坠落', '压力'],
              pageHint: '约第12页',
              content: '梦到从高处坠落，往往提示现实中正面临压力、失控感和安全感不足。'
            }
          ]
        },
        null,
        2
      ),
      'utf8'
    );

    const { KnowledgeService } = await import('@/services/knowledge/knowledgeService');
    const service = new KnowledgeService();
    const evidence = await service.retrieveEvidence(
      {
        displayName: '云舟',
        gender: 'male',
        birthDate: '1990-01-12',
        birthCalendarType: 'solar',
        birthDateLunar: '农历 1989年腊月十六',
        birthTime: '11:20',
        birthLocation: '成都',
        currentCity: '深圳',
        focusArea: 'dream',
        currentChallenge: '最近总梦见从高楼掉下去，我担心这是不好的征兆。',
        dreamContext: '连续三天梦见坠落',
        fengShuiContext: '',
        uploadedAssets: []
      },
      '最近频繁梦见坠落，这说明什么？'
    );

    expect(evidence[0].sourceFile).toBe('周公解梦-第二版2003.pdf');
    expect(evidence[0].sectionTitle).toBe('坠落梦象');
  });
});

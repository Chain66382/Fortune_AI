import type { ConsultationRecord } from '@/types/consultation';
import type { KnowledgeEvidence } from '@/types/knowledge';
import { ReportService } from '@/services/report/reportService';

const consultation: ConsultationRecord = {
  id: 'consultation_1',
  createdAt: '2026-04-11T00:00:00.000Z',
  updatedAt: '2026-04-11T00:00:00.000Z',
  status: 'preview_ready',
  savePreference: 'do_not_save',
  unlocked: false,
  freeTurnsUsed: 1,
  profile: {
    displayName: '夜航',
    gender: 'female',
    birthDate: '1994-08-17',
    birthCalendarType: 'solar',
    birthDateLunar: '农历 1994年七月十一',
    birthTime: '05:30',
    birthLocation: '南京',
    currentCity: '北京',
    focusArea: 'love',
    currentChallenge: '我想知道这段关系还有没有重新靠近的机会。',
    dreamContext: '',
    fengShuiContext: '',
    uploadedAssets: []
  },
  initialQuestion: '这段感情还会回暖吗？'
};

const evidence: KnowledgeEvidence[] = [
  {
    id: 'e1',
    sourceFile: '梅花易数-宋-邵雍.pdf',
    sectionTitle: '动静之机',
    pageHint: '前半部分',
    content: '事势未明时，应先观其动机与变化，不可急于求成。',
    relevanceScore: 20
  }
];

describe('ReportService', () => {
  it('builds a locked outline for the consultation stage', () => {
    const service = new ReportService();
    const outline = service.buildLockedOutlineForConsultation(consultation);

    expect(outline).toHaveLength(4);
    expect(outline[0].title).toContain('总览');
  });

  it('creates a deterministic fallback preview when no API key is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = new ReportService();
    const preview = await service.createPreview(consultation, consultation.initialQuestion || '', evidence);

    expect(preview.summary).toContain('命理依据');
    expect(preview.evidence).toHaveLength(1);
    expect(preview.guidance).toHaveLength(2);
  });

  it('requests supporting photos for face-reading questions', async () => {
    const service = new ReportService();
    const preview = await service.createPreview(consultation, '能不能帮我看看面相？', evidence);

    expect(preview.headline).toContain('面相');
    expect(preview.details[0]).toContain('正脸');
    expect(preview.evidence).toHaveLength(0);
  });

  it('maps outfit follow-up questions to scene-specific fallback advice', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = new ReportService();
    const reply = await service.createFollowUpAnswer(consultation, '我明天穿什么比较合适？', evidence);

    expect(reply.summary).toContain('命理依据');
    expect(reply.details[0]).toContain('一句话结论');
    expect(reply.details.join('\n')).toMatch(/米白|卡其|雾蓝|深灰/u);
    expect(reply.details.join('\n')).toMatch(/配饰|材质/u);
    expect(reply.guidance[0]).toContain('注意事项');
  });

  it('routes concrete scene questions to the matching fallback template', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = new ReportService();

    const food = await service.createFollowUpAnswer(consultation, '明天适合吃什么？', evidence);
    expect(food.summary).toContain('命理依据');
    expect(food.details[0]).toContain('一句话结论');
    expect(food.details.join('\n')).toMatch(/饮食|食物|汤|米饭/u);
    expect(food.details.join('\n')).not.toMatch(/关键变量|最小动作|加码|观察反馈/u);

    const location = await service.createFollowUpAnswer(consultation, '明天适合去哪里？', evidence);
    expect(location.details[0]).toMatch(/去安静|绿地|水边|咖啡馆|图书馆/u);
    expect(location.guidance[0]).toContain('注意事项');

    const career = await service.createFollowUpAnswer(consultation, '这个项目接下来怎么推进？', evidence);
    expect(career.details[0]).toMatch(/推进|先做|优先/u);

    const relationship = await service.createFollowUpAnswer(consultation, '我现在要不要联系他？', evidence);
    expect(relationship.details[0]).toMatch(/联系|主动/u);
  });
});

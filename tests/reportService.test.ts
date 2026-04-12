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

    expect(preview.headline).toContain('我先替你看这件事的势');
    expect(preview.evidence).toHaveLength(1);
    expect(preview.guidance).toHaveLength(3);
  });

  it('requests supporting photos for face-reading questions', async () => {
    const service = new ReportService();
    const preview = await service.createPreview(consultation, '能不能帮我看看面相？', evidence);

    expect(preview.headline).toContain('面相');
    expect(preview.details[0]).toContain('正脸');
    expect(preview.evidence).toHaveLength(0);
  });
});

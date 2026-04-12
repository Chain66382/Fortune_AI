import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { scoreContentAgainstTokens, extractTokens } from '@/services/knowledge/scoring';
import type { FocusArea, UserProfileInput } from '@/types/consultation';
import type { KnowledgeChunk, KnowledgeDocument, KnowledgeEvidence } from '@/types/knowledge';

const focusTokens: Record<FocusArea, string[]> = {
  overall: ['整体', '运势', '命局'],
  love: ['感情', '桃花', '关系'],
  career: ['事业', '工作', '晋升'],
  wealth: ['财运', '收入', '资产'],
  health: ['健康', '身心', '气场'],
  dream: ['梦境', '征兆', '潜意识'],
  feng_shui: ['风水', '住宅', '布局'],
  fortune_cycle: ['流年', '时运', '节奏']
};

const fallbackKnowledgeDocuments: KnowledgeDocument[] = [
  {
    id: 'supplemental-foundation',
    sourceFile: 'supplemental-foundation.md',
    sourceType: 'supplemental',
    documentTitle: 'Fortune AI Supplemental Framework',
    overallThemes: ['咨询框架', '行动建议', '能量节奏'],
    sections: [
      {
        sectionTitle: '整体咨询框架',
        topicTags: ['整体', '趋势', '行动'],
        pageHint: 'supplemental',
        content:
          '命理咨询在表达上应先给出当下主线，再解释成因、阻力与转机，最后收束到可执行的行动建议。这样既保留神秘感，也能让用户感受到落地价值。'
      },
      {
        sectionTitle: '关系与情绪判断',
        topicTags: ['感情', '情绪', '关系'],
        pageHint: 'supplemental',
        content:
          '涉及感情问题时，应区分关系里的主动方、回避方与现实阻力。回答既要呈现情绪流向，也要指出沟通窗口、界限感和时间节奏。'
      },
      {
        sectionTitle: '事业与财务判断',
        topicTags: ['事业', '财运', '节奏'],
        pageHint: 'supplemental',
        content:
          '事业和财务的解读要强调机会并非线性增长，而是和时机、协作对象、环境布局有关。建议中要包含一项保守动作和一项进攻动作。'
      },
      {
        sectionTitle: '梦境与象征解释',
        topicTags: ['梦境', '象征', '预警'],
        pageHint: 'supplemental',
        content:
          '梦境解读应以象征意象为核心，连接近期压力、未解决的情绪和现实中的选择题，不应把单一意象夸张成绝对命定结论。'
      },
      {
        sectionTitle: '风水与空间建议',
        topicTags: ['风水', '空间', '布局'],
        pageHint: 'supplemental',
        content:
          '风水建议要落到空间动线、采光、收纳、休息区与工作区的平衡。高质量回答应先识别问题空间，再给出低成本可执行调整。'
      },
      {
        sectionTitle: '面相与手相补充框架',
        topicTags: ['面相', '手相', '观察'],
        pageHint: 'supplemental',
        content:
          '面相与手相类问题在首版中应被视为辅助资料，建议结合气色、神态、手掌纹路与现实处境一起判断，避免把单一视觉特征夸张成绝对结论。'
      },
      {
        sectionTitle: '星座与阶段性运势',
        topicTags: ['星座', '运势', '周期'],
        pageHint: 'supplemental',
        content:
          '星座运势的高质量表达不应停留在单日吉凶，而要把情绪基调、关系节奏和行动窗口整合成用户能立即感知的阶段性建议。'
      }
    ]
  }
];

let cache: KnowledgeChunk[] | null = null;
let cacheLoadedAt = 0;

const flattenDocument = (document: KnowledgeDocument): KnowledgeChunk[] =>
  document.sections.map((section, index) => ({
    id: `${document.id}_${index + 1}`,
    sourceFile: document.sourceFile,
    sourceType: document.sourceType,
    documentTitle: document.documentTitle,
    sectionTitle: section.sectionTitle,
    topicTags: section.topicTags,
    pageHint: section.pageHint,
    content: section.content
  }));

const loadDocumentsFromDisk = async (): Promise<KnowledgeDocument[]> => {
  try {
    const fileNames = await fs.readdir(env.knowledgeDir);
    const jsonFileNames = fileNames.filter((fileName) => fileName.endsWith('.json'));

    if (jsonFileNames.length === 0) {
      return fallbackKnowledgeDocuments;
    }

    const documents = await Promise.all(
      jsonFileNames.map(async (fileName) => {
        const filePath = path.join(env.knowledgeDir, fileName);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content) as KnowledgeDocument;
      })
    );

    return [...fallbackKnowledgeDocuments, ...documents];
  } catch {
    return fallbackKnowledgeDocuments;
  }
};

const loadKnowledgeChunks = async (): Promise<KnowledgeChunk[]> => {
  const now = Date.now();

  if (cache && now - cacheLoadedAt < 10_000) {
    return cache;
  }

  const documents = await loadDocumentsFromDisk();
  cache = documents.flatMap(flattenDocument);
  cacheLoadedAt = now;
  return cache;
};

const buildSearchTokens = (profile: UserProfileInput, question: string): string[] => {
  const profileText = [
    profile.focusArea,
    profile.currentChallenge,
    profile.dreamContext || '',
    profile.fengShuiContext || ''
  ].join(' ');

  return Array.from(
    new Set([...extractTokens(question), ...extractTokens(profileText), ...focusTokens[profile.focusArea]])
  );
};

export class KnowledgeService {
  async retrieveEvidence(profile: UserProfileInput, question: string): Promise<KnowledgeEvidence[]> {
    const tokens = buildSearchTokens(profile, question);
    const chunks = await loadKnowledgeChunks();

    const rankedChunks = chunks
      .map((chunk) => {
        const tagScore = chunk.topicTags.reduce(
          (score, tag) => score + (tokens.some((token) => tag.includes(token) || token.includes(tag)) ? 3 : 0),
          0
        );

        const score =
          scoreContentAgainstTokens(
            `${chunk.documentTitle} ${chunk.content} ${chunk.topicTags.join(' ')}`,
            chunk.sectionTitle,
            tokens
          ) + tagScore;

        return { chunk, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map<KnowledgeEvidence>(({ chunk, score }) => ({
        id: chunk.id,
        sourceFile: chunk.sourceFile,
        sectionTitle: chunk.sectionTitle,
        pageHint: chunk.pageHint,
        content: chunk.content,
        relevanceScore: score
      }));

    if (rankedChunks.length > 0) {
      return rankedChunks;
    }

    return chunks.slice(0, 5).map((chunk, index) => ({
      id: chunk.id,
      sourceFile: chunk.sourceFile,
      sectionTitle: chunk.sectionTitle,
      pageHint: chunk.pageHint,
      content: chunk.content,
      relevanceScore: 10 - index
    }));
  }
}

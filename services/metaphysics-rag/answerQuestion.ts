import { GeminiService } from '../ai/geminiService';
import { buildMetaphysicsContext } from './buildMetaphysicsContext';
import { buildPrompt } from './buildPrompt';
import { buildCurrentTimeContext } from './currentTimeContext';
import { loadUserProfile } from './loadUserProfile';
import type { AnswerQuestionInput, SceneAnswerShape } from './types';
import type { AnswerPayload } from '../../types/consultation';

const sceneLabels: Record<string, string> = {
  outfit: '穿搭',
  food: '饮食',
  location: '位置',
  schedule: '安排',
  career: '事业',
  relationship: '关系',
  emotional: '状态',
  general: '命理'
};

const buildPromptPreview = (prompt: string) => {
  const startIndex = prompt.indexOf('用户命理资料：');
  const docsIndex = prompt.indexOf('检索文档片段：');

  if (startIndex >= 0 && docsIndex > startIndex) {
    return prompt.slice(startIndex, Math.min(prompt.length, docsIndex + 500));
  }

  return prompt.slice(0, 1000);
};

const buildSceneFallbackBlocks = (scene: string) => {
  switch (scene) {
    case 'outfit':
      return {
        details: [
          '🧥 颜色与风格\n- 更适合干净、稳重、柔和的配色。\n- 可以优先考虑米白、卡其、雾蓝、深灰这类不躁不乱的颜色。',
          '✨ 配饰与材质\n- 材质适合有一点垂感或质感的单品。\n- 配饰宜少而精，不建议一次堆太多亮点。'
        ],
        cautions: ['少用过艳、过跳的颜色。', '不要把重点放在吸睛感，先稳住整体气场。'],
        closing: '一句话记住：先穿得稳，再谈亮点。'
      };
    case 'food':
      return {
        details: [
          '🥣 饮食方向\n- 更适合温和、清稳、少刺激的饮食。\n- 可以优先考虑热汤、蒸煮、清淡蛋白和根茎类食物。',
          '🍵 味型节奏\n- 口味宜淡一点、稳一点。\n- 不建议空腹上重辣、重油或过冷饮食。'
        ],
        cautions: ['少吃太冰、太辣或过度进补。', '不要为了提神临时猛灌甜饮。'],
        closing: '一句话记住：吃得温和一点，状态会更顺。'
      };
    case 'location':
      return {
        details: [
          '🪑 位置选择\n- 更适合有依靠、视野稳、但不脱离信息流的位置。\n- 不建议把自己放到太边角、太封闭的区域。',
          '📍 环境特征\n- 环境宜整洁、动线顺、采光稳定。\n- 更适合偏安静但还能接到人群互动的地方。'
        ],
        cautions: ['避免强通道口和过度嘈杂的位置。', '不要为了图清静，把自己放到完全脱节的位置。'],
        closing: '一句话记住：位置宜稳、宜通、宜有依靠。'
      };
    default:
      return {
        details: [
          '📘 检索文档\n- 我会先按命理资料读取你的问题，再把检索到的文档线索一起纳入判断。',
          '💡 回答方向\n- 这版回答会优先把命理背景、问题场景和文档依据绑在一起，不只讲抽象趋势。'
        ],
        cautions: ['当前 fallback 只作为开发阶段兜底。', '如果你继续追问，我会沿同一命理上下文继续往下拆。'],
        closing: '一句话记住：命理主线和文档依据会同时保留。'
      };
  }
};

const fallbackAnswer = (
  question: string,
  scene: string,
  context: ReturnType<typeof buildMetaphysicsContext>,
  currentTimeContext: ReturnType<typeof buildCurrentTimeContext>,
  prompt: string,
  retrievedDocs: AnswerQuestionInput['retrievedDocs']
): AnswerPayload => {
  const sceneFallback = buildSceneFallbackBlocks(scene);

  return {
    headline: `👉 先按你的命理资料看${sceneLabels[scene] || '这件事'}`,
    summary: `针对你问的“${question}”，我会先以你的出生资料和当前时点作为命理主线，再把建议落到具体场景 ${scene}。\n\n🔮 命理依据\n当前读取到的命理信息以 ${context.normalizedBirthDateLunarUtc8 || context.birthDateLunar || context.birthDate} ${context.normalizedBirthTimeUtc8 || context.birthTime} 为准，八字正式生成逻辑已预留。`,
    details: [
      `📘 检索文档\n${retrievedDocs.slice(0, 2).map((document) => `- ${document.sourceFile} / ${document.sectionTitle}：${document.snippet}`).join('\n')}`,
      ...sceneFallback.details
    ],
    guidance: [
      `⚠️ 注意事项\n${sceneFallback.cautions.map((item) => `- ${item}`).join('\n')}`,
      `✨ 收尾提醒\n${sceneFallback.closing}`
    ],
    evidence: retrievedDocs,
    debug: {
      userProfile: {
        displayName: context.displayName,
        birthDate: context.birthDate,
        birthTime: context.birthTime,
        timezone: context.timezone,
        calendarType: context.calendarType,
        birthLocation: context.birthLocation,
        normalizedUtc8: {
          birthDate: context.normalizedBirthDateUtc8,
          birthDateLunar: context.normalizedBirthDateLunarUtc8,
          birthTime: context.normalizedBirthTimeUtc8
        }
      },
      currentTimeContext,
      bazi: context.bazi,
      retrievedDocuments: retrievedDocs.map((document) => ({
        sourceFile: document.sourceFile,
        sectionTitle: document.sectionTitle,
        score: document.relevanceScore,
        snippet: document.snippet,
        referencedYear: document.referencedYear ?? null,
        timeReference: document.timeReference || 'unknown',
        timeAdjustment: document.timeAdjustment || { action: 'none' as const }
      })),
      promptPreview: buildPromptPreview(prompt),
      modelOutput: {
        mode: 'fallback'
      }
    }
  };
};

const mapStructuredAnswer = (
  structured: SceneAnswerShape,
  question: string,
  context: ReturnType<typeof buildMetaphysicsContext>,
  currentTimeContext: ReturnType<typeof buildCurrentTimeContext>,
  prompt: string,
  retrievedDocs: AnswerQuestionInput['retrievedDocs']
): AnswerPayload => ({
  headline: structured.title,
  summary: `${structured.summary}\n\n🔮 命理依据\n${structured.metaphysics_basis}`,
  details: structured.sections.map(
    (section) => `${section.icon} ${section.heading}\n${section.content.map((item) => `- ${item}`).join('\n')}`
  ),
  guidance: [
    `⚠️ 注意事项\n${structured.cautions.map((item) => `- ${item}`).join('\n')}`,
    `✨ 收尾提醒\n${structured.closing}`
  ],
  evidence: retrievedDocs,
  debug: {
    userProfile: {
      displayName: context.displayName,
      birthDate: context.birthDate,
      birthTime: context.birthTime,
      timezone: context.timezone,
      calendarType: context.calendarType,
      birthLocation: context.birthLocation,
      normalizedUtc8: {
        birthDate: context.normalizedBirthDateUtc8,
        birthDateLunar: context.normalizedBirthDateLunarUtc8,
        birthTime: context.normalizedBirthTimeUtc8
      }
    },
    currentTimeContext,
    bazi: context.bazi,
    retrievedDocuments: retrievedDocs.map((document) => ({
      sourceFile: document.sourceFile,
      sectionTitle: document.sectionTitle,
      score: document.relevanceScore,
      snippet: document.snippet,
      referencedYear: document.referencedYear ?? null,
      timeReference: document.timeReference || 'unknown',
      timeAdjustment: document.timeAdjustment || { action: 'none' as const }
    })),
    promptPreview: buildPromptPreview(prompt),
    modelOutput: structured as unknown as Record<string, unknown>
  }
});

export class MetaphysicsAnswerService {
  private readonly geminiService = new GeminiService();

  async answerQuestion(input: AnswerQuestionInput): Promise<AnswerPayload> {
    const { profile } = loadUserProfile(input.consultation);
    const context = buildMetaphysicsContext(profile);
    const currentTimeContext = buildCurrentTimeContext(input.question);
    const { prompt, scene } = buildPrompt({
      question: input.question,
      metaphysicsContext: context,
      retrievedDocs: input.retrievedDocs,
      currentTimeContext
    });

    const result = await this.geminiService.generateStructuredJson<SceneAnswerShape>(prompt, () =>
      ({
        title: '',
        summary: '',
        metaphysics_basis: '',
        sections: [],
        cautions: [],
        closing: ''
      }) as SceneAnswerShape
    );

    if (!result.title || !result.summary || result.sections.length === 0) {
      return fallbackAnswer(input.question, scene, context, currentTimeContext, prompt, input.retrievedDocs);
    }

    return mapStructuredAnswer(result, input.question, context, currentTimeContext, prompt, input.retrievedDocs);
  }
}

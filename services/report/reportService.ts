import { GeminiService } from '@/services/ai/geminiService';
import type {
  AssetCategory,
  AnswerPayload,
  ConsultationRecord,
  ConsultationReport,
  LockedReportOutlineItem
} from '@/types/consultation';
import type { KnowledgeEvidence } from '@/types/knowledge';

const focusLabels: Record<ConsultationRecord['profile']['focusArea'], string> = {
  overall: '整体命势',
  love: '情感走向',
  career: '事业机会',
  wealth: '财富节奏',
  health: '身心状态',
  dream: '梦境征象',
  feng_shui: '风水布局',
  fortune_cycle: '流年趋势'
};

const joinEvidence = (evidence: KnowledgeEvidence[]): string =>
  evidence
    .map(
      (item, index) =>
        `${index + 1}. 来源：${item.sourceFile} / ${item.sectionTitle} / ${item.pageHint || '未标页'}\n内容：${item.content}`
    )
    .join('\n\n');

const uploadedCategories = (consultation: ConsultationRecord): AssetCategory[] =>
  Array.from(new Set(consultation.profile.uploadedAssets.map((asset) => asset.category)));

const buildAssetRequestAnswer = (
  message: string,
  consultation: ConsultationRecord
): AnswerPayload | null => {
  const normalizedMessage = message.toLowerCase();
  const categories = uploadedCategories(consultation);

  const requestConfigs: Array<{
    category: AssetCategory;
    matcher: RegExp;
    headline: string;
    summary: string;
    details: string[];
    guidance: string[];
  }> = [
    {
      category: 'face',
      matcher: /面相|看脸|气色|五官|额头|鼻子|下巴/u,
      headline: '先把面相资料拍清楚，我再继续看',
      summary: '面相类问题不能只凭一句话断。我需要你先补一组清晰照片，再顺着你最关心的方向继续判断。',
      details: [
        '请在自然光下拍一张正脸，再补一张左侧脸和一张右侧脸，避免美颜、滤镜和强反光。',
        '额头、眉毛、眼睛、鼻梁、法令纹和下巴尽量无遮挡，镜头与脸保持平视。'
      ],
      guidance: [
        '上传后告诉我你最想看感情、事业还是整体状态。',
        '如果暂时不方便拍照，也可以先继续文字咨询。'
      ]
    },
    {
      category: 'palm',
      matcher: /手相|掌纹|掌心|生命线|感情线|智慧线/u,
      headline: '手相要先看掌纹细节，再谈判断',
      summary: '如果你想看手相，我需要你先补掌心照片。掌纹不清，任何判断都会失真。',
      details: [
        '请分别拍左手和右手掌心，手掌摊平、手指自然张开，光线均匀，不要糊焦。',
        '照片里尽量完整拍到掌心、手指根部和主要掌纹，避免遮挡和过度修图。'
      ],
      guidance: [
        '上传后可以直接问我想重点看感情线、事业线还是整体运势。',
        '如果你只想先聊趋势，也可以继续文字提问。'
      ]
    },
    {
      category: 'space',
      matcher: /风水|居住空间|办公空间|办公室|工位|卧室|客厅|书房|房间|布局|朝向/u,
      headline: '空间类问题先让我看布局，再做判断',
      summary: '风水和空间判断必须先看到真实布局，不然只能停留在泛泛而谈。',
      details: [
        '请拍空间全景、门口朝向、窗户位置，以及你最常停留的位置，例如床位、书桌或工位。',
        '照片尽量包含动线、采光和大件家具摆放，避免只拍局部。'
      ],
      guidance: [
        '上传后顺便告诉我你最在意的是睡眠、财位、工作效率还是人际关系。',
        '如果暂时不方便拍照，也可以先用文字描述房间结构。'
      ]
    }
  ];

  const matchedConfig = requestConfigs.find((config) => config.matcher.test(normalizedMessage));

  if (!matchedConfig || categories.includes(matchedConfig.category)) {
    return null;
  }

  return {
    headline: matchedConfig.headline,
    summary: matchedConfig.summary,
    details: matchedConfig.details,
    guidance: matchedConfig.guidance,
    evidence: []
  };
};

const buildFallbackPreview = (
  consultation: ConsultationRecord,
  question: string,
  evidence: KnowledgeEvidence[]
): AnswerPayload => {
  const focusLabel = focusLabels[consultation.profile.focusArea];
  const leadEvidence = evidence[0];

  return {
    headline: `${consultation.profile.displayName}，我先替你看这件事的势`,
    summary: `从你刚才的问题看，真正要看的不是单一结果，而是“${consultation.profile.currentChallenge}”背后的变化节奏。局势并没有完全封住，但它要求你先看清轻重缓急。`,
    details: [
      `你现在问的“${question}”，本质上是在确认一件事是否到了该推进、该等待，还是该换判断方式的节点。`,
      leadEvidence
        ? `我先参考到《${leadEvidence.sourceFile}》里“${leadEvidence.sectionTitle}”这一段，它更偏向提醒你先辨势，再决定怎么动。`
        : '当前能看到的信号，是先稳住判断顺序，不要被一时情绪带着跑。',
      consultation.profile.uploadedAssets.length > 0
        ? '你已经补充过资料，后面追问时我会继续顺着这些线索收紧判断。'
        : '如果后面你想看面相、手相或空间类问题，我会直接告诉你该补什么资料。'
    ],
    guidance: [
      '先把你最在意的结果和最怕发生的结果分开来看。',
      '接下来两三天，重点观察重复出现的信号，而不是一次性的情绪波动。',
      '你可以继续追问，我会顺着这条主线往下拆。'
    ],
    evidence
  };
};

const buildLockedOutline = (focusLabel: string): LockedReportOutlineItem[] => [
  {
    title: `${focusLabel}总览`,
    teaser: '拆解你当前正在经历的主要运势转折点，以及这一轮变化的真正触发因素。'
  },
  {
    title: '关键阻力与暗线',
    teaser: '指出正在拖慢结果的隐性因素，区分可控阻力和暂时不可控阻力。'
  },
  {
    title: '近阶段机会窗口',
    teaser: '标出未来一段时间内更适合主动推进、谈判或调整方向的窗口。'
  },
  {
    title: '具体行动建议',
    teaser: '给出可立即执行的动作和应避免的误判方式。'
  }
];

const buildFallbackReport = (
  consultation: ConsultationRecord,
  evidence: KnowledgeEvidence[]
): ConsultationReport => {
  const focusLabel = focusLabels[consultation.profile.focusArea];

  return {
    summary: `${consultation.profile.displayName}当前的${focusLabel}并非低谷，而是“先辨势、再行动”的阶段。你的问题不是能力不足，而是需要先修正判断顺序和发力节奏。`,
    sections: [
      {
        title: '一、当前主线',
        content: `你最近最强的命理信号是：问题会围绕“${consultation.profile.currentChallenge}”持续出现，这说明它已经从偶发困扰转成核心命题。先处理主线，其他事项才会顺势好转。`
      },
      {
        title: '二、阻力来源',
        content:
          '阻力更像是节奏错位而不是彻底封闭。你可能一边想快速确认结果，一边又对风险高度敏感，这会让你在真正该推进时反而迟疑。'
      },
      {
        title: '三、机会窗口',
        content:
          '机会不是突然出现，而是建立在你把条件、边界和优先级先整理清楚之后。只要你先做筛选，外部资源会更容易向你靠拢。'
      },
      {
        title: '四、深度建议',
        content:
          '把接下来两周视为“校准期”：减少冲动表态，增加信息确认；在情绪最强烈的时候不做最终决定，在信号重复出现时再推进。'
      }
    ],
    actionItems: [
      '先写下你真正想要的结果，避免被短期情绪牵着走。',
      '针对当前困扰建立两个版本的行动方案：保守方案和主动方案。',
      '在下一次重要沟通前，先确认对方真正关心的利益点。'
    ],
    evidence
  };
};

export class ReportService {
  private readonly geminiService = new GeminiService();

  buildLockedOutlineForConsultation(consultation: ConsultationRecord): LockedReportOutlineItem[] {
    return buildLockedOutline(focusLabels[consultation.profile.focusArea]);
  }

  async createPreview(
    consultation: ConsultationRecord,
    question: string,
    evidence: KnowledgeEvidence[]
  ): Promise<AnswerPayload> {
    const assetRequestAnswer = buildAssetRequestAnswer(question, consultation);

    if (assetRequestAnswer) {
      return assetRequestAnswer;
    }

    const prompt = `
你是 Fortune AI 的资深命理老师。请基于用户背景与知识证据，返回 JSON：
{
  "headline": "string",
  "summary": "string",
  "details": ["string", "string", "string"],
  "guidance": ["string", "string", "string"]
}

要求：
1. 用简体中文，像真人大师在一对一聊天，沉稳、克制、可信。
2. 先回应用户最关心的点，再给出判断和下一步观察方向。
3. 必须体现知识依据，但不要逐条复述或展示内部检索过程。
4. 不要提付费、完整版报告、营销措辞。
5. 如果用户提到面相、手相、居住空间或办公空间，而当前没有对应资料，必须先让用户补资料，不要直接断。
6. 如果用户已经上传过资料，只能说“已收到资料，将结合这些线索继续判断”，不要假装自己已经做了精细图像识别。
7. 不要做医疗、法律、投资保证式承诺。

用户信息：
- 昵称：${consultation.profile.displayName}
- 咨询方向：${focusLabels[consultation.profile.focusArea]}
- 当前困扰：${consultation.profile.currentChallenge}
- 出生日期（农历）：${
      consultation.profile.birthDateLunarUtc8 ||
      consultation.profile.birthDateLunar ||
      consultation.profile.birthDateUtc8 ||
      consultation.profile.birthDate
    }
- 出生时间：${consultation.profile.birthTimeUtc8 || consultation.profile.birthTime || '未提供'}
- 出生地：${consultation.profile.birthLocation || '未提供'}
- 现居城市：${consultation.profile.currentCity || '未提供'}
- 梦境补充：${consultation.profile.dreamContext || '无'}
- 风水补充：${consultation.profile.fengShuiContext || '无'}
- 已上传资料类别：${
      consultation.profile.uploadedAssets.length
        ? consultation.profile.uploadedAssets.map((asset) => asset.category).join('、')
        : '无'
    }

本次问题：${question}

知识证据：
${joinEvidence(evidence)}
`;

    const result = await this.geminiService.generateFortuneAnswer(prompt, evidence, () =>
      buildFallbackPreview(consultation, question, evidence)
    );

    return {
      ...result,
      evidence
    };
  }

  async createFullReport(
    consultation: ConsultationRecord,
    evidence: KnowledgeEvidence[]
  ): Promise<ConsultationReport> {
    const prompt = `
你是 Fortune AI 的高级玄学顾问。请基于下面用户背景与知识证据，输出 JSON：
{
  "summary": "string",
  "sections": [
    { "title": "string", "content": "string" },
    { "title": "string", "content": "string" },
    { "title": "string", "content": "string" },
    { "title": "string", "content": "string" }
  ],
  "actionItems": ["string", "string", "string"]
}

要求：
1. sections 固定写成四段，标题要有高级感。
2. 内容要明显比免费预览更深，涵盖现状、阻力、机会、行动。
3. 语言保持神秘感，但必须能落到现实建议。
4. 不要假装已经做了图片识别，如果用户上传了照片，只能说这些资料会作为辅助参考。

用户信息：
- 昵称：${consultation.profile.displayName}
- 咨询方向：${focusLabels[consultation.profile.focusArea]}
- 当前困扰：${consultation.profile.currentChallenge}
- 出生日期（农历）：${
      consultation.profile.birthDateLunarUtc8 ||
      consultation.profile.birthDateLunar ||
      consultation.profile.birthDateUtc8 ||
      consultation.profile.birthDate
    }
- 出生时间：${consultation.profile.birthTimeUtc8 || consultation.profile.birthTime || '未提供'}
- 出生地：${consultation.profile.birthLocation}
- 现居城市：${consultation.profile.currentCity}
- 梦境补充：${consultation.profile.dreamContext || '无'}
- 风水补充：${consultation.profile.fengShuiContext || '无'}
- 初始问题：${consultation.initialQuestion || '未记录'}
- 已上传资料数量：${consultation.profile.uploadedAssets.length}

知识证据：
${joinEvidence(evidence)}
`;

    const result = await this.geminiService.generateFortuneReport(prompt, evidence, () =>
      buildFallbackReport(consultation, evidence)
    );

    return {
      ...result,
      evidence
    };
  }

  async createFollowUpAnswer(
    consultation: ConsultationRecord,
    message: string,
    evidence: KnowledgeEvidence[]
  ): Promise<AnswerPayload> {
    const assetRequestAnswer = buildAssetRequestAnswer(message, consultation);

    if (assetRequestAnswer) {
      return assetRequestAnswer;
    }

    const prompt = `
你是 Fortune AI 的资深命理老师。请对用户的追问返回 JSON：
{
  "headline": "string",
  "summary": "string",
  "details": ["string", "string"],
  "guidance": ["string", "string"]
}

要求：
1. 明确回应追问，不要重复前文。
2. 回答必须承接用户已有背景和上一轮问题。
3. 可以引用新的知识线索，但保持克制和专业。
4. 如果用户提到面相、手相、居住空间或办公空间，而当前没有对应资料，必须先指导他补资料。
5. 如果已上传过资料，只能说已收到资料并继续结合这些线索判断，不要假装完成了精准图像识别。

用户背景：
- 昵称：${consultation.profile.displayName}
- 咨询方向：${focusLabels[consultation.profile.focusArea]}
- 当前困扰：${consultation.profile.currentChallenge}
- 历史问题：${consultation.initialQuestion || '无'}
- 追问内容：${message}
- 已上传资料类别：${
      consultation.profile.uploadedAssets.length
        ? consultation.profile.uploadedAssets.map((asset) => asset.category).join('、')
        : '无'
    }

知识证据：
${joinEvidence(evidence)}
`;

    const result = await this.geminiService.generateFortuneAnswer(prompt, evidence, () => ({
      headline: '这次追问已经切到核心处了',
      summary: '你现在问的这一层，比最开始更接近真正需要判断的地方，所以接下来要看的是信号是否稳定，而不是情绪是否一时上头。',
      details: [
        '这件事不能只看一次反馈，重点是对方、环境或结果有没有反复出现同类迹象。',
        '局势还没完全落定时，先守住边界，比急着逼自己下结论更重要。'
      ],
      guidance: ['先定下你下一步动作的底线。', '重复出现的信号，比一次性的情绪更值得参考。']
    }));

    return {
      ...result,
      evidence
    };
  }
}

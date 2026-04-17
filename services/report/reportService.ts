import { GeminiService } from '@/services/ai/geminiService';
import { MetaphysicsAnswerService } from '@/services/metaphysics-rag/answerQuestion';
import type {
  AssetCategory,
  AnswerPayload,
  ConsultationRecord,
  ConsultationReport,
  LockedReportOutlineItem
} from '@/types/consultation';
import type { KnowledgeEvidence } from '@/types/knowledge';

type QuestionScene =
  | 'outfit'
  | 'food'
  | 'location'
  | 'schedule'
  | 'career'
  | 'relationship'
  | 'emotional'
  | 'general';

interface StructuredSceneAnswer {
  title: string;
  summary: string;
  metaphysics_basis: string;
  sections: Array<{
    icon: string;
    heading: string;
    content: string[];
  }>;
  cautions: string[];
  closing: string;
}

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

const sceneMatchers: Array<{ scene: QuestionScene; matcher: RegExp }> = [
  {
    scene: 'outfit',
    matcher: /穿什么|穿搭|衣服|颜色|配色|饰品|配饰|口红|妆容|发型|造型/u
  },
  {
    scene: 'food',
    matcher: /吃什么|饮食|吃饭|食物|口味|进补|喝什么|早餐|午餐|晚餐|宵夜/u
  },
  {
    scene: 'location',
    matcher: /坐哪里|座位|方位|位置|朝向|工位|办公室|空间|环境|房间|风水|布局/u
  },
  {
    scene: 'schedule',
    matcher: /今天|明天|后天|什么时候|安排|顺序|先做|适合做什么|宜不宜|该不该出门/u
  },
  {
    scene: 'career',
    matcher: /工作|事业|升职|合作|项目|机会|跳槽|面试|汇报|客户|老板/u
  },
  {
    scene: 'relationship',
    matcher: /感情|关系|暧昧|复合|联系|沟通|约会|对象|伴侣|相处/u
  },
  {
    scene: 'emotional',
    matcher: /情绪|焦虑|烦|低落|压力|状态|心态|稳定自己|失眠|紧张/u
  }
];

const sceneDisplayLabels: Record<QuestionScene, string> = {
  outfit: '穿搭形象',
  food: '饮食选择',
  location: '位置与环境',
  schedule: '时间安排',
  career: '事业推进',
  relationship: '关系互动',
  emotional: '情绪状态',
  general: '综合判断'
};

const detectQuestionScene = (message: string): QuestionScene => {
  const normalizedMessage = message.trim().toLowerCase();
  return sceneMatchers.find((item) => item.matcher.test(normalizedMessage))?.scene || 'general';
};

const inferDayReference = (message: string): string => {
  if (/明天/u.test(message)) {
    return '明天';
  }

  if (/今天|今日/u.test(message)) {
    return '今天';
  }

  if (/后天/u.test(message)) {
    return '后天';
  }

  return message.match(/\d{1,2}月\d{1,2}日/u)?.[0] || '当前时点';
};

const inferElementBias = (consultation: ConsultationRecord) => {
  if (consultation.profile.focusArea === 'career' || consultation.profile.focusArea === 'wealth') {
    return {
      favorable: ['土', '金'],
      avoid: ['火过旺', '水过散'],
      tone: '稳中求准'
    };
  }

  if (consultation.profile.focusArea === 'love') {
    return {
      favorable: ['木', '水'],
      avoid: ['火过躁', '金过硬'],
      tone: '柔中带稳'
    };
  }

  if (consultation.profile.focusArea === 'feng_shui' || consultation.profile.focusArea === 'dream') {
    return {
      favorable: ['土', '木'],
      avoid: ['水气过重', '金气过冷'],
      tone: '先稳气场，再看细节'
    };
  }

  return {
    favorable: ['土', '木'],
    avoid: ['火过急', '水过散'],
    tone: '先稳后动'
  };
};

const buildMetaphysicsKernel = (consultation: ConsultationRecord, question: string) => {
  const elementBias = inferElementBias(consultation);
  const dayReference = inferDayReference(question);

  return {
    dayProfile: `${dayReference}更适合${elementBias.tone}的处理方式，先顺势，再做具体动作。`,
    favorableElements: elementBias.favorable,
    unfavorableElements: elementBias.avoid,
    tone: elementBias.tone,
    recommendationBias:
      question.includes('明天') || question.includes('今天')
        ? '把建议落到当天的具体选择，不只讲抽象趋势。'
        : '把建议落到用户当前提问场景，不只讲抽象趋势。',
    dayReference
  };
};

const buildFallbackSceneAnswer = (
  consultation: ConsultationRecord,
  question: string,
  evidence: KnowledgeEvidence[]
): StructuredSceneAnswer => {
  const scene = detectQuestionScene(question);
  const kernel = buildMetaphysicsKernel(consultation, question);
  const evidenceLabel = evidence[0]
    ? `参考《${evidence[0].sourceFile}》中“${evidence[0].sectionTitle}”这一段的线索`
    : '结合你当前的命理主线和问题时点';

  const sceneConfig: Record<
    QuestionScene,
    {
      title: string;
      sectionOne: { heading: string; content: string[] };
      sectionTwo: { heading: string; content: string[] };
      cautions: string[];
      closing: string;
    }
  > = {
    outfit: {
      title: `👉 ${kernel.dayReference}穿搭更适合走稳净有神的路线`,
      sectionOne: {
        heading: '颜色与风格',
        content: [
          `从五行偏向看，${kernel.dayReference}更适合偏${kernel.favorableElements.join('、')}感的配色，建议你优先考虑米白、雾蓝、卡其、深灰这一类稳住气场的颜色。`,
          '风格上更适合简洁、利落、带一点质感，不建议穿得太花或太碎。'
        ]
      },
      sectionTwo: {
        heading: '单品与配饰',
        content: [
          '可以优先考虑有结构感的外套、衬衫、针织或垂感较好的材质，让整体更稳。',
          '配饰适合少量点缀，金属色或温润材质比夸张亮面更有利。'
        ]
      },
      cautions: ['少用过艳、过跳的颜色。', '不要把重点放在吸睛感，先稳住整体气场。'],
      closing: '一句话记住：明天更适合“稳重清爽、有质感”的穿法。'
    },
    food: {
      title: `👉 ${kernel.dayReference}饮食更适合温和清稳，不宜太重`,
      sectionOne: {
        heading: '适合的饮食方向',
        content: [
          `结合你的命理偏性，${kernel.dayReference}更适合偏温、偏清、偏顺气的食物，建议你优先考虑热汤、蒸煮、少刺激的搭配。`,
          '食材方向可以偏向根茎类、温热汤水、清淡蛋白，少一点过冷过腻。'
        ]
      },
      sectionTwo: {
        heading: '味型与节奏',
        content: [
          '口味上更适合淡一点、稳一点，不建议空腹上重辣、重油、重甜。',
          '如果明天事情多，早餐和午餐尽量规律，避免忽冷忽热影响状态。'
        ]
      },
      cautions: ['少吃太冰、太辣或过度进补。', '不要为了提神临时猛灌咖啡或甜饮。'],
      closing: '一句话记住：明天吃得温和、清稳，会比刺激型饮食更顺。'
    },
    location: {
      title: `👉 ${kernel.dayReference}更适合选“稳中有互动”的位置`,
      sectionOne: {
        heading: '位置选择',
        content: [
          '从命理气场看，这个时点不太适合完全封闭或过于边角的位置。',
          '建议你优先考虑视野开阔、背后有依靠、同时能接到信息流的位置。'
        ]
      },
      sectionTwo: {
        heading: '环境特征',
        content: [
          '如果是工位或座位，适合偏安静但不脱离人群的位置，更利于判断和协作。',
          '如果是空间选择，宜整洁、采光稳定、动线顺，不要太杂乱。'
        ]
      },
      cautions: ['避免坐在强通道口或过于嘈杂的地方。', '不要为了图清静，把自己放到完全脱节的位置。'],
      closing: '一句话记住：位置宜稳、宜通、宜有依靠。'
    },
    schedule: {
      title: `👉 ${kernel.dayReference}更适合先稳后动，安排上要有顺序`,
      sectionOne: {
        heading: '先做什么',
        content: [
          '从当天命理节奏看，适合先处理确认类、整理类、判断类事项，再推进需要表态或拍板的动作。',
          '建议你把最重要的事放在精力最稳的时段，不要把关键决定拖到情绪起伏大的时候。'
        ]
      },
      sectionTwo: {
        heading: '行动节奏',
        content: [
          '更适合一件一件推进，不宜同时摊开太多任务。',
          '如果要见人、汇报、沟通，建议放在状态渐稳之后，更容易拿到正面反馈。'
        ]
      },
      cautions: ['不要一早就把节奏拉得太满。', '避免临时改计划过多，容易打散判断力。'],
      closing: '一句话记住：先定顺序，再求效率。'
    },
    career: {
      title: `👉 ${kernel.dayReference}事业上更适合稳推进，不宜硬冲`,
      sectionOne: {
        heading: '推进方式',
        content: [
          '结合你的命理主线，这个时间点更有利于把条件谈清楚、边界讲明白，再争取机会。',
          '建议你优先展示可靠度和执行力，而不是一上来就过度表达野心。'
        ]
      },
      sectionTwo: {
        heading: '合作与表达',
        content: [
          '沟通上宜清晰、简练、留余地，太急着定结果反而容易让对方收紧。',
          '如果要谈合作或汇报，建议把重点放在“我能帮你解决什么”上。'
        ]
      },
      cautions: ['避免情绪化表达不满。', '不要因为一时反馈普通，就立刻否定整体机会。'],
      closing: '一句话记住：这一步更适合稳推进、稳拿分，而不是强冲。'
    },
    relationship: {
      title: `👉 ${kernel.dayReference}关系上更适合柔和靠近，不宜逼问`,
      sectionOne: {
        heading: '互动方式',
        content: [
          '从五行和时点看，这个时点更适合温和沟通、轻轻试探，不适合高压确认态度。',
          '建议你把语气放柔一点，把问题问短一点，让对方有空间回应。'
        ]
      },
      sectionTwo: {
        heading: '联系时机',
        content: [
          '如果想联系，可以优先选对方状态相对稳定的时段，不要卡在情绪高波动时。',
          '重点不是一次就把答案问死，而是看对方有没有回暖的连续迹象。'
        ]
      },
      cautions: ['少做试探式逼问。', '不要把一时冷淡直接等同于彻底无缘。'],
      closing: '一句话记住：更适合柔和靠近，看连续反馈。'
    },
    emotional: {
      title: `👉 ${kernel.dayReference}更适合先稳情绪，再做判断`,
      sectionOne: {
        heading: '情绪调节',
        content: [
          '你的命理主线在这个时点不适合硬压情绪，而是适合先把心神收回来。',
          '建议你先做减法，减少外界干扰，再决定要不要推进重要事项。'
        ]
      },
      sectionTwo: {
        heading: '恢复方式',
        content: [
          '更适合安静、规律、轻一点的节奏，先让状态回稳。',
          '可以优先选择散步、热水、清淡饮食或短时独处，而不是强行社交。'
        ]
      },
      cautions: ['避免在情绪最高点做决定。', '少接触会放大焦虑的人和信息。'],
      closing: '一句话记住：先把状态稳住，判断自然会清楚。'
    },
    general: {
      title: `👉 ${kernel.dayReference}这件事宜先辨势，再定动作`,
      sectionOne: {
        heading: '命理主线',
        content: [
          kernel.dayProfile,
          `当前更有利的五行倾向偏${kernel.favorableElements.join('、')}，不利因素要避开${kernel.unfavorableElements.join('、')}这类过强状态。`
        ]
      },
      sectionTwo: {
        heading: '落地建议',
        content: [
          '建议你先把最重要的那一步看清楚，再往下推进，不要被表面现象带着跑。',
          '如果你愿意把问题再说具体一点，我会继续按场景往下拆。'
        ]
      },
      cautions: ['不要急着下最后结论。', '先看重复出现的迹象，而不是一次性波动。'],
      closing: '一句话记住：先辨势，再动作，结果会更准。'
    }
  };

  const config = sceneConfig[scene];

  return {
    title: config.title,
    summary: `针对你问的“${question}”，结合你的基础命理信息和${kernel.dayReference}的时点判断，这次不适合只看抽象趋势，而要把建议落到“${sceneDisplayLabels[scene]}”这个具体场景里。`,
    metaphysics_basis: `${evidenceLabel}，当前更有利的五行倾向偏${kernel.favorableElements.join('、')}，整体节奏宜${kernel.tone}。`,
    sections: [
      {
        icon: '📍',
        heading: config.sectionOne.heading,
        content: config.sectionOne.content
      },
      {
        icon: scene === 'outfit' ? '🧥' : scene === 'food' ? '🥣' : scene === 'location' ? '🪑' : '💡',
        heading: config.sectionTwo.heading,
        content: config.sectionTwo.content
      }
    ],
    cautions: config.cautions,
    closing: config.closing
  };
};

const mapStructuredSceneAnswerToPayload = (
  answer: StructuredSceneAnswer,
  evidence: KnowledgeEvidence[]
): AnswerPayload => ({
  headline: answer.title,
  summary: `${answer.summary}\n\n🔮 命理依据\n${answer.metaphysics_basis}`,
  details: answer.sections.map(
    (section) => `${section.icon} ${section.heading}\n${section.content.map((item) => `- ${item}`).join('\n')}`
  ),
  guidance: [
    `⚠️ 注意事项\n${answer.cautions.map((item) => `- ${item}`).join('\n')}`,
    `✨ 收尾提醒\n${answer.closing}`
  ],
  evidence
});

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
  return mapStructuredSceneAnswerToPayload(buildFallbackSceneAnswer(consultation, question, evidence), evidence);
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
  private readonly metaphysicsAnswerService = new MetaphysicsAnswerService();

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

    return this.metaphysicsAnswerService.answerQuestion({
      consultation,
      question,
      retrievedDocs: evidence.map((item) => ({
        ...item,
        snippet: item.content.slice(0, 180)
      }))
    });
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

    return this.metaphysicsAnswerService.answerQuestion({
      consultation,
      question: message,
      retrievedDocs: evidence.map((item) => ({
        ...item,
        snippet: item.content.slice(0, 180)
      }))
    });
  }
}

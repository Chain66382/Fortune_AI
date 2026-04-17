import type { CurrentTimeContext, RagSearchResult, MetaphysicsContext } from './types';

const detectScene = (question: string) => {
  if (/穿什么|穿搭|衣服|颜色|配饰|发型/u.test(question)) {
    return 'outfit';
  }

  if (/吃什么|饮食|食物|口味|进补|喝什么/u.test(question)) {
    return 'food';
  }

  if (/座位|坐哪里|方位|位置|空间|工位|环境/u.test(question)) {
    return 'location';
  }

  if (/明天|今天|安排|顺序|什么时候|先做/u.test(question)) {
    return 'schedule';
  }

  if (/事业|工作|升职|合作|项目|机会|跳槽/u.test(question)) {
    return 'career';
  }

  if (/感情|关系|联系|沟通|对象|伴侣|约会/u.test(question)) {
    return 'relationship';
  }

  if (/情绪|焦虑|状态|压力|稳定/u.test(question)) {
    return 'emotional';
  }

  return 'general';
};

const renderRetrievedDocs = (documents: RagSearchResult[]) =>
  documents
    .map(
      (document, index) =>
        `${index + 1}. 来源：${document.sourceFile} / ${document.sectionTitle} / 分数 ${document.relevanceScore}\n时间标签：${
          document.timeReference || 'unknown'
        }${document.referencedYear ? ` / 引用年份 ${document.referencedYear}` : ''}${
          document.timeAdjustment?.action === 'downranked' ? ` / 已降权：${document.timeAdjustment.reason}` : ''
        }\n片段：${document.content}`
    )
    .join('\n\n');

export const buildPrompt = (input: {
  question: string;
  metaphysicsContext: MetaphysicsContext;
  retrievedDocs: RagSearchResult[];
  currentTimeContext: CurrentTimeContext;
}) => {
  const scene = detectScene(input.question);

  return {
    scene,
    prompt: `
你是 Fortune AI 的命理问答助手。你的回答必须同时满足两个约束：
1. 所有判断都要结合用户的命理资料与八字上下文。
2. 所有判断都要参考检索到的文档片段，不允许脱离文档空泛发挥。

时间有效性约束：
1. 当前系统日期是 ${input.currentTimeContext.currentDate}，当前年份是 ${input.currentTimeContext.currentYear}，当前月份是 ${input.currentTimeContext.currentMonth}，当前日期是 ${input.currentTimeContext.currentDay}。
2. 用户问题的时间范围是 ${input.currentTimeContext.userQuestionTimeScope}。
3. 所有回答必须以当前系统日期为时间基准，不允许把旧年份文档直接当成当前年份结论。
4. 如果检索片段明确引用了旧年份，例如 2025，而当前年份已经是 ${input.currentTimeContext.currentYear}，只能把它作为历史参考，不能直接复述为当前结论。
5. 如果用户问的是今天、明天、今年、明年或具体日期，你必须基于当前日期重新判断，再结合仍然有效的命理规则给出结论。

请返回 JSON：
{
  "title": "string",
  "summary": "string",
  "metaphysics_basis": "string",
  "sections": [
    { "icon": "emoji", "heading": "string", "content": ["string", "string"] },
    { "icon": "emoji", "heading": "string", "content": ["string", "string"] }
  ],
  "cautions": ["string", "string"],
  "closing": "string"
}

固定流程：
- 先读取用户命理资料和八字上下文
- 再理解问题场景
- 再引用检索文档
- 最后给出贴近场景的回答

输出要求：
1. 必须明确承接用户问题，不要讲空泛人生建议。
2. 必须在 metaphysics_basis 中点明你参考了哪些命理因素。
3. sections 必须贴近当前场景 ${scene}，例如穿搭要落到颜色/材质/配饰，饮食要落到食物属性/冷热/味型，位置要落到方位/环境/靠近谁。
4. 如果八字尚未生成，必须基于当前可用的出生资料继续分析，但不能假装已经算出完整八字。
5. 至少引用检索文档里的关键信息，不要忽略文档。
6. 用简体中文，结构清晰，适合前端直接渲染。
7. 如果文档中出现过时年份，请在 metaphysics_basis 或相关 section 里简短说明它只是历史参考，然后给出基于当前时间的重新判断。

用户命理资料：
- 昵称：${input.metaphysicsContext.displayName}
- 出生日期：${input.metaphysicsContext.birthDate}
- 农历出生：${input.metaphysicsContext.birthDateLunar}
- 出生时间：${input.metaphysicsContext.birthTime}
- 时区：${input.metaphysicsContext.timezone}
- 阴历/阳历：${input.metaphysicsContext.calendarType}
- 出生地：${input.metaphysicsContext.birthLocation}
- 当前城市：${input.metaphysicsContext.currentCity}
- UTC+8 标准化日期：${input.metaphysicsContext.normalizedBirthDateUtc8}
- UTC+8 标准化农历：${input.metaphysicsContext.normalizedBirthDateLunarUtc8}
- UTC+8 标准化时间：${input.metaphysicsContext.normalizedBirthTimeUtc8}
- 八字状态：${input.metaphysicsContext.bazi.status}
- 八字内容：${input.metaphysicsContext.bazi.value}
- 八字备注：${input.metaphysicsContext.bazi.notes}
- 年柱：${input.metaphysicsContext.bazi.pillars?.year || '待生成'}
- 月柱：${input.metaphysicsContext.bazi.pillars?.month || '待生成'}
- 日柱：${input.metaphysicsContext.bazi.pillars?.day || '待生成'}
- 时柱：${input.metaphysicsContext.bazi.pillars?.hour || '待生成'}
- 五行摘要：${input.metaphysicsContext.bazi.wuxingSummary || '待生成'}
- 命理摘要：${input.metaphysicsContext.bazi.summary || '待生成'}

当前时间上下文：
- 当前系统日期：${input.currentTimeContext.currentDate}
- 当前系统年份：${input.currentTimeContext.currentYear}
- 当前系统月份：${input.currentTimeContext.currentMonth}
- 当前系统日期号：${input.currentTimeContext.currentDay}
- 当前系统时区：${input.currentTimeContext.timeZone}
- 用户问题时间范围：${input.currentTimeContext.userQuestionTimeScope}

用户问题：
${input.question}

检索文档片段：
${renderRetrievedDocs(input.retrievedDocs)}
`
  };
};

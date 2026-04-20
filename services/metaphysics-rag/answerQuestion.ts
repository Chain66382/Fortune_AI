import { GeminiService } from '../ai/geminiService';
import { buildMetaphysicsContext } from './buildMetaphysicsContext';
import { buildPrompt } from './buildPrompt';
import { buildCurrentTimeContext } from './currentTimeContext';
import { buildDecisionStrategy, detectQuestionScene } from './decisionEngine';
import { ImageAnalysisService } from './imageAnalysisService';
import { loadUserProfile } from './loadUserProfile';
import type {
  AnswerQuestionInput,
  AttachmentAnalysisResult,
  DecisionStrategy,
  PremiumAnswerShape,
  QuestionScene
} from './types';
import type { AnswerPayload, ConsultationStageEvent } from '../../types/consultation';

const vaguePhrasePatterns = [/多沟通/u, /多反思/u, /提升自己/u, /保持稳重/u];
const actionHintPattern = /调整|安排|移动|改到|放在|避免|停止|开始|优先|减少|增加|观察|记录|联系|确认|执行|补充/u;
const timingRequiredPattern = /今天|明天|本周|本月|未来|天内|周内|上午|下午|晚上|全天|内/u;
const invalidTimingPattern = /下个窗口|近期|之后再看|后续再看|合适时机/u;
const analysisLeadPatterns = [/metaphysics主导/u, /主导/u, /按.*方式判断/u, /怎么判断/u, /怎么分析/u, /先分析/u, /先处理阻力点/u];
const locationResultPattern = /水边|湖边|河边|海边|咖啡馆|图书馆|公园|开阔|安静场所|靠窗|有靠背|视野/u;
const foodResultPattern = /汤|面|粥|米饭|热菜|清淡|温热|少冰|少辣|蛋白/u;
const outfitResultPattern = /米白|卡其|深蓝|灰|白|黑|配色|穿|外套|衬衫|针织|简洁/u;
const metaphysicsDataPattern = /年柱|月柱|日柱|时柱|日主|五行分布|较旺|较弱/u;
const metaphysicsReasonPattern = /因为.*所以|因此|所以建议你|更适合/u;
const careerResultPattern = /推进|继续|暂停|先做|优先|合作能谈|事业/u;
const relationshipResultPattern = /联系|不联系|主动|先别主动|适合沟通|暂缓/u;
const emotionalResultPattern = /先稳住|先休息|先减压|先停下来|情绪/u;
const locationAdvicePattern = /水边|湖边|河边|公园|绿地|咖啡馆|图书馆|座位|靠背|靠窗|场所|地方|环境/u;
const foodAdvicePattern = /汤|面|粥|米饭|热菜|蔬菜|蛋|鱼|清淡|温热|少冰|少辣|蒸|煮|炒/u;
const outfitAdvicePattern = /米白|卡其|雾蓝|深灰|配饰|材质|外套|衬衫|针织|简洁|颜色|风格/u;
const careerAdvicePattern = /推进|优先|先做|方案|合作|汇报|节奏|关键一步|信息补齐/u;
const relationshipAdvicePattern = /联系|消息|主动|频率|回应|话题|沟通|表达/u;
const emotionalAdvicePattern = /减压|休息|散步|热水|停下来|安静|睡|情绪|状态/u;
const lifestyleStrategyLeakPatterns = [/策略/u, /方法论/u, /判断方式/u, /分析方式/u];
const nonCareerStrategyLeakPatterns = [
  /关键变量/u,
  /最小动作/u,
  /推进动作/u,
  /保守动作/u,
  /首轮调整/u,
  /加码/u,
  /观察反馈/u,
  /当前事项/u,
  /结果导向/u,
  /先处理最直接的一步/u
];

const hasConcreteAction = (value: string) => actionHintPattern.test(value);

const hasVaguePhraseWithoutAction = (value: string) =>
  vaguePhrasePatterns.some((pattern) => pattern.test(value)) && !hasConcreteAction(value);

const hasCompleteTiming = (value: string) =>
  timingRequiredPattern.test(value) && !invalidTimingPattern.test(value);

const hasResultFirstConclusion = (sceneType: QuestionScene, value: string) => {
  if (!value || analysisLeadPatterns.some((pattern) => pattern.test(value))) {
    return false;
  }

  switch (sceneType) {
    case 'location':
      return locationResultPattern.test(value);
    case 'food':
      return foodResultPattern.test(value);
    case 'outfit':
      return outfitResultPattern.test(value);
    case 'career':
    case 'schedule':
      return careerResultPattern.test(value);
    case 'relationship':
      return relationshipResultPattern.test(value);
    case 'emotional':
      return emotionalResultPattern.test(value);
    default:
      return true;
  }
};

const hasSceneTemplateLeak = (sceneType: QuestionScene, content: string) => {
  if (sceneType === 'career' || sceneType === 'schedule' || sceneType === 'general') {
    return false;
  }

  return (
    nonCareerStrategyLeakPatterns.some((pattern) => pattern.test(content)) ||
    lifestyleStrategyLeakPatterns.some((pattern) => pattern.test(content))
  );
};

const areRisksQualified = (sceneType: QuestionScene, items: string[]) => {
  if (items.some((item) => hasVaguePhraseWithoutAction(item))) {
    return false;
  }

  if (sceneType === 'location') {
    return items.every((item) => !analysisLeadPatterns.some((pattern) => pattern.test(item)));
  }

  return true;
};

const isMetaphysicsBasisQualified = (value: string) => {
  if (!value || !metaphysicsDataPattern.test(value) || !metaphysicsReasonPattern.test(value)) {
    return false;
  }

  const blocks = value
    .split(/\n\s*\n/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (blocks.length < 2) {
    return false;
  }

  return metaphysicsDataPattern.test(blocks[0]) && blocks.slice(1).some((block) => metaphysicsReasonPattern.test(block));
};

const isSceneBodyQualified = (sceneType: QuestionScene, result: PremiumAnswerShape) => {
  const adviceContent = result.actionable_advice.join('\n');
  const risksContent = result.risks.join('\n');
  const timingContent = result.timing_window.join('\n');
  const fullSceneContent = [adviceContent, risksContent, timingContent].join('\n');

  switch (sceneType) {
    case 'location':
      return locationAdvicePattern.test(fullSceneContent);
    case 'food':
      return foodAdvicePattern.test(fullSceneContent);
    case 'outfit':
      return outfitAdvicePattern.test(fullSceneContent);
    case 'career':
    case 'schedule':
      return careerAdvicePattern.test(fullSceneContent);
    case 'relationship':
      return relationshipAdvicePattern.test(fullSceneContent);
    case 'emotional':
      return emotionalAdvicePattern.test(fullSceneContent);
    default:
      return true;
  }
};

const isPremiumAnswerQualified = (result: PremiumAnswerShape, sceneType: QuestionScene) => {
  if (
    !result.title ||
    !result.one_line_conclusion ||
    !result.metaphysics_basis ||
    result.actionable_advice.length < 3 ||
    result.timing_window.length < 2 ||
    result.risks.length < 1 ||
    !result.closing_summary
  ) {
    return false;
  }

  if (result.actionable_advice.some((item) => hasVaguePhraseWithoutAction(item) || !hasConcreteAction(item))) {
    return false;
  }

  if (!isMetaphysicsBasisQualified(result.metaphysics_basis)) {
    return false;
  }

  if (!hasResultFirstConclusion(sceneType, result.one_line_conclusion)) {
    return false;
  }

  if (!isSceneBodyQualified(sceneType, result)) {
    return false;
  }

  if (!areRisksQualified(sceneType, result.risks)) {
    return false;
  }

  if (result.timing_window.some((item) => !hasCompleteTiming(item))) {
    return false;
  }

  const fullContent = [
    result.one_line_conclusion,
    result.metaphysics_basis,
    ...result.actionable_advice,
    ...result.timing_window,
    ...result.risks,
    result.closing_summary
  ].join('\n');

  if (hasSceneTemplateLeak(sceneType, fullContent)) {
    return false;
  }

  return true;
};

const buildRewritePrompt = (prompt: string, result: PremiumAnswerShape, sceneType: QuestionScene) => `
请重写下面这份回答，只输出 JSON，并严格修复以下问题：
1. 回答结构必须只有这 6 段：命理依据、一句话结论、3条具体建议、完整时间窗口、风险与避坑、简短总结。
2. 禁止空话：多沟通、多反思、提升自己、保持稳重，除非后面紧跟明确动作。
3. 时间窗口禁止出现“下个窗口”“近期”等占位词，必须完整。
4. 如果建议不具体，请改写成可执行动作。
5. 最终展示时必须先给命理依据，再给一句话结论，不能先用普通生活建议替代命理判断。
6. 语气必须像真人顾问，不要出现“当前时间基准”“主依据”“次级依据”“校准”“拼接答案”“首轮调整”“加码”“持续观察反馈”这类系统或工程化表达。
7. 时间窗口必须贴合用户问题场景，用自然、生活化的说法。
8. 命理依据必须分成两层：第一段先写完整八字与五行数据；第二段再解释“因为你的命理是XXX，所以建议你XXX”，而且解释必须和当前问题直接相关。
9. scene-template guard：
- 如果场景是 food / location / outfit / relationship / emotional，禁止出现这些项目推进类词：关键变量、最小动作、推进动作、保守动作、首轮调整、加码、观察反馈、当前事项、结果导向、先处理最直接的一步。
- 只有 career / schedule 场景才允许使用这类推进表达。
10. 不要把生活问题答成“策略、方法论、判断方式、分析方式”这类抽象表达。用户问什么，你就直接答什么。
${sceneType === 'location' ? '9. 当前是“去哪里”问题。虽然最终展示顺序是先命理依据，但一句话结论字段里仍必须直接给出地点类型建议，例如水边、安静场所、开阔空间、靠窗但不直冲通道的位置。禁止出现“metaphysics主导”“按xx方式判断”“先分析”这类话。' : ''}
${sceneType === 'food' ? '11. 当前是“吃什么”问题。一句话结论必须直接给出食物类型、食材方向或烹饪方式，不能只讲原则。具体建议里也必须出现具体食物、食材、做法或避免项，不能写成抽象方法论。' : ''}
${sceneType === 'outfit' ? '11. 当前是“穿什么”问题。一句话结论必须直接给出颜色、风格或穿搭方向，不能只讲抽象气场。具体建议里也必须出现颜色、材质、款式或配饰。' : ''}
${sceneType === 'career' || sceneType === 'schedule' ? '11. 当前是 career/project 类问题。一句话结论必须直接给出是继续推进、暂缓、还是优先处理哪一步。具体建议里要出现推进顺序、优先级或关键动作。' : ''}
${sceneType === 'relationship' ? '11. 当前是 relationship 问题。一句话结论必须直接回答要不要联系、适不适合主动，或先做什么。具体建议里要出现消息、频率、沟通方式或回应判断。' : ''}
${sceneType === 'emotional' ? '11. 当前是 emotional 问题。一句话结论必须直接回答先怎么稳住自己，不能变成抽象方法论。具体建议里要出现休息、减压、停下来、散步、热水、睡眠或减少刺激这类动作。' : ''}

原始任务要求：
${prompt}

当前不合格回答：
${JSON.stringify(result, null, 2)}
`;

const buildPromptPreview = (prompt: string) => {
  const startIndex = prompt.indexOf('用户命理资料：');
  return prompt.slice(startIndex >= 0 ? startIndex : 0, 1800);
};

const buildFallbackAnswer = (
  _question: string,
  sceneType: QuestionScene,
  strategy: DecisionStrategy,
  attachmentAnalysis: AttachmentAnalysisResult,
  prompt: string,
  input: AnswerQuestionInput,
  context: ReturnType<typeof buildMetaphysicsContext>,
  currentTimeContext: ReturnType<typeof buildCurrentTimeContext>
): AnswerPayload => {
  const baziDataSentence = [
    `年柱${context.bazi.pillars?.year || '待生成'}`,
    `月柱${context.bazi.pillars?.month || '待生成'}`,
    `日柱${context.bazi.pillars?.day || '待生成'}`,
    `时柱${context.bazi.pillars?.hour || '待生成'}`
  ].join('、');
  const wuxingSentence = context.bazi.wuxingSummary || '五行分布仍在整理中。';
  const directConclusion =
    sceneType === 'location'
      ? `一句话结论\n明天更适合去安静、视野开阔、最好临近水边或绿地的场所，比如靠湖公园、河边步道附近的咖啡馆，或采光稳定的图书馆。`
      : sceneType === 'food'
        ? `一句话结论\n明天更适合吃温热、清淡、现做的食物，比如热汤面、清炒蔬菜配米饭，或带汤水的家常餐。`
        : sceneType === 'outfit'
          ? `一句话结论\n明天更适合穿米白、卡其、雾蓝、深灰这一类干净稳妥的颜色，风格以简洁利落为主。`
          : sceneType === 'career' || sceneType === 'schedule'
            ? `一句话结论\n这件事更适合继续推进，但要先把最关键的一步排在前面，不要同时摊开太多动作。`
            : sceneType === 'relationship'
              ? `一句话结论\n现在可以联系，但更适合轻一点地主动，不适合一上来就追问结果。`
              : sceneType === 'emotional'
                ? `一句话结论\n你现在最适合先把状态稳下来，先减压、先收心，再处理外部问题。`
                : `一句话结论\n这件事更适合先把主线看清，再决定下一步怎么做。`;
  const basisBlock =
    sceneType === 'location'
      ? `命理依据\n${baziDataSentence}。日主为${context.bazi.pillars?.day?.charAt(0) || '待定'}，${wuxingSentence}\n\n你的命局更适合安静、开阔、节奏稳定的环境。因为你这次的命理状态更怕嘈杂和动线过乱，所以建议你明天优先去临水、绿地附近，或者视野舒服、能坐得住的地方。`
      : sceneType === 'food'
        ? `命理依据\n${baziDataSentence}。日主为${context.bazi.pillars?.day?.charAt(0) || '待定'}，${wuxingSentence}\n\n因为你当前的命理状态更适合温和、稳定、不刺激的节奏，所以在饮食上更适合温热、清淡、顺气的食物，而不是过冷、过辣、过腻的搭配。`
        : sceneType === 'outfit'
          ? `命理依据\n${baziDataSentence}。日主为${context.bazi.pillars?.day?.charAt(0) || '待定'}，${wuxingSentence}\n\n因为你当前的命理状态更适合稳、净、柔和的外在呈现，所以穿搭上更适合干净有质感的颜色和利落风格，不适合过花、过躁、过于抢眼的组合。`
          : sceneType === 'career' || sceneType === 'schedule'
            ? `命理依据\n${baziDataSentence}。日主为${context.bazi.pillars?.day?.charAt(0) || '待定'}，${wuxingSentence}\n\n因为你这次的命理重点在先稳住节奏、再推进结果，所以在项目和事业问题上更适合先排优先级、先做关键动作，而不是一口气同时推进所有方向。`
            : sceneType === 'relationship'
              ? `命理依据\n${baziDataSentence}。日主为${context.bazi.pillars?.day?.charAt(0) || '待定'}，${wuxingSentence}\n\n因为你当前的命理状态更适合柔和靠近、留一点余地，所以在关系问题上更适合轻一点地主动沟通，而不是逼问态度或一次把话说死。`
              : sceneType === 'emotional'
                ? `命理依据\n${baziDataSentence}。日主为${context.bazi.pillars?.day?.charAt(0) || '待定'}，${wuxingSentence}\n\n因为你现在的命理状态更怕外界刺激把心神打散，所以当下更适合先收心、先减压、先稳定自己的节奏，再去处理其他问题。`
                : `命理依据\n${baziDataSentence}。日主为${context.bazi.pillars?.day?.charAt(0) || '待定'}，${wuxingSentence}\n\n因为你现在的命理重点在顺势而为，所以建议你把选择放在更稳、更容易执行的方向上，不要一开始就把节奏拉得太满。`;
  const adviceBlock =
    sceneType === 'location'
      ? `具体建议\n- 优先把地点选在“有靠背、前方开阔、不过度嘈杂”的位置，到了现场先确认座位后方不是主通道。\n- 如果要见人或谈事，优先选择临水公园周边咖啡馆、安静书店或图书馆，不要选音乐太吵、动线太乱的商场中庭。\n- 明天出门前先确定一个主去处和一个备选去处，主去处负责停留，备选去处负责转场，避免临场乱换地方。`
      : sceneType === 'food'
        ? `具体建议\n- 明天优先选热汤、蒸煮、清炒这类做法，少碰冰饮、重辣、重油和空腹甜食。\n- 食材方向优先考虑米饭、面、鸡蛋、鱼、蔬菜和温热汤水，尽量吃现做的，不要随便凑合。\n- 如果只能外食，先选家常菜馆、汤面店或粥类，不要把第一餐放在炸物和冷饮上。`
        : sceneType === 'outfit'
          ? `具体建议\n- 颜色优先选米白、卡其、雾蓝、深灰这一类稳净配色，不要大面积用过艳的颜色。\n- 风格上尽量简洁利落，可以选有结构感的外套、衬衫、针织或垂感好的材质。\n- 配饰只留一个重点就够了，金属色或温润材质比夸张亮面更适合你。`
          : sceneType === 'career' || sceneType === 'schedule'
            ? `具体建议\n- 先把最关键的一步排到最前面，比如先确认合作边界、先做一版方案，或者先把信息补齐。\n- 这两天不要同时推进太多线，先把一个最有把握的动作做扎实，再决定后面的节奏。\n- 如果要沟通、汇报或谈合作，先准备清楚你的目标、底线和下一步方案，再去推进。`
            : sceneType === 'relationship'
              ? `具体建议\n- 如果要联系，先发轻一点的消息，比如问候、近况或一个自然的话题，不要一上来就追问关系定义。\n- 如果对方最近反应冷淡，先把频率放低一点，让互动恢复自然感，再慢慢推进。\n- 先看对方有没有连续回应和回暖迹象，再决定要不要更进一步表达。`
              : sceneType === 'emotional'
                ? `具体建议\n- 先把外部刺激减下来，先停掉让你更乱的信息流，给自己留一点安静空间。\n- 先做一个能让身体回稳的动作，比如热水、散步、吃点温热食物，或者早点休息。\n- 今天先不要逼自己把所有问题一次想明白，先把状态稳住，再处理具体事情。`
                : `具体建议\n- 先把最重要的问题单独拎出来，不要同时被太多杂事分散注意力。\n- 优先做最容易落地的一步，让局面先动起来，再看后面的变化。\n- 先顺着眼下最稳的方向走，不要为了快而把节奏打乱。`;
  const timingBlock =
    sceneType === 'location'
      ? `时间窗口\n- 明天全天都适合外出，下午更适合找地方坐下来停留，不用赶得太急。\n- 如果明天临时去不了，本周内也可以再安排一次，优先选白天光线稳定的时候。`
      : sceneType === 'food'
        ? `时间窗口\n- 明天早餐和午餐更适合按这个方向吃，尤其午餐最稳。\n- 如果明天没吃上，本周内也可以继续按温热清淡这个方向调整。`
        : sceneType === 'outfit'
          ? `时间窗口\n- 明天白天最适合按这个配色和风格来穿，见人、外出都比较顺。\n- 如果晚上还有安排，可以在原本基础上加一件外套，不用完全换风格。`
          : sceneType === 'career' || sceneType === 'schedule'
            ? `时间窗口\n- 这两天适合先把关键动作做掉，白天推进会更顺。\n- 如果这两天来不及，本周内也可以继续推进，但不要一直拖着不动。`
            : sceneType === 'relationship'
              ? `时间窗口\n- 这两天可以轻一点地联系，白天或傍晚比深夜更合适。\n- 如果这次没联系，本周内还可以再试一次，但不要连续追着发消息。`
              : sceneType === 'emotional'
                ? `时间窗口\n- 今天和明天最适合先稳状态，不要急着做重要决定。\n- 等情绪回落一点后，再处理外部问题会更清楚。`
                : `时间窗口\n- 最近这几天都适合先把最关键的一步做掉，白天处理会更顺。\n- 如果这两天来不及，本周内再补上也可以，但不要一拖再拖。`;
  const risksBlock =
    sceneType === 'location'
      ? `注意事项\n- 不要去过度封闭、过暗或正对主通道的位置，这类地方容易让状态发散。\n- 不要为了图热闹临时改去嘈杂场所，明天更适合稳定气场，而不是追求刺激感。`
      : sceneType === 'food'
        ? `注意事项\n- 不要空腹吃重辣、重油、重甜，也不要拿冰饮硬压状态。\n- 明天不适合为了提神临时乱吃，越乱越容易把状态带偏。`
        : sceneType === 'outfit'
          ? `注意事项\n- 不要一次堆太多亮点，过花或过艳的搭配容易让气场发散。\n- 不要为了显眼去选自己穿着不舒服的款式，稳比抢眼更重要。`
          : sceneType === 'career' || sceneType === 'schedule'
            ? `风险与避坑\n- 不要什么都想同时推进，这样最容易把判断力打散。\n- 没想清楚优先级之前，不要急着把话说满或把资源一次投出去。`
            : sceneType === 'relationship'
              ? `风险与避坑\n- 不要在情绪最上头的时候联系，也不要一上来就追问答案。\n- 不要把一时没有回应，直接理解成彻底没有机会。`
              : sceneType === 'emotional'
                ? `风险与避坑\n- 不要在最乱的时候做决定，也不要强行逼自己立刻恢复正常。\n- 少接触会放大焦虑的人和信息，先把刺激降下来。`
                : `风险与避坑\n- 不要只听理想命理方案，先服从现实条件。\n- 不要把历史案例当成当前结论原样照搬。`;
  const closingBlock =
    sceneType === 'location'
      ? `简短总结\n选对环境，比临时多跑几个地方更重要。`
      : sceneType === 'food'
        ? `简短总结\n吃对类型，比临时补一顿更重要。`
        : sceneType === 'outfit'
          ? `简短总结\n穿得稳、净、舒服，比一味抢眼更适合你。`
          : sceneType === 'career' || sceneType === 'schedule'
            ? `简短总结\n先把顺序排对，推进就不会乱。`
            : sceneType === 'relationship'
              ? `简短总结\n轻一点地主动，比急着要答案更有用。`
              : sceneType === 'emotional'
                ? `简短总结\n先把自己稳住，很多问题才会真的变简单。`
                : `简短总结\n先把最关键的一步做好，后面的事会顺很多。`;

  return {
    headline: `付费级${sceneType === 'location' ? '空间' : '命理'}判断`,
    summary: basisBlock,
    details: [
      directConclusion,
      adviceBlock,
      timingBlock
    ],
    guidance: [
      risksBlock,
      closingBlock
    ],
    evidence: input.retrievedDocs,
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
      retrievedDocuments: input.retrievedDocs.map((document) => ({
        sourceFile: document.sourceFile,
        sectionTitle: document.sectionTitle,
        score: document.relevanceScore,
        snippet: document.snippet,
        referencedYear: document.referencedYear ?? null,
        timeReference: document.timeReference || 'unknown',
        timeAdjustment: document.timeAdjustment || { action: 'none' as const }
      })),
      sceneType,
      strategy,
      imageUsed: attachmentAnalysis.imageSummaries.length > 0,
      primarySource: strategy.primarySource,
      imageAnalysis: {
        overallSummary: attachmentAnalysis.overallSummary,
        imageSummaries: attachmentAnalysis.imageSummaries.map((summary) => ({
          imageId: summary.imageId,
          fileName: summary.fileName,
          category: summary.category,
          summary: summary.summary,
          spatialHints: summary.spatialHints,
          structured: summary.structured as unknown as Record<string, unknown>
        }))
      },
      promptPreview: buildPromptPreview(prompt),
      modelOutput: {
        mode: 'fallback'
      }
    }
  };
};

const mapPremiumAnswer = (
  structured: PremiumAnswerShape,
  sceneType: QuestionScene,
  strategy: DecisionStrategy,
  attachmentAnalysis: AttachmentAnalysisResult,
  prompt: string,
  input: AnswerQuestionInput,
  context: ReturnType<typeof buildMetaphysicsContext>,
  currentTimeContext: ReturnType<typeof buildCurrentTimeContext>
): AnswerPayload => ({
  headline: structured.title,
  summary: `命理依据\n${structured.metaphysics_basis}`,
  details: [
    `一句话结论\n${structured.one_line_conclusion}`,
    `具体建议\n${structured.actionable_advice.map((item) => `- ${item}`).join('\n')}`,
    `时间窗口\n${structured.timing_window.map((item) => `- ${item}`).join('\n')}`
  ],
  guidance: [
    `${sceneType === 'location' ? '注意事项' : '风险与避坑'}\n${structured.risks.map((item) => `- ${item}`).join('\n')}`,
    `简短总结\n${structured.closing_summary}`
  ],
  evidence: input.retrievedDocs,
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
    retrievedDocuments: input.retrievedDocs.map((document) => ({
      sourceFile: document.sourceFile,
      sectionTitle: document.sectionTitle,
      score: document.relevanceScore,
      snippet: document.snippet,
      referencedYear: document.referencedYear ?? null,
      timeReference: document.timeReference || 'unknown',
      timeAdjustment: document.timeAdjustment || { action: 'none' as const }
    })),
    sceneType,
    strategy,
    imageUsed: attachmentAnalysis.imageSummaries.length > 0,
    primarySource: strategy.primarySource,
    imageAnalysis: {
      overallSummary: attachmentAnalysis.overallSummary,
      imageSummaries: attachmentAnalysis.imageSummaries.map((summary) => ({
        imageId: summary.imageId,
        fileName: summary.fileName,
        category: summary.category,
        summary: summary.summary,
        spatialHints: summary.spatialHints,
        structured: summary.structured as unknown as Record<string, unknown>
      }))
    },
    promptPreview: buildPromptPreview(prompt),
    modelOutput: structured as unknown as Record<string, unknown>
  }
});

export class MetaphysicsAnswerService {
  private readonly geminiService = new GeminiService();
  private readonly imageAnalysisService = new ImageAnalysisService();

  async answerQuestion(
    input: AnswerQuestionInput,
    onStage?: (stage: ConsultationStageEvent) => void | Promise<void>
  ): Promise<AnswerPayload> {
    await onStage?.({
      key: 'loading_profile',
      label: '正在读取用户资料',
      detail: `已载入 ${input.consultation.profile.displayName || '当前用户'} 的基础信息`
    });
    const { profile } = loadUserProfile(input.consultation);
    const sceneType = detectQuestionScene(input.question);
    const strategy = buildDecisionStrategy(sceneType, Boolean(input.attachedImages?.length));

    await onStage?.({
      key: 'normalizing_time',
      label: '正在标准化出生时间（UTC+8）'
    });
    const context = buildMetaphysicsContext(profile);
    await onStage?.({
      key: 'generating_bazi',
      label: '正在生成八字 / 命理摘要',
      detail: context.bazi.summary || context.bazi.notes
    });
    const currentTimeContext = buildCurrentTimeContext(input.question);

    await onStage?.({
      key: 'retrieving_docs',
      label: input.attachedImages?.length ? '正在解析图片与检索规则' : '正在检索知识库'
    });

    const attachmentAnalysis =
      input.attachedImages && input.attachedImages.length > 0
        ? await this.imageAnalysisService.analyzeImages(input.attachedImages, sceneType, input.question)
        : {
            overallSummary: '本轮没有附带图片。',
            imageSummaries: []
          };

    await onStage?.({
      key: 'building_prompt',
      label: '正在按权重组织判断依据',
      detail: `主依据：${strategy.primarySource} / 模式：${strategy.reasoningMode}`
    });

    const { prompt } = buildPrompt({
      question: input.question,
      metaphysicsContext: context,
      retrievedDocs: input.retrievedDocs,
      currentTimeContext,
      sceneType,
      strategy,
      attachedImages: input.attachedImages?.map((image) => ({
        id: image.id,
        fileName: image.fileName,
        category: image.category,
        mimeType: image.mimeType
      })),
      attachmentAnalysis
    });

    await onStage?.({
      key: 'calling_llm',
      label:
        input.attachedImages && input.attachedImages.length > 0
          ? '正在分析图片、命理与规则权重'
          : '正在综合命理与知识库内容',
      detail: `主依据 ${strategy.primarySource}，已整理 ${input.retrievedDocs.length} 条规则`
    });

    const result = await this.geminiService.generateStructuredJson<PremiumAnswerShape>(prompt, () => ({
      title: '',
      one_line_conclusion: '',
      metaphysics_basis: '',
      actionable_advice: [],
      timing_window: [],
      risks: [],
      closing_summary: ''
    }));

    const normalizedResult = isPremiumAnswerQualified(result, sceneType)
      ? result
      : await this.geminiService.generateStructuredJson<PremiumAnswerShape>(
          buildRewritePrompt(prompt, result, sceneType),
          () => result
        );

    await onStage?.({
      key: 'generating_answer',
      label: '正在生成付费级最终回答'
    });

    if (
      !isPremiumAnswerQualified(normalizedResult, sceneType)
    ) {
      return buildFallbackAnswer(input.question, sceneType, strategy, attachmentAnalysis, prompt, input, context, currentTimeContext);
    }

    return mapPremiumAnswer(normalizedResult, sceneType, strategy, attachmentAnalysis, prompt, input, context, currentTimeContext);
  }
}

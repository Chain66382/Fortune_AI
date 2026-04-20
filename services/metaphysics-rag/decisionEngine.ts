import type { DecisionStrategy, QuestionScene } from './types';

const sceneMatchers: Array<{ scene: QuestionScene; matcher: RegExp }> = [
  {
    scene: 'food',
    matcher: /吃什么|明天吃什么|适合吃什么|饮食怎么选|饮食|吃饭|食物|口味|进补|喝什么|早餐|午餐|晚餐|宵夜/u
  },
  {
    scene: 'location',
    matcher:
      /去哪里|去什么地方|哪里适合|适合去哪|适合去哪里|哪里更适合待着|坐哪里|座位|方位|位置|朝向|工位|办公室|空间|环境|房间|风水|布局/u
  },
  {
    scene: 'outfit',
    matcher: /穿什么|穿什么颜色|怎么穿|穿搭|衣服|颜色|配色|戴什么配饰|配饰|饰品|口红|妆容|发型|造型/u
  },
  {
    scene: 'career',
    matcher: /项目怎么推进|要不要继续做|事业怎么走|这个合作能不能谈|项目|推进|继续做|合作|事业|工作|升职|机会|跳槽|面试|汇报|客户|老板/u
  },
  {
    scene: 'relationship',
    matcher: /要不要联系他|该不该主动|这段关系怎么处理|怎么和对方沟通|联系他|联系她|联系对方|主动|关系|感情|对象|伴侣|约会|复合|沟通/u
  },
  {
    scene: 'emotional',
    matcher: /我现在很乱|情绪不好怎么办|怎么稳住自己|最近总是焦虑|情绪|焦虑|很乱|稳住自己|压力|低落|失眠|紧张|烦/u
  },
  {
    scene: 'schedule',
    matcher: /今天|明天|后天|什么时候|安排|顺序|先做什么|适合做什么|宜不宜|该不该出门/u
  }
];

export const detectQuestionScene = (question: string): QuestionScene => {
  const normalizedQuestion = question.trim().toLowerCase();
  return sceneMatchers.find((item) => item.matcher.test(normalizedQuestion))?.scene || 'general';
};

export const buildDecisionStrategy = (
  sceneType: QuestionScene,
  hasImages: boolean
): DecisionStrategy => {
  switch (sceneType) {
    case 'location':
      return {
        primarySource: hasImages ? 'image' : 'metaphysics',
        weights: {
          image: hasImages ? 0.6 : 0.1,
          metaphysics: 0.25,
          rag: 0.15
        },
        reasoningMode: hasImages ? 'visual-first' : 'metaphysics-first'
      };
    case 'outfit':
    case 'food':
    case 'relationship':
      return {
        primarySource: 'metaphysics',
        weights: {
          image: hasImages ? 0.15 : 0,
          metaphysics: 0.6,
          rag: 0.25
        },
        reasoningMode: 'metaphysics-first'
      };
    case 'career':
      return {
        primarySource: 'metaphysics',
        weights: {
          image: hasImages ? 0.1 : 0,
          metaphysics: 0.45,
          rag: 0.45
        },
        reasoningMode: 'hybrid-judgment'
      };
    default:
      return {
        primarySource: 'metaphysics',
        weights: {
          image: hasImages ? 0.1 : 0,
          metaphysics: 0.55,
          rag: 0.35
        },
        reasoningMode: 'metaphysics-first'
      };
  }
};

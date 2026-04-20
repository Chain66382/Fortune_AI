import fs from 'node:fs/promises';
import path from 'node:path';
import { GeminiService } from '@/services/ai/geminiService';
import type { UploadedAsset } from '@/types/consultation';
import type {
  AttachmentAnalysisResult,
  AttachmentAnalysisSummary,
  StructuredImageAnalysis
} from './types';

const fallbackStructuredAnalysis = (category: UploadedAsset['category']): StructuredImageAnalysis => ({
  spaceType: category === 'space' ? '待识别空间' : '辅助图片',
  mainObjects: category === 'space' ? ['书桌', '座椅', '窗户'] : ['人物主体', '辅助背景'],
  deskPosition: category === 'space' ? '需结合图像进一步确认' : '不适用',
  windowPosition: category === 'space' ? '需结合图像进一步确认' : '不适用',
  doorPosition: category === 'space' ? '需结合图像进一步确认' : '不适用',
  lighting: '需结合图像进一步确认',
  clutterLevel: '中等',
  orientationGuess: '待判断',
  fengshuiObservations:
    category === 'space'
      ? ['优先观察书桌与门窗关系', '优先观察采光与动线', '优先观察杂物集中区域']
      : ['将图片作为辅助线索，不替代命理主线']
});

const toBase64ImagePayload = async (image: UploadedAsset) => {
  const buffer = await fs.readFile(image.filePath);
  return {
    mimeType: image.mimeType || 'image/jpeg',
    base64Data: buffer.toString('base64')
  };
};

const buildImageAnalysisPrompt = (image: UploadedAsset, sceneType: string, userQuestion: string) => `
你是 Fortune AI 的视觉分析助手。请只根据当前图片，输出 JSON：
{
  "spaceType": "string",
  "mainObjects": ["string"],
  "deskPosition": "string",
  "windowPosition": "string",
  "doorPosition": "string",
  "lighting": "string",
  "clutterLevel": "string",
  "orientationGuess": "string",
  "fengshuiObservations": ["string", "string", "string"]
}

规则：
1. 不要输出 markdown，只输出 JSON。
2. 看不清楚时要明确写“无法确认”，不要编造。
3. 如果图片不是空间图，也要按可观察事实给出尽量保守的结构化结果。
4. 对风水问题，要优先关注门、窗、书桌、座位、床位、光线、杂物、动线。

问题场景：${sceneType}
用户问题：${userQuestion}
图片文件：${path.basename(image.fileName)}
图片分类：${image.category}
`;

export class ImageAnalysisService {
  private readonly geminiService = new GeminiService();

  async analyzeImages(
    images: UploadedAsset[],
    sceneType: string,
    userQuestion: string
  ): Promise<AttachmentAnalysisResult> {
    if (images.length === 0) {
      return {
        overallSummary: '本轮没有附带图片。',
        imageSummaries: []
      };
    }

    const imageSummaries = await Promise.all(
      images.map(async (image) => {
        const imagePayload = await toBase64ImagePayload(image).catch(() => null);
        const structured =
          imagePayload && this.geminiService.isEnabled()
            ? await this.geminiService.analyzeImages(
                buildImageAnalysisPrompt(image, sceneType, userQuestion),
                [imagePayload],
                () => fallbackStructuredAnalysis(image.category)
              )
            : fallbackStructuredAnalysis(image.category);

        const summary = buildSummary(structured, image.category);
        const spatialHints = structured.fengshuiObservations.slice(0, 3);

        return {
          imageId: image.id,
          fileName: image.fileName,
          category: image.category,
          summary,
          spatialHints,
          structured
        } satisfies AttachmentAnalysisSummary;
      })
    );

    return {
      overallSummary: `本轮共分析 ${imageSummaries.length} 张图片，已提取空间对象、门窗位置、采光、杂乱程度与风水观察点，可作为本次判断的现实依据。`,
      imageSummaries
    };
  }
}

const buildSummary = (analysis: StructuredImageAnalysis, category: UploadedAsset['category']) => {
  if (category === 'space') {
    return `空间类型偏向 ${analysis.spaceType}，主要可见 ${analysis.mainObjects.join('、') || '未识别主体'}，采光 ${analysis.lighting}，杂乱程度 ${analysis.clutterLevel}，朝向判断 ${analysis.orientationGuess}。`;
  }

  return `${analysis.mainObjects.join('、') || '图片主体'} 可作为辅助观察线索，当前更适合作为 ${category} 类问题的补充判断资料。`;
};

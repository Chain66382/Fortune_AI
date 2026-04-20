import type { UploadedAsset } from '@/types/consultation';

export interface AttachmentAnalysisSummary {
  imageId: string;
  fileName: string;
  category: UploadedAsset['category'];
  summary: string;
  spatialHints: string[];
}

export interface AttachmentAnalysisResult {
  overallSummary: string;
  imageSummaries: AttachmentAnalysisSummary[];
}

const categoryGuidance: Record<
  UploadedAsset['category'],
  {
    summary: string;
    hints: string[];
  }
> = {
  space: {
    summary: '用户提供了空间/环境图片，需要结合布局、采光、门窗、动线与大件家具位置做判断。',
    hints: ['观察书桌、床位、门窗关系', '关注采光强弱与遮挡', '关注空间动线是否拥挤']
  },
  face: {
    summary: '用户提供了面相图片，可作为气色、神态与状态判断的辅助线索。',
    hints: ['关注正脸与侧脸是否齐全', '关注光线是否影响观察', '只能作为辅助资料，不替代命理主线']
  },
  palm: {
    summary: '用户提供了手相图片，可作为走势判断的辅助资料。',
    hints: ['关注左右手是否齐全', '关注掌纹清晰度', '结合现实处境与命理背景一起判断']
  },
  other: {
    summary: '用户提供了补充图片资料，需要结合当前问题语境辅助判断。',
    hints: ['优先结合用户文字问题', '说明图片是辅助线索', '必要时引导用户补充更清晰图片']
  }
};

export const analyzeAttachments = (images: UploadedAsset[] = []): AttachmentAnalysisResult => {
  if (images.length === 0) {
    return {
      overallSummary: '本轮没有附带图片。',
      imageSummaries: []
    };
  }

  const imageSummaries = images.map((image) => ({
    imageId: image.id,
    fileName: image.fileName,
    category: image.category,
    summary: categoryGuidance[image.category].summary,
    spatialHints: categoryGuidance[image.category].hints
  }));

  const categoryLabels = Array.from(new Set(images.map((image) => image.category))).join('、');

  return {
    overallSummary: `用户本轮上传了 ${images.length} 张图片，分类包含：${categoryLabels}。这些图片应与文字问题、命理资料和 RAG 证据一起综合判断。`,
    imageSummaries
  };
};

import { env } from '@/lib/env';
import type { KnowledgeEvidence } from '@/types/knowledge';

interface GeminiGenerateOptions {
  model?: string;
  prompt: string;
  responseMimeType?: 'application/json' | 'text/plain';
  pdfData?: {
    fileName: string;
    base64Data: string;
  };
}

interface FortuneAnswerShape {
  headline: string;
  summary: string;
  details: string[];
  guidance: string[];
}

interface FortuneReportShape {
  summary: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  actionItems: string[];
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const extractCandidateText = (payload: any): string => {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => {
      if (typeof part?.text === 'string') {
        return part.text;
      }

      return '';
    })
    .join('');
};

const extractOpenAiCompatText = (payload: any): string => {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part?.text === 'string') {
          return part.text;
        }

        if (typeof part === 'string') {
          return part;
        }

        return '';
      })
      .join('');
  }

  return '';
};

const extractJsonCandidate = (value: string): string => {
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1).trim();
  }

  return value.trim();
};

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(extractJsonCandidate(value)) as T;
  } catch {
    return null;
  }
};

const fallbackSnippet = (evidence: KnowledgeEvidence[]): string =>
  evidence
    .slice(0, 3)
    .map((item) => `${item.sectionTitle}：${item.content.slice(0, 60)}`)
    .join('；');

export class GeminiService {
  isEnabled(): boolean {
    return Boolean(env.aiCompatApiKey && env.aiCompatBaseUrl) || Boolean(env.geminiApiKey);
  }

  private async generateWithOpenAiCompat(options: GeminiGenerateOptions): Promise<string> {
    const response = await fetch(env.aiCompatBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aiCompatApiKey}`
      },
      body: JSON.stringify({
        model: options.model || env.aiCompatModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a structured assistant for a Chinese fortune consultation product. Always follow the requested output format exactly. Prefer concise, highly readable Chinese answers with short sections, light emoji usage, and scan-friendly structure instead of long dense paragraphs.'
          },
          {
            role: 'user',
            content: options.prompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI-compatible request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    return extractOpenAiCompatText(payload);
  }

  private async generateWithGemini(options: GeminiGenerateOptions): Promise<string> {
    if (!env.geminiApiKey) {
      return '';
    }

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: options.prompt },
            ...(options.pdfData
              ? [
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: options.pdfData.base64Data
                    }
                  }
                ]
              : [])
          ]
        }
      ],
      generationConfig: {
        responseMimeType: options.responseMimeType || 'text/plain'
      }
    };

    const response = await fetch(
      `${GEMINI_BASE_URL}/${options.model || 'gemini-2.5-flash'}:generateContent?key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    return extractCandidateText(payload);
  }

  private async generate(options: GeminiGenerateOptions): Promise<string> {
    if (!this.isEnabled()) {
      return '';
    }

    if (env.aiCompatApiKey && env.aiCompatBaseUrl && !options.pdfData) {
      return this.generateWithOpenAiCompat(options);
    }

    return this.generateWithGemini(options);
  }

  async generateStructuredJson<T>(prompt: string, fallbackFactory: () => T): Promise<T> {
    if (!this.isEnabled()) {
      return fallbackFactory();
    }

    try {
      const raw = await this.generate({
        prompt,
        responseMimeType: 'application/json'
      });
      const parsed = safeJsonParse<T>(raw);
      return parsed || fallbackFactory();
    } catch (error) {
      console.error(error);
      return fallbackFactory();
    }
  }

  async generateFortuneAnswer(
    prompt: string,
    evidence: KnowledgeEvidence[],
    fallbackFactory: () => FortuneAnswerShape
  ): Promise<FortuneAnswerShape> {
    if (!this.isEnabled()) {
      return fallbackFactory();
    }

    try {
      const raw = await this.generate({
        prompt,
        responseMimeType: 'application/json'
      });
      const parsed = safeJsonParse<FortuneAnswerShape>(raw);
      return parsed || fallbackFactory();
    } catch (error) {
      console.error(error);
      return {
        ...fallbackFactory(),
        summary: `${fallbackFactory().summary} 当前使用本地回退回答，已保留知识依据：${fallbackSnippet(evidence)}。`
      };
    }
  }

  async generateFortuneReport(
    prompt: string,
    evidence: KnowledgeEvidence[],
    fallbackFactory: () => FortuneReportShape
  ): Promise<FortuneReportShape> {
    if (!this.isEnabled()) {
      return fallbackFactory();
    }

    try {
      const raw = await this.generate({
        prompt,
        responseMimeType: 'application/json'
      });
      const parsed = safeJsonParse<FortuneReportShape>(raw);
      return parsed || fallbackFactory();
    } catch (error) {
      console.error(error);
      return {
        ...fallbackFactory(),
        summary: `${fallbackFactory().summary} 当前使用本地回退报告，知识依据摘要：${fallbackSnippet(evidence)}。`
      };
    }
  }

  async extractKnowledgeDocument(prompt: string, fileName: string, base64Data: string): Promise<string> {
    return this.generate({
      model: 'gemini-2.5-flash-lite',
      prompt,
      responseMimeType: 'application/json',
      pdfData: {
        fileName,
        base64Data
      }
    });
  }
}

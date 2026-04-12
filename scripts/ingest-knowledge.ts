import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

interface KnowledgeSection {
  sectionTitle: string;
  topicTags: string[];
  pageHint?: string;
  content: string;
}

interface KnowledgeDocument {
  id: string;
  sourceFile: string;
  sourceType: 'knowledge_file';
  documentTitle: string;
  overallThemes: string[];
  sections: KnowledgeSection[];
}

const projectRoot = process.cwd();
const knowledgeSourceDirectory = path.resolve(
  projectRoot,
  process.env.FORTUNE_KNOWLEDGE_SOURCE_DIR || './knowledgeFiles'
);
const knowledgeOutputDirectory = path.resolve(
  projectRoot,
  process.env.FORTUNE_KNOWLEDGE_DIR || './knowledge/processed'
);
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const aiCompatApiKey = process.env.FORTUNE_AI_API_KEY || '';
const aiCompatBaseUrl = process.env.FORTUNE_AI_BASE_URL || '';
const aiCompatModel = process.env.FORTUNE_AI_MODEL || 'gpt-4o-mini';

const createDocumentId = (fileName: string) =>
  path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const extractJson = <T>(rawText: string): T => {
  const trimmedText = rawText.trim();

  if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
    return JSON.parse(trimmedText) as T;
  }

  const fencedMatch = trimmedText.match(/```json\s*([\s\S]*?)```/i);

  if (!fencedMatch) {
    throw new Error('Gemini did not return JSON content.');
  }

  return JSON.parse(fencedMatch[1]) as T;
};

const buildPrompt = (fileName: string, extractedText: string) => `
你正在为一个中文玄学咨询产品整理知识库。请阅读下面从 PDF 提取出的正文，并返回 JSON：
{
  "documentTitle": "string",
  "overallThemes": ["string", "string", "string"],
  "sections": [
    {
      "sectionTitle": "string",
      "topicTags": ["string", "string", "string"],
      "pageHint": "string",
      "content": "string"
    }
  ]
}

要求：
1. 用简体中文。
2. 提取 10 到 18 个 section，覆盖文档最重要的主题。
3. 每个 content 使用 120 到 220 字，适合后续做 RAG 检索和问答。
4. 尽量保留原文核心观点，不要编造原书没有的概念。
5. pageHint 允许写成类似“约第12页”或“前半部分”。
6. 只返回 JSON，不要附加解释。

当前文件名：${fileName}

提取文本：
${extractedText}
`;

const runOpenAiCompat = async (prompt: string): Promise<string> => {
  const response = await fetch(aiCompatBaseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiCompatApiKey}`
    },
    body: JSON.stringify({
      model: aiCompatModel,
      messages: [
        {
          role: 'system',
          content:
            'You are a structured knowledge extraction assistant. Return valid JSON only and preserve the source document meaning.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible ingestion failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part: { text?: string } | string) => (typeof part === 'string' ? part : part.text || ''))
      .join('');
  }

  return '';
};

const runGemini = async (prompt: string, contextLabel: string): Promise<string> => {
  if (!geminiApiKey) {
    throw new Error('Either FORTUNE_AI_API_KEY or GEMINI_API_KEY is required for ingestion.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Gemini ingestion failed for ${contextLabel}: ${response.status} ${await response.text()}`
    );
  }

  const payload = await response.json();
  return (
    payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || '')
    .join('') || ''
  );
};

const callModel = async (fileName: string, extractedText: string): Promise<KnowledgeDocument> => {
  const prompt = buildPrompt(fileName, extractedText);
  const rawText =
    aiCompatApiKey && aiCompatBaseUrl
      ? await runOpenAiCompat(prompt)
      : await runGemini(prompt, fileName);
  const parsed = extractJson<{
    documentTitle: string;
    overallThemes: string[];
    sections: KnowledgeSection[];
  }>(rawText);

  return {
    id: createDocumentId(fileName),
    sourceFile: fileName,
    sourceType: 'knowledge_file',
    documentTitle: parsed.documentTitle,
    overallThemes: parsed.overallThemes,
    sections: parsed.sections
  };
};

const main = async () => {
  await fs.mkdir(knowledgeOutputDirectory, { recursive: true });
  const sourceFiles = await fs.readdir(knowledgeSourceDirectory);
  const pdfFiles = sourceFiles.filter((fileName) => fileName.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    throw new Error(`No PDF files found in ${knowledgeSourceDirectory}`);
  }

  for (const pdfFileName of pdfFiles) {
    const pdfPath = path.join(knowledgeSourceDirectory, pdfFileName);
    const pdfBuffer = await fs.readFile(pdfPath);
    const parser = new PDFParse({ data: pdfBuffer });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const extractedText = parsedPdf.text.replace(/\s+/g, ' ').trim();

    if (extractedText.length < 1000) {
      console.warn(`Skipped ${pdfFileName}: extracted text was too short for reliable ingestion.`);
      continue;
    }

    const document = await callModel(pdfFileName, extractedText.slice(0, 80_000));
    const outputFileName = `${createDocumentId(pdfFileName)}.json`;
    const outputPath = path.join(knowledgeOutputDirectory, outputFileName);

    await fs.writeFile(outputPath, JSON.stringify(document, null, 2), 'utf8');
    console.log(`Processed ${pdfFileName} -> ${outputFileName}`);
  }

  console.log(`Knowledge ingestion complete. Output directory: ${knowledgeOutputDirectory}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

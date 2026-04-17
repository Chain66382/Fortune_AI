import { env } from '../../lib/env';

const EMBEDDING_DIMENSION = 64;
const SPACE_REGEX = /\s+/g;
const NON_TEXT_REGEX = /[^\p{Script=Han}\p{Letter}\p{Number}]+/gu;
const HAN_REGEX = /[\p{Script=Han}]/gu;

const normalizeText = (input: string): string =>
  input.toLowerCase().replace(NON_TEXT_REGEX, ' ').replace(SPACE_REGEX, ' ').trim();

const extractTokens = (input: string): string[] => {
  const normalized = normalizeText(input);
  const latinTokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const hanCharacters = Array.from(input.matchAll(HAN_REGEX), (match) => match[0]);
  const hanTokens =
    hanCharacters.length < 2
      ? hanCharacters
      : hanCharacters.slice(0, -1).map((_, index) => `${hanCharacters[index]}${hanCharacters[index + 1]}`);

  return Array.from(new Set([...latinTokens, ...hanTokens]));
};

const hashToken = (token: string) => {
  let hash = 0;

  for (const character of token) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
};

const normalizeVector = (vector: number[]): number[] => {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
};

const buildDeterministicFallbackEmbedding = (input: string): number[] => {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);

  for (const token of extractTokens(input)) {
    const hash = hashToken(token);
    vector[hash % EMBEDDING_DIMENSION] += 1;
  }

  return normalizeVector(vector);
};

export class EmbeddingService {
  isConfigured(): boolean {
    return Boolean(env.embeddingApiKey && env.embeddingBaseUrl);
  }

  private async requestEmbeddings(inputs: string[]): Promise<number[][]> {
    const response = await fetch(env.embeddingBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.embeddingApiKey}`
      },
      body: JSON.stringify({
        model: env.embeddingModel,
        input: inputs
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const data = payload?.data;

    if (!Array.isArray(data)) {
      throw new Error('Embedding response did not contain a data array.');
    }

    return data.map((item) => item.embedding as number[]);
  }

  async embedTexts(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) {
      return [];
    }

    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'test') {
        return inputs.map(buildDeterministicFallbackEmbedding);
      }

      throw new Error('Embedding service is not configured. Set FORTUNE_AI_EMBEDDING_API_KEY and FORTUNE_AI_EMBEDDING_BASE_URL.');
    }

    const batchSize = 32;
    const vectors: number[][] = [];

    for (let index = 0; index < inputs.length; index += batchSize) {
      const batch = inputs.slice(index, index + batchSize);
      const batchVectors = await this.requestEmbeddings(batch);
      vectors.push(...batchVectors.map(normalizeVector));
    }

    return vectors;
  }

  async embedText(input: string): Promise<number[]> {
    const [vector] = await this.embedTexts([input]);
    return vector;
  }
}

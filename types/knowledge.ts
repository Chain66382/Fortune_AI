export type KnowledgeSourceType = 'knowledge_file' | 'supplemental';

export interface KnowledgeSection {
  sectionTitle: string;
  topicTags: string[];
  pageHint?: string;
  content: string;
}

export interface KnowledgeDocument {
  id: string;
  sourceFile: string;
  sourceType: KnowledgeSourceType;
  documentTitle: string;
  overallThemes: string[];
  sections: KnowledgeSection[];
}

export interface KnowledgeChunk {
  id: string;
  sourceFile: string;
  sourceType: KnowledgeSourceType;
  documentTitle: string;
  sectionTitle: string;
  topicTags: string[];
  pageHint?: string;
  content: string;
}

export interface KnowledgeEvidence {
  id: string;
  sourceFile: string;
  sectionTitle: string;
  pageHint?: string;
  content: string;
  relevanceScore: number;
}

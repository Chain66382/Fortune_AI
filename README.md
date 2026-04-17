# Fortune AI

Fortune AI is a premium divination consultation web app built with Next.js and TypeScript.

## Versioning

Project version control rules are documented in `VERSIONING.md`.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run ingest`
- `npm run rag:ingest`

## Environment

 Copy `.env.example` to `.env.local` and set:

- `FORTUNE_AI_API_KEY` + `FORTUNE_AI_BASE_URL` for chat generation
- `FORTUNE_AI_EMBEDDING_API_KEY` + `FORTUNE_AI_EMBEDDING_BASE_URL` for real embeddings

If your provider uses one key for both, you can reuse the same key.

## Knowledge Ingestion

Place source PDFs in `knowledgeFiles/`, then run `npm run ingest`.

The ingestion script produces normalized JSON files in `knowledge/processed/`.

Then run `npm run rag:ingest` to chunk documents, build embeddings, and write the vector index to `data/runtime/rag-index.json`.

## Deployment

Oracle Cloud Always Free deployment instructions are documented in [docs/DEPLOY_ORACLE.md](./docs/DEPLOY_ORACLE.md).

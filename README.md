# Fortune AI

Fortune AI is a premium divination consultation web app built with Next.js and TypeScript.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run ingest`

## Environment

Copy `.env.example` to `.env.local` and set either `FORTUNE_AI_API_KEY` + `FORTUNE_AI_BASE_URL`, or `GEMINI_API_KEY`.

## Knowledge Ingestion

Place source PDFs in `knowledgeFiles/`, then run `npm run ingest`.

The ingestion script produces normalized JSON files in `knowledge/processed/`.

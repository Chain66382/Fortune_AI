import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { ensureDirectory } from '@/lib/fs';
import { createId } from '@/lib/ids';
import { AppError } from '@/services/errors';
import type { AssetCategory, UploadedAsset } from '@/types/consultation';

const validCategories = new Set<AssetCategory>(['face', 'palm', 'space', 'other']);

const findUploadPath = async (assetId: string): Promise<string | null> => {
  const categories = ['face', 'palm', 'space', 'other'];

  for (const category of categories) {
    const directoryPath = path.join(env.uploadDir, category);

    try {
      const fileNames = await fs.readdir(directoryPath);
      const matchedFileName = fileNames.find((fileName) => fileName.startsWith(assetId));

      if (matchedFileName) {
        return path.join(directoryPath, matchedFileName);
      }
    } catch {
      continue;
    }
  }

  return null;
};

export const uploadController = {
  async uploadFile(request: Request) {
    const formData = await request.formData();
    const categoryValue = String(formData.get('category') || 'other') as AssetCategory;
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new AppError('File upload is required.');
    }

    const category = validCategories.has(categoryValue) ? categoryValue : 'other';
    const buffer = Buffer.from(await file.arrayBuffer());
    const assetId = createId('asset');
    const extension = path.extname(file.name) || '.bin';
    const directoryPath = path.join(env.uploadDir, category);
    const filePath = path.join(directoryPath, `${assetId}${extension}`);

    await ensureDirectory(directoryPath);
    await fs.writeFile(filePath, buffer);

    const uploadedAsset: UploadedAsset = {
      id: assetId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      filePath,
      publicUrl: `/api/uploads/${assetId}`,
      size: file.size,
      category,
      uploadedAt: new Date().toISOString()
    };

    return Response.json(uploadedAsset, { status: 201 });
  },

  async getUploadedFile(assetId: string) {
    const filePath = await findUploadPath(assetId);

    if (!filePath) {
      throw new AppError('Uploaded file not found.', 404);
    }

    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const mimeType =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.png'
          ? 'image/png'
          : extension === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';

    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};

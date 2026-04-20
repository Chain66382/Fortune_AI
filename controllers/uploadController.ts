import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { ensureDirectory } from '@/lib/fs';
import { createId } from '@/lib/ids';
import { AppError } from '@/services/errors';
import type { AssetCategory, UploadedAsset } from '@/types/consultation';

const validCategories = new Set<AssetCategory>(['face', 'palm', 'space', 'other']);
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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
  async uploadFiles(request: Request) {
    const formData = await request.formData();
    const categoryValue = String(formData.get('category') || 'other') as AssetCategory;
    const category = validCategories.has(categoryValue) ? categoryValue : 'other';
    const directoryPath = path.join(env.uploadDir, category);
    await ensureDirectory(directoryPath);
    const files = formData.getAll('files');
    const fallbackSingleFile = formData.get('file');
    const normalizedFiles = (
      files.length > 0 ? files : fallbackSingleFile ? [fallbackSingleFile] : []
    ).filter((entry): entry is File => entry instanceof File);
    const clientIds = formData
      .getAll('clientIds')
      .map((value) => String(value))
      .filter(Boolean);

    if (normalizedFiles.length === 0) {
      throw new AppError('File upload is required.');
    }

    const uploadedAssets: Array<UploadedAsset & { status: 'success'; clientId?: string }> = [];
    const failedUploads: Array<{
      clientId?: string;
      fileName: string;
      error: string;
      status: 'error';
    }> = [];

    for (const [index, file] of normalizedFiles.entries()) {
      const clientId = clientIds[index];

      try {
        if (!supportedMimeTypes.has(file.type)) {
          throw new AppError('图片格式不支持，请上传 JPG、PNG、WebP 或 GIF。');
        }

        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          throw new AppError('图片过大，请上传 10MB 以内的图片。');
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const assetId = createId('asset');
        const extension = path.extname(file.name) || '.bin';
        const filePath = path.join(directoryPath, `${assetId}${extension}`);

        await fs.writeFile(filePath, buffer);

        const publicUrl = `/api/uploads/${assetId}`;
        uploadedAssets.push({
          id: assetId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          filePath,
          publicUrl,
          url: publicUrl,
          thumbnailUrl: publicUrl,
          size: file.size,
          category,
          uploadedAt: new Date().toISOString(),
          status: 'success',
          clientId
        });
      } catch (error) {
        failedUploads.push({
          clientId,
          fileName: file.name,
          error: error instanceof Error ? error.message : '图片上传失败，请稍后重试。',
          status: 'error'
        });
      }
    }

    return Response.json(
      {
        success: failedUploads.length === 0,
        files: uploadedAssets,
        failed: failedUploads
      },
      {
        status: uploadedAssets.length > 0 ? 201 : 400
      }
    );
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

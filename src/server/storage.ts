import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

import { ApiError } from "@/server/http";

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const allowedFormats = new Set(["jpeg", "png", "webp"]);
let s3: S3Client | undefined;

function config() {
  const required = ["BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "REGION"] as const;
  for (const key of required) if (!process.env[key]) throw new Error(`${key} is not configured`);
  return {
    bucket: process.env.BUCKET!,
    endpoint: process.env.ENDPOINT!,
    region: process.env.REGION!,
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  };
}

function client() {
  if (!s3) {
    const value = config();
    s3 = new S3Client({
      region: value.region,
      endpoint: value.endpoint,
      forcePathStyle: process.env.S3_URL_STYLE === "path",
      credentials: { accessKeyId: value.accessKeyId, secretAccessKey: value.secretAccessKey },
    });
  }
  return s3;
}

export async function processAndUploadImage(file: File, listingId: string) {
  validateImageSize(file.size);
  const input = Buffer.from(await file.arrayBuffer());
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new ApiError(400, "Файл не является корректным изображением", "INVALID_IMAGE");
  }
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new ApiError(400, "Поддерживаются только JPEG, PNG и WebP", "INVALID_IMAGE_TYPE");
  }

  const id = crypto.randomUUID();
  const objectKey = `listings/${listingId}/${id}.webp`;
  const thumbnailKey = `listings/${listingId}/${id}-thumb.webp`;
  const full = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(input)
    .rotate()
    .resize(520, 360, { fit: "cover", position: "centre" })
    .webp({ quality: 78 })
    .toBuffer();
  const { bucket } = config();

  await Promise.all([
    client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: full.data,
        ContentType: "image/webp",
        CacheControl: "private, max-age=31536000, immutable",
      }),
    ),
    client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbnailKey,
        Body: thumb,
        ContentType: "image/webp",
        CacheControl: "private, max-age=31536000, immutable",
      }),
    ),
  ]);

  return {
    objectKey,
    thumbnailKey,
    width: full.info.width,
    height: full.info.height,
    size: full.info.size,
  };
}

export function validateImageSize(size: number) {
  if (size === 0 || size > MAX_IMAGE_SIZE) {
    throw new ApiError(400, "Размер фото должен быть от 1 байта до 10 МБ", "INVALID_IMAGE_SIZE");
  }
}

export async function signedImageUrl(key: string) {
  const { bucket } = config();
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 15 * 60,
  });
}

export async function deleteImageObjects(keys: string[]) {
  if (!keys.length) return;
  const { bucket } = config();
  await client().send(
    new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
  );
}

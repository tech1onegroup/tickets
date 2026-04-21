import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Local file storage fallback when S3 isn't configured
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const USE_LOCAL = !process.env.S3_ACCESS_KEY;

async function ensureUploadDir(subdir: string) {
  const dir = join(UPLOAD_DIR, subdir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  if (USE_LOCAL) {
    const parts = key.split("/");
    const filename = parts.pop()!;
    const subdir = parts.join("/");
    const dir = await ensureUploadDir(subdir);
    await writeFile(join(dir, filename), body);
    // Files under public/uploads are NOT served by Next.js at runtime in
    // production (public/ is static). Serve via the /api/files proxy instead.
    return `/api/files/${key}`;
  }

  // S3 upload for production
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    forcePathStyle: true,
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || "onegroup-portal",
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getPresignedUrl(key: string): Promise<string> {
  if (USE_LOCAL) {
    if (key.startsWith("/api/files/") || key.startsWith("/uploads/")) return key;
    return `/api/files/${key}`;
  }

  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    forcePathStyle: true,
  });

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET || "onegroup-portal",
      Key: key,
    }),
    { expiresIn: 3600 }
  );
}

export async function deleteFile(key: string): Promise<void> {
  if (USE_LOCAL) {
    const rel = key
      .replace(/^\/api\/files\//, "")
      .replace(/^\/uploads\//, "");
    const filePath = join(UPLOAD_DIR, rel);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist
    }
    return;
  }

  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    forcePathStyle: true,
  });

  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET || "onegroup-portal",
      Key: key,
    })
  );
}

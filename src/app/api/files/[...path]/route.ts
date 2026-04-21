import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { join, normalize, resolve } from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = resolve(process.cwd(), "public", "uploads");

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function mimeFromExt(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const relPath = path.map(decodeURIComponent).join("/");

  // Prevent directory traversal — resolve the path and make sure it stays under UPLOAD_DIR
  const fullPath = normalize(join(UPLOAD_DIR, relPath));
  if (!fullPath.startsWith(UPLOAD_DIR + "/") && fullPath !== UPLOAD_DIR) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stats = statSync(fullPath);
  if (!stats.isFile()) {
    return NextResponse.json({ error: "Not a file" }, { status: 400 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const downloadName = url.searchParams.get("name") || path[path.length - 1];

  const stream = createReadStream(fullPath);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  const contentType = mimeFromExt(fullPath);
  const safeName = downloadName.replace(/["\\]/g, "");

  return new Response(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Content-Disposition": `${
        download ? "attachment" : "inline"
      }; filename="${safeName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

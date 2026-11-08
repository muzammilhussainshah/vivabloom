import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rateLimit";

// SVG is deliberately excluded — it can carry embedded scripts, and this
// endpoint accepts arbitrary admin-uploaded files rather than admin-authored
// AI output. Store logos as raster images cover the real use case.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`upload-image:${session.user.email}`, {
    name: "upload-image",
    requests: 20,
    window: "60 s",
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not set. Add it to apps/admin/.env.local." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "'file' is required" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PNG, JPEG, WebP, or GIF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 5MB)." }, { status: 400 });
  }

  // Prefix is the caller's namespace (e.g. "stores", "blog") so uploads from
  // different forms don't collide and stay easy to browse in blob storage.
  const rawPrefix = formData.get("prefix");
  const prefix = typeof rawPrefix === "string" && /^[a-z0-9-]+$/.test(rawPrefix) ? rawPrefix : "uploads";
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  try {
    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("upload-image failed", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 502 });
  }
}

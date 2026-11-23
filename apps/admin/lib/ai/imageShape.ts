import sharp from "sharp";

/**
 * Crops a generated image to a landscape aspect ratio (default 16:9).
 *
 * Cloudflare's FLUX.1 schnell has no width/height option and always returns a
 * square image, so asking for "16:9" in the prompt alone never worked. The
 * crop keeps the most interesting region (sharp's "attention" strategy) and
 * never upscales; an image that is already wide enough is returned as is.
 */
export async function toLandscape(
  image: { data: Buffer; mimeType: string },
  ratio = 16 / 9
): Promise<{ data: Buffer; mimeType: string }> {
  const meta = await sharp(image.data).metadata();
  if (!meta.width || !meta.height) return image;
  if (meta.width / meta.height >= ratio - 0.02) return image;

  const width = meta.width;
  const height = Math.round(width / ratio);
  const data = await sharp(image.data)
    .resize({ width, height, fit: "cover", position: sharp.strategy.attention, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return { data, mimeType: "image/jpeg" };
}

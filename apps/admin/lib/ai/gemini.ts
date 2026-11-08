import { GoogleGenAI } from "@google/genai";
import { AI_MODELS } from "./prompts";
import { generateCloudflareImage, isCloudflareModel } from "./cloudflare";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to apps/admin/.env.local.");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Generates an image from a text prompt. The model defaults to the one in
 * lib/ai/prompts.ts (AI_MODELS.image) — edit it there to change/upgrade it.
 */
export async function generateImage(
  prompt: string,
  model: string = AI_MODELS.image.blogCover
): Promise<GeneratedImage> {
  if (isCloudflareModel(model)) return generateCloudflareImage(prompt, model);

  const ai = getClient();

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

 // 1. Get the parts from the response candidates
  const parts = response.candidates?.[0]?.content?.parts ?? [];

  // 2. Iterate through ALL parts to find the one containing 'inlineData'
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      return {
        data: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  // 3. If we reach here, no image was found. 
  // Log the text response to see if the model gave an explanation (e.g., safety block)
  const textResponse = parts.map(p => p.text).join("");
  throw new Error(
    `Gemini did not return an image. Model said: "${textResponse}"\nFull Response: ${JSON.stringify(response, null, 2)}`
  );
}

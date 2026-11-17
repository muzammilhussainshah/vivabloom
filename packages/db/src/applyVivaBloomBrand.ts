import dotenv from "dotenv";
import path from "node:path";
import { connectToDatabase } from "./connect";
import { SiteSetting, BlogPost } from "./models/index";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

/** One-off: applies the VivaBloom name + botanical green/terracotta theme to the existing SiteSetting and renames the default blog author. */
async function run() {
  await connectToDatabase();
  const s = await SiteSetting.updateMany(
    {},
    {
      $set: {
        siteName: "VivaBloom",
        "themeTokens.brandPrimary": "#1f6f5c",
        "themeTokens.brandSecondary": "#164f42",
        "themeTokens.brandAccent": "#c8553d",
        "themeTokens.surface": "#f7f8f5",
        "themeTokens.surfaceMuted": "#ffffff",
        "themeTokens.text": "#17201c",
        "themeTokens.textMuted": "#5f6b66",
        "themeTokens.border": "#e3e8e4",
        "themeTokens.footerBg": "#0f2a24",
      },
    }
  );
  const b = await BlogPost.updateMany({ author: "MonoCoupon" }, { $set: { author: "VivaBloom" } });
  console.log("settings modified:", s.modifiedCount, "posts modified:", b.modifiedCount);
  process.exit(0);
}
run();

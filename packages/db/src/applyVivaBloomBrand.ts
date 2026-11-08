import dotenv from "dotenv";
import path from "node:path";
import { connectToDatabase } from "./connect";
import { SiteSetting, BlogPost } from "./models/index";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

/** One-off: applies the VivaBloom name + rose/plum theme to the existing SiteSetting and renames the default blog author. */
async function run() {
  await connectToDatabase();
  const s = await SiteSetting.updateMany(
    {},
    {
      $set: {
        siteName: "VivaBloom",
        "themeTokens.brandPrimary": "#7c6cf0",
        "themeTokens.brandSecondary": "#5b4bd5",
        "themeTokens.brandAccent": "#c2379b",
        "themeTokens.surface": "#f7f8ff",
        "themeTokens.surfaceMuted": "#ffffff",
        "themeTokens.text": "#1e2440",
        "themeTokens.textMuted": "#6b7391",
        "themeTokens.border": "#e4e8f5",
        "themeTokens.footerBg": "#1f1b3d",
      },
    }
  );
  const b = await BlogPost.updateMany({ author: "MonoCoupon" }, { $set: { author: "VivaBloom" } });
  console.log("settings modified:", s.modifiedCount, "posts modified:", b.modifiedCount);
  process.exit(0);
}
run();

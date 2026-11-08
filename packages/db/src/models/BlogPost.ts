import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const BlogPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    excerpt: { type: String, default: "" },
    content: { type: String, required: true },
    coverImage: { type: String, default: null },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    tags: { type: [String], default: [] },
    author: { type: String, default: "VivaBloom" },
    status: { type: String, enum: ["draft", "published", "scheduled"], default: "draft" },
    publishedAt: { type: Date, default: null },
    seoTitle: { type: String, default: null },
    seoDescription: { type: String, default: null },
    ogImage: { type: String, default: null },
    relatedStores: [{ type: Schema.Types.ObjectId, ref: "Store" }],
    /** Mocked view count — seeded 100-150 on creation, bumped by /api/blog-views on real traffic. Not a real analytics figure. */
    views: { type: Number, default: () => 100 + Math.floor(Math.random() * 51) },
    /** The topic typed into the AI panel that produced this post — kept so content can be regenerated later. */
    aiTopic: { type: String, default: null },
    /** Products selected in the AI panel when generating this post, for the same reason as aiTopic. */
    aiProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    /** Lowercase BLOG_COUNTRIES code (@monocoupon/validation) selected in the AI panel, or null if generated without one. Kept for the same reason as aiTopic. */
    aiCountry: { type: String, default: null },
  },
  { timestamps: true }
);

BlogPostSchema.index({ title: "text", content: "text" });
BlogPostSchema.index({ status: 1, publishedAt: -1 });
BlogPostSchema.index({ tags: 1 });

export type IBlogPost = InferSchemaType<typeof BlogPostSchema>;

export const BlogPost: Model<IBlogPost> =
  (models.BlogPost as Model<IBlogPost>) ?? model<IBlogPost>("BlogPost", BlogPostSchema);

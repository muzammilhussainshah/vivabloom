import mongoose, { type InferSchemaType, type Model } from "mongoose";
const { Schema, model, models } = mongoose;

const ContactMessageSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    message: { type: String, required: true },
    status: { type: String, enum: ["new", "read"], default: "new" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ContactMessageSchema.index({ createdAt: -1 });

export type IContactMessage = InferSchemaType<typeof ContactMessageSchema>;

export const ContactMessage: Model<IContactMessage> =
  (models.ContactMessage as Model<IContactMessage>) ?? model<IContactMessage>("ContactMessage", ContactMessageSchema);

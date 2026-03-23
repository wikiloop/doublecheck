import mongoose, { Schema, type InferSchemaType } from "mongoose";

const revisionSchema = new Schema(
  {
    wiki: { type: String, required: true },
    revId: { type: Number, required: true },
    parentRevId: { type: Number, required: true },
    title: { type: String, required: true },
    timestamp: { type: String, required: true },
    user: { type: String, required: true },
    comment: { type: String, default: "" },
    pageId: { type: Number, required: true },
    diffHtml: { type: String },
  },
  { timestamps: true },
);

revisionSchema.index({ wiki: 1, revId: 1 }, { unique: true });

export type RevisionDocument = InferSchemaType<typeof revisionSchema>;

export const RevisionModel =
  mongoose.models.Revision ??
  mongoose.model("Revision", revisionSchema);

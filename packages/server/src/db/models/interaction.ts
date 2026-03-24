import mongoose, { Schema, type InferSchemaType } from "mongoose";

const wikiIdentitySchema = new Schema(
  {
    type: { type: String, enum: ["named", "temp", "anon"], required: true },
    username: { type: String, default: null },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const interactionSchema = new Schema(
  {
    // v5 fields
    revisionWiki: { type: String },
    revisionId: { type: Number },
    action: {
      type: String,
      enum: ["ShouldRevert", "NotSure", "LooksGood"],
    },
    userId: { type: String },
    identity: { type: wikiIdentitySchema },
    liftWingScore: {
      damaging: { type: Number },
      goodfaith: { type: Number },
      modelVersion: { type: String },
    },
    revertedByUser: { type: Boolean, default: false },
    // Legacy fields (read-only, for backward compat with old data)
    wikiRevId: { type: String },
    wikiUserName: { type: String },
    userGaId: { type: String },
    judgement: { type: String },
    timestamp: { type: Number },
    title: { type: String },
    wiki: { type: String },
    feed: { type: String },
  },
  { timestamps: true, strict: false },
);

interactionSchema.index({ revisionWiki: 1, revisionId: 1 });
interactionSchema.index({ userId: 1 });

export type InteractionDocument = InferSchemaType<typeof interactionSchema>;

export const InteractionModel =
  mongoose.models.Interaction ??
  mongoose.model("Interaction", interactionSchema, "Interaction");

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
    revisionWiki: { type: String, required: true },
    revisionId: { type: Number, required: true },
    action: {
      type: String,
      enum: ["ShouldRevert", "NotSure", "LooksGood"],
      required: true,
    },
    userId: { type: String, required: true },
    identity: { type: wikiIdentitySchema, required: true },
    liftWingScore: {
      damaging: { type: Number },
      goodfaith: { type: Number },
      modelVersion: { type: String },
    },
    revertedByUser: { type: Boolean, default: false },
  },
  { timestamps: true },
);

interactionSchema.index({ revisionWiki: 1, revisionId: 1 });
interactionSchema.index({ userId: 1 });

export type InteractionDocument = InferSchemaType<typeof interactionSchema>;

export const InteractionModel =
  mongoose.models.Interaction ??
  mongoose.model("Interaction", interactionSchema);

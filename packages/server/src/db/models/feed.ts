import mongoose, { Schema, type InferSchemaType } from "mongoose";

const feedSchema = new Schema(
  {
    name: { type: String, required: true },
    wiki: { type: String, required: true },
    filter: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

feedSchema.index({ name: 1 }, { unique: true });

export type FeedDocument = InferSchemaType<typeof feedSchema>;

export const FeedModel =
  mongoose.models.Feed ?? mongoose.model("Feed", feedSchema);

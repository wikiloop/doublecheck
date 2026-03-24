// Component prop and event interfaces — pure type contracts, no runtime code

import type {
  JudgementAction,
  LiftWingScore,
  RevertRiskScore,
  Revision,
} from "./models.js";

/** Props for the RevisionCard component. */
export interface RevisionCardProps {
  revision: Revision;
  revertRiskScore?: RevertRiskScore;
  liftWingScore?: LiftWingScore;
  liftWingLoading?: boolean;
  loading?: boolean;
}

/** Props for the DiffBox component. */
export interface DiffBoxProps {
  diffHtml: string;
  loading?: boolean;
}

/** Props for the ActionPanel component. */
export interface ActionPanelProps {
  revisionWiki: string;
  revisionId: number;
  disabled?: boolean;
  currentAction?: JudgementAction | null;
}

/** Emitted events for the ActionPanel component. */
export interface ActionPanelEmits {
  judge: [action: JudgementAction];
}

/** Props for the JudgementPanel component. */
export interface JudgementPanelProps {
  tallies: Record<JudgementAction, number>;
  userAction?: JudgementAction | null;
}

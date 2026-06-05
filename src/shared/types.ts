export type MatchedField = "text" | "username";

export type Settings = {
  enabled: boolean;
  keywords: string[];
  usernameKeywords: string[];
  whitelistHandles: string[];
};

export type TweetCandidate = {
  handle: string;
  usernameText: string;
  text: string;
  tweetUrl?: string;
  pageUrl?: string;
};

export type SkipDecision = {
  action: "skip";
  reason: string;
};

export type HideDecision = {
  action: "hide";
  handle: string;
  matchedKeyword: string;
  matchedField: MatchedField;
  textSample: string;
  tweetUrl: string;
};

export type Decision = SkipDecision | HideDecision;

export type LogEntry = {
  id: string;
  createdAt: number;
  level: "info" | "success" | "warning" | "error";
  type: string;
  handle?: string;
  matchedKeyword?: string;
  matchedField?: MatchedField;
  tweetUrl?: string;
  textSample?: string;
  message: string;
};

export type Stats = {
  filteredCount: number;
};

export type RuntimeMessage =
  | { type: "settings:get" }
  | { type: "settings:save"; payload: Partial<Settings> }
  | { type: "logs:add"; payload: HideDecision }
  | { type: "logs:get" }
  | { type: "logs:clear" }
  | { type: "content:stats" };

export type RuntimeResponse<T = unknown> =
  | { ok: true; payload: T }
  | { ok: false; error: string };

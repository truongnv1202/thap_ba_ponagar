export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "STUDENT" | "ADMIN";
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type GameQuestion = {
  runQuestionId: string;
  orderNo: number;
  questionId: string;
  content: string;
  choices: Array<{ id: string; content: string }>;
};

export type GameRunResponse = {
  runId: string;
  runAccessToken: string;
  status: string;
  timeLimitSec: number;
  questions: GameQuestion[];
};

export type LeaderboardItem = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  completionTimeSec: number;
  wonAt: string;
};

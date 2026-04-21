export const gameConfig = {
  defaultConfigCode: "default",
  defaultPuzzleCode: "ponagar-level-1",
  defaultTopic: "Thap Ba Ponagar",
  defaultDifficulty: 2,
  defaultQuestionsPerRun: 10,
  defaultTimeLimitSec: 180,
  defaultPieceCount: 12,
  defaultPuzzleName: "Thap Ba puzzle",
  levels: [
    { id: 1, nameKey: "levelName1" as const, puzzleCode: "ponagar-level-1", pieceCount: 4 },
    { id: 2, nameKey: "levelName2" as const, puzzleCode: "ponagar-level-2", pieceCount: 6 },
    { id: 3, nameKey: "levelName3" as const, puzzleCode: "ponagar-level-3", pieceCount: 9 },
    { id: 4, nameKey: "levelName4" as const, puzzleCode: "ponagar-level-4", pieceCount: 12 },
    { id: 5, nameKey: "levelName5" as const, puzzleCode: "ponagar-level-5", pieceCount: 16 },
  ],
} as const;

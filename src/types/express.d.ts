import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: "STUDENT" | "ADMIN";
        email: string;
      };
    }
  }
}

export {};

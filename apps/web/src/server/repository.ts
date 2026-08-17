import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  Application,
  CoverLetter,
  InterviewPrep,
  JobAnalysis,
  JobPosting,
  Resume,
  ResumeVersion,
  UserSettings,
} from "@job-ai/types";
import { DEFAULT_SETTINGS } from "@job-ai/types";
import { isSupabaseConfigured } from "./supabase.ts";
import { PrismaRepository } from "./repository.prisma.ts";

export interface UserData {
  resumes: Resume[];
  resumeVersions: ResumeVersion[];
  jobs: JobPosting[];
  analyses: JobAnalysis[];
  applications: Application[];
  coverLetters: CoverLetter[];
  interviewPreps: InterviewPrep[];
  settings: UserSettings;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export interface Repository {
  getUserData(userId: string): Promise<UserData>;
  updateUserData(
    userId: string,
    mutate: (data: UserData) => void | Promise<void>,
  ): Promise<UserData>;

  deleteUserData(userId: string): Promise<void>;
}

export function emptyUserData(): UserData {
  return {
    resumes: [],
    resumeVersions: [],
    jobs: [],
    analyses: [],
    applications: [],
    coverLetters: [],
    interviewPreps: [],
    settings: DEFAULT_SETTINGS,
  };
}

const DB_PATH = resolve(process.cwd(), ".data", "db.json");

interface DevDatabase {
  data: Record<string, UserData>;
}

class JsonFileRepository implements Repository {
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<DevDatabase> {
    try {
      return JSON.parse(await readFile(DB_PATH, "utf8")) as DevDatabase;
    } catch {
      return { data: {} };
    }
  }

  private async write(db: DevDatabase): Promise<void> {
    await mkdir(dirname(DB_PATH), { recursive: true });
    await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  }

  private transaction<T>(fn: (db: DevDatabase) => Promise<T> | T): Promise<T> {
    const next = this.queue.then(async () => {
      const db = await this.read();
      const result = await fn(db);
      await this.write(db);
      return result;
    });

    this.queue = next.catch(() => undefined);
    return next;
  }

  async getUserData(userId: string): Promise<UserData> {
    const db = await this.read();
    return db.data[userId] ?? emptyUserData();
  }

  async updateUserData(
    userId: string,
    mutate: (data: UserData) => void | Promise<void>,
  ): Promise<UserData> {
    return this.transaction(async (db) => {
      const data = db.data[userId] ?? emptyUserData();
      await mutate(data);
      db.data[userId] = data;
      return data;
    });
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.transaction((db) => {
      delete db.data[userId];
    });
  }
}

let instance: Repository | null = null;

export function getRepository(): Repository {
  if (!instance) {
    if (isSupabaseConfigured()) {
      instance = new PrismaRepository();
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "Supabase must be configured in production. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
      }
      console.warn(
        "[repository] Supabase is not configured — using the local .data/db.json development store.",
      );
      instance = new JsonFileRepository();
    }
  }
  return instance;
}

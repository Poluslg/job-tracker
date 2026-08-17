import type { JobAnalysis } from './analysis.ts';
import type { Application, CoverLetter, CoverLetterTone, InterviewPrep } from './application.ts';
import type { AIProviderId } from './ai.ts';
import type { JobExtractionResult, JobPosting } from './job.ts';
import type { Resume, ResumeVersion } from './resume.ts';
import type { UserSettings } from './user.ts';
import type { TailorChange } from './api.ts';

export type ExtMessage =
  
  | { type: 'JOB_DETECTED'; payload: JobExtractionResult }
  
  | { type: 'EXTRACT_JOB'; payload?: { force?: boolean } }
  | { type: 'START_MANUAL_SELECTION' }
  | { type: 'CANCEL_MANUAL_SELECTION' }
  
  | { type: 'GET_STATE' }
  | { type: 'GET_ACTIVE_JOB'; payload: { tabId?: number } }
  | { type: 'ANALYZE_JOB'; payload: { job: Partial<JobPosting>; useAI: boolean } }
  | { type: 'SAVE_JOB'; payload: { job: Partial<JobPosting>; track: boolean; analysisId?: string } }
  | { type: 'TAILOR_RESUME'; payload: { jobId: string; analysisId: string; acceptedIds: string[]; versionName: string } }
  | { type: 'GENERATE_COVER_LETTER'; payload: { jobId: string; tone: CoverLetterTone; extraContext?: string } }
  | { type: 'GENERATE_INTERVIEW_PREP'; payload: { jobId: string; applicationId?: string | null } }
  | { type: 'UPDATE_APPLICATION'; payload: { id: string; patch: Partial<Application> } }
  | { type: 'LIST_APPLICATIONS' }
  | { type: 'EXPORT_TRACKER'; payload: { format: 'csv' | 'xlsx' } }
  | { type: 'SAVE_RESUME'; payload: { fileName: string; fileType: 'pdf' | 'docx' | 'txt'; text: string; useAI: boolean } }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'TEST_AI_CONNECTION'; payload: { provider: AIProviderId; apiKey: string; model: string; baseUrl?: string } }
  | { type: 'CLEAR_LOCAL_DATA'; payload: { scope: 'all' | 'applications' | 'resumes' | 'ai-key' } }
  
  | { type: 'PROGRESS'; payload: { stage: AnalysisStage; label: string } };

export type AnalysisStage =
  | 'detecting'
  | 'extracting'
  | 'reading-resume'
  | 'comparing'
  | 'ats'
  | 'recommendations'
  | 'done';

export const STAGE_LABELS: Record<AnalysisStage, string> = {
  detecting: 'Detecting job…',
  extracting: 'Extracting requirements…',
  'reading-resume': 'Reading your resume…',
  comparing: 'Comparing skills…',
  ats: 'Analyzing ATS coverage…',
  recommendations: 'Generating recommendations…',
  done: 'Done',
};

export interface ExtResponseMap {
  JOB_DETECTED: { ok: true };
  EXTRACT_JOB: JobExtractionResult;
  START_MANUAL_SELECTION: { ok: true };
  CANCEL_MANUAL_SELECTION: { ok: true };
  GET_STATE: ExtensionState;
  GET_ACTIVE_JOB: { job: JobPosting | null; analysis: JobAnalysis | null };
  ANALYZE_JOB: { job: JobPosting; analysis: JobAnalysis };
  SAVE_JOB: { job: JobPosting; application: Application | null };
  TAILOR_RESUME: { version: ResumeVersion; changes: TailorChange[] };
  GENERATE_COVER_LETTER: { coverLetter: CoverLetter };
  GENERATE_INTERVIEW_PREP: { prep: InterviewPrep };
  UPDATE_APPLICATION: { application: Application };
  LIST_APPLICATIONS: { applications: Application[] };
  EXPORT_TRACKER: { fileName: string; mimeType: string; dataUrl: string };
  SAVE_RESUME: { resume: Resume };
  GET_SETTINGS: UserSettings;
  UPDATE_SETTINGS: UserSettings;
  TEST_AI_CONNECTION: { ok: boolean; message: string };
  CLEAR_LOCAL_DATA: { ok: true };
  PROGRESS: { ok: true };
}

export interface ExtensionState {
  hasResume: boolean;
  resumeLabel: string;
  onboarded: boolean;
  aiConfigured: boolean;
  provider: AIProviderId;
  demoMode: boolean;
  authMode: 'guest' | 'account';
  applicationCount: number;
}

export type ExtResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

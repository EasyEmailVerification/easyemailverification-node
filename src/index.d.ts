// Types for the Easy Email Verification Node.js client.

export declare const VERSION: string;
export declare const DEFAULT_BASE_URL: string;
/** Public test key: no account, no credits; verify, verifyBatch and credits only. */
export declare const SANDBOX_API_KEY: "eev_sandbox_key";
export declare const MAX_BATCH: 50;

export type Result = "valid" | "invalid" | "unknown";

export interface VerificationResult {
  email: string;
  result: Result;
  /** accepted_email, rejected_email, invalid_email, invalid_domain, no_mx_record, invalid_mx_record,
   * no_connect, timeout, unavailable_smtp, unexpected_error, temporarily_blocked, exceeded_storage.
   * New values may be added: treat unknown ones as inconclusive. */
  reason: string;
  disposable: boolean;
  accept_all: boolean;
  role: boolean;
  free: boolean;
  user: string | null;
  domain: string | null;
  mx_record: string | null;
  mx_domain: string | null;
  safe_to_send: boolean;
  /** Corrected address when a typo is detected, otherwise "". */
  did_you_mean: string;
  /** The request was processed; not a deliverability verdict. */
  success: boolean;
  message: string;
  http_code: string;
}

export interface Credits {
  success: boolean;
  credits_remaining: number;
  subscription_remaining: number;
  persistent_remaining: number;
  subscription_credits: number;
}

export interface BulkUploadAccepted {
  status: "accepted";
  list_id: string;
  filename: string;
  uploaded: number;
  message: string;
}

export type BulkJobStatusValue = "queued" | "processing" | "completed" | "failed" | "deleted" | "not_enough_credits" | "unknown";

export interface BulkJobStatus {
  list_id: string;
  status: BulkJobStatusValue;
  progress: number;
  started_at?: string | null;
  estimated_finish?: string | null;
  totals?: { total: number; processed: number; valid: number; invalid: number; unknown: number; [k: string]: number } | null;
}

export interface BulkJobList {
  status: "ok";
  total_lists: number;
  lists: BulkJobStatus[];
}

export type Decision = "accept" | "reject" | "suggest" | "review";

export declare class EEVError extends Error {
  /** HTTP status of the API error, or 0 when the client raised it. */
  status: number;
  body: unknown;
  constructor(message: string, status?: number, body?: unknown);
}

export declare function decide(result: VerificationResult): Decision;

export interface ClientOptions {
  /** Defaults to the EEV_API_KEY environment variable. */
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export declare class Bulk {
  upload(file: string | Uint8Array, options?: { filename?: string }): Promise<BulkUploadAccepted>;
  status(listId: string): Promise<BulkJobStatus>;
  list(): Promise<BulkJobList>;
  /** CSV with the header Email,Result,Reason,Disposable,AcceptAll,Role,Free,User,Domain,MXRecord,DomainMX,IsSafeToSend,DidYouMean,Success,Message,HttpCode */
  download(listId: string): Promise<string>;
  delete(listId: string): Promise<{ status: "deleted"; list_id: string; message: string }>;
  wait(listId: string, options?: { intervalMs?: number; timeoutMs?: number }): Promise<BulkJobStatus>;
}

export declare class EasyEmailVerification {
  constructor(options?: ClientOptions);
  readonly bulk: Bulk;
  verify(email: string): Promise<VerificationResult>;
  verifyBatch(emails: string[]): Promise<VerificationResult[]>;
  credits(): Promise<Credits>;
}

export default EasyEmailVerification;

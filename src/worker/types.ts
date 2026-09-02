export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T[]>>;
}

export interface D1Result<T = unknown> {
  results?: T;
  success: boolean;
  error?: string;
  meta?: any;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  APP_URL?: string;
  PHONEPE_ENV?: string;
  PHONEPE_CLIENT_ID?: string;
  PHONEPE_CLIENT_SECRET?: string;
  WHATSAPP_GATEWAY_URL?: string;
  CORS_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_NUMBER?: string;
  TWILIO_PHONE_NUMBER?: string;
}

export interface UserClaims {
  userId: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  permissions?: string[];
  exp: number;
}

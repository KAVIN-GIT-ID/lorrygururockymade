export const cleanEnvVar = (val: string): string => {
  if (!val) return '';
  return val.trim().replace(/^['"]|['"]$/g, '');
};

export const projectID = cleanEnvVar(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');
let rawEndpoint = cleanEnvVar(import.meta.env.VITE_APPWRITE_ENDPOINT || '');

if (rawEndpoint.startsWith('/') && typeof window !== 'undefined') {
  rawEndpoint = window.location.origin + rawEndpoint;
}

export const endpoint = rawEndpoint;

export const isAppwriteConfigured = () => {
  return !!projectID && !!endpoint;
};

export const getAppOrigin = (): string => {
  const envUrl = cleanEnvVar(import.meta.env.VITE_APP_URL || '');
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

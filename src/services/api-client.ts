import axios, { AxiosError, AxiosInstance } from "axios";
import { ROAM_API_V1, ROAM_API_V0 } from "../constants.js";

let apiKeyValue: string | undefined;

export function getApiKey(): string {
  if (!apiKeyValue) {
    apiKeyValue = process.env.ROAM_API_KEY;
  }
  if (!apiKeyValue) {
    throw new Error(
      "ROAM_API_KEY environment variable is required. " +
      "Create an API key in Roam Administration > Developer."
    );
  }
  return apiKeyValue;
}

function createClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

const v1Client = createClient(ROAM_API_V1);
const v0Client = createClient(ROAM_API_V0);

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getApiKey()}` };
}

export async function roamGet<T>(
  endpoint: string,
  params?: Record<string, unknown>,
  version: "v1" | "v0" = "v1"
): Promise<T> {
  const client = version === "v0" ? v0Client : v1Client;
  const response = await client.get<T>(endpoint, {
    params,
    headers: authHeaders(),
  });
  return response.data;
}

export async function roamPost<T>(
  endpoint: string,
  data?: unknown,
  version: "v1" | "v0" = "v1"
): Promise<T> {
  const client = version === "v0" ? v0Client : v1Client;
  const response = await client.post<T>(endpoint, data, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function roamPostRaw(
  endpoint: string,
  data?: unknown,
  version: "v1" | "v0" = "v1"
): Promise<string> {
  const client = version === "v0" ? v0Client : v1Client;
  const response = await client.post(endpoint, data, {
    headers: { ...authHeaders(), Accept: "application/x-ndjson" },
    responseType: "text",
  });
  return response.data as string;
}

export async function roamUpload<T>(
  endpoint: string,
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await v0Client.post<T>(endpoint, fileBuffer, {
    params,
    headers: {
      ...authHeaders(),
      "Content-Type": contentType,
      "X-Filename": filename,
    },
  });
  return response.data;
}

export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const body =
        typeof error.response.data === "string"
          ? error.response.data
          : JSON.stringify(error.response.data);

      switch (status) {
        case 400:
          return `Error: Bad request — ${body}. Check the parameters and try again.`;
        case 401:
          return "Error: Authentication failed. Verify your ROAM_API_KEY is correct and has the required scopes.";
        case 404:
          return "Error: Resource not found. Check that the ID or endpoint is correct.";
        case 429:
          return `Error: Rate limit exceeded. Roam allows 10 burst / 1 req/sec sustained. Retry after ${error.response.headers["retry-after"] ?? "a few"} seconds.`;
        default:
          return `Error: Roam API returned status ${status} — ${body}`;
      }
    }
    if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Try again or reduce the result set.";
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Vercel Blob evidence store — uploads audit evidence binaries (screenshots,
 * Playwright trace zips) when BLOB_READ_WRITE_TOKEN is available.
 *
 * Access mode: the register-artifact contract and src/lib/storage-contract.ts
 * declare evidence as private, so we TRY `access: "private"` first. The Blob
 * API hard-rejects private writes to a public store ("Cannot use private
 * access on a public store") — and the production `launchaudit-artifacts`
 * store is public — so on that specific error we fall back to
 * `access: "public"` with `addRandomSuffix: true` (unguessable URL). The
 * detected store mode is cached for the rest of the run.
 *
 * Report links: private blobs require auth to read, so we issue one read-only
 * signed token per run and presign a time-limited GET URL per artifact
 * (REPORT_LINK_TTL_MS). Public blobs link their URL directly. If neither is
 * available the report falls back to the local relative path, which always
 * exists — the runner writes evidence to disk in both modes.
 *
 * No token → no upload, no network calls; everything stays local. Upload
 * failures log one line and return null; an audit never dies on blob errors.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** How long presigned report links stay valid. Reports older than this fall back to local evidence files. */
const REPORT_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let envLoaded = false;

/**
 * Load `.env.local` into process.env once (cwd first, then the launchaudit
 * package root). Same file the platform reads its POSTGRES_URL /
 * BLOB_READ_WRITE_TOKEN from. Uses Node's built-in process.loadEnvFile
 * (>= 20.12); silently no-ops when the file or API is absent.
 */
export function loadLocalEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  const loader = (process as { loadEnvFile?: (file: string) => void }).loadEnvFile;
  if (typeof loader !== "function") return;
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local"),
  ];
  for (const file of candidates) {
    try {
      loader.call(process, file);
      return;
    } catch {
      /* file absent — try next candidate */
    }
  }
}

export function blobConfigured(): boolean {
  loadLocalEnv();
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Campaign/name → safe blob path segment. */
export function safeName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return cleaned || "audit";
}

export type BlobEvidence = {
  /** Pathname inside the store, e.g. launchaudit/my-site/2026-06-12.../TC-1.png */
  pathname: string;
  /** Raw blob URL (private — requires auth to fetch). Durable reference. */
  url: string;
  /** Presigned GET URL usable from a browser for REPORT_LINK_TTL_MS. Empty if presigning failed. */
  reportUrl: string;
};

type SignedToken = { delegationToken: string; clientSigningToken: string };

let cachedReadToken: SignedToken | null | undefined;

async function getReadToken(blob: typeof import("@vercel/blob")): Promise<SignedToken | null> {
  if (cachedReadToken !== undefined) return cachedReadToken;
  try {
    cachedReadToken = await blob.issueSignedToken({
      pathname: "*",
      operations: ["get"],
      validUntil: Date.now() + REPORT_LINK_TTL_MS,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  } catch (error) {
    console.error(`      (blob presign token unavailable — report links stay local: ${error instanceof Error ? error.message : String(error)})`);
    cachedReadToken = null;
  }
  return cachedReadToken;
}

/** Detected store access mode, cached after the first upload reveals it. */
let storeAccess: "private" | "public" = "private";

function isPublicStoreRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("private access on a public store");
}

/**
 * Upload one evidence file to `<remoteDir>/<basename>`. Tries private first
 * (the storage contract's preference); if the store is public-only, retries
 * as public with an unguessable random-suffix URL. Returns the durable
 * reference plus a browser-openable report link, or null on any failure
 * (logged, never thrown).
 */
export async function uploadEvidence(localPath: string, remoteDir: string): Promise<BlobEvidence | null> {
  if (!blobConfigured()) return null;
  try {
    const blob = await import("@vercel/blob");
    const content = await fs.readFile(localPath);
    const pathname = `${remoteDir}/${path.basename(localPath)}`;
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    let result;
    if (storeAccess === "private") {
      try {
        result = await blob.put(pathname, content, {
          access: "private",
          token,
          addRandomSuffix: false, // remoteDir already carries a per-run timestamp
          allowOverwrite: true,
        });
      } catch (error) {
        if (!isPublicStoreRejection(error)) throw error;
        storeAccess = "public";
        console.error(`      (blob store is public-only — uploading evidence as public with unguessable random-suffix URLs)`);
      }
    }
    if (!result) {
      // Public store: random suffix keeps evidence URLs unguessable.
      result = await blob.put(pathname, content, { access: "public", token, addRandomSuffix: true });
    }

    // Report link: public blob URLs open directly; private ones need a presigned GET URL.
    let reportUrl = storeAccess === "public" ? result.url : "";
    if (storeAccess === "private") {
      const signed = await getReadToken(blob);
      if (signed) {
        try {
          const presigned = await blob.presignUrl(signed, { operation: "get", pathname: result.pathname, access: "private" });
          reportUrl = presigned.presignedUrl;
        } catch {
          /* presign failed — report link falls back to the local file */
        }
      }
    }
    return { pathname: result.pathname, url: result.url, reportUrl };
  } catch (error) {
    console.error(`      (blob upload failed for ${path.basename(localPath)}: ${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

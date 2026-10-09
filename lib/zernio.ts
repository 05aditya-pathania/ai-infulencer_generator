import "server-only";

const ZERNIO_API_BASE = "https://zernio.com/api/v1";

export class ZernioApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ZernioApiError";
  }
}

export function getZernioSetup() {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  const appUrl = process.env.APP_URL?.trim();

  if (!apiKey) {
    return { configured: false as const, error: "ZERNIO_API_KEY is missing." };
  }

  if (!appUrl) {
    return { configured: false as const, error: "APP_URL is missing." };
  }

  let parsedAppUrl: URL;
  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    return { configured: false as const, error: "APP_URL must be an absolute URL." };
  }

  const isLocalhost =
    parsedAppUrl.hostname === "localhost" ||
    parsedAppUrl.hostname === "127.0.0.1";
  if (
    (parsedAppUrl.protocol !== "https:" && !isLocalhost) ||
    parsedAppUrl.pathname !== "/" ||
    parsedAppUrl.username ||
    parsedAppUrl.password ||
    parsedAppUrl.search ||
    parsedAppUrl.hash
  ) {
    return {
      configured: false as const,
      error: "APP_URL must be an HTTPS origin (HTTP is allowed for localhost).",
    };
  }

  return {
    configured: true as const,
    apiKey,
    appUrl: parsedAppUrl.origin,
    secureCookies: parsedAppUrl.protocol === "https:",
  };
}

async function zernioRequest(path: string, init: RequestInit = {}) {
  const setup = getZernioSetup();
  if (!setup.configured) {
    throw new Error(setup.error);
  }

  const response = await fetch(`${ZERNIO_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${setup.apiKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const message =
      typeof details === "object" &&
      details !== null &&
      "error" in details &&
      typeof details.error === "string"
        ? details.error
        : `Zernio returned HTTP ${response.status}.`;
    throw new ZernioApiError(message, response.status);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json() as Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProfileId(data: unknown) {
  if (!isRecord(data) || !isRecord(data.profile)) {
    return null;
  }

  const id = data.profile._id;
  return typeof id === "string" && id ? id : null;
}

async function findProfileByName(name: string) {
  const data = await zernioRequest(`/profiles?name=${encodeURIComponent(name)}`);
  if (!isRecord(data) || !Array.isArray(data.profiles)) {
    return null;
  }

  const profile = data.profiles.find(
    (item) => isRecord(item) && item.name === name && typeof item._id === "string",
  );
  return isRecord(profile) && typeof profile._id === "string"
    ? profile._id
    : null;
}

export async function findZernioProfile(userId: string) {
  return findProfileByName(`Postly ${userId}`);
}

async function createZernioProfile(userId: string) {
  const name = `Postly ${userId}`;
  let profileId: string | null = null;

  try {
    const result = await zernioRequest("/profiles", {
      method: "POST",
      headers: { "Idempotency-Key": `postly-profile-${userId}` },
      body: JSON.stringify({
        name,
        description: "Social accounts connected from Postly",
      }),
    });
    profileId = getProfileId(result);
  } catch (error) {
    if (!(error instanceof ZernioApiError) || error.status !== 409) {
      throw error;
    }
    profileId = await findProfileByName(name);
  }

  if (!profileId) {
    throw new Error("Zernio did not return a usable profile.");
  }

  return profileId;
}

export async function getOrCreateZernioProfile(userId: string) {
  const existingProfileId = await findZernioProfile(userId);
  return existingProfileId ?? createZernioProfile(userId);
}

export async function getZernioConnectUrl(
  platform: string,
  profileId: string,
  redirectUrl: string,
) {
  const query = new URLSearchParams({
    profileId,
    redirect_url: redirectUrl,
  });
  const result = await zernioRequest(
    `/connect/${encodeURIComponent(platform)}?${query.toString()}`,
  );
  if (!isRecord(result) || typeof result.authUrl !== "string") {
    throw new Error("Zernio did not return an authorization URL.");
  }

  const authUrl = new URL(result.authUrl);
  if (authUrl.protocol !== "https:") {
    throw new Error("Zernio returned an invalid authorization URL.");
  }

  return authUrl.toString();
}

export type ZernioAccount = {
  id: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
};

export async function getZernioAccount(
  profileId: string,
  accountId: string,
): Promise<ZernioAccount | null> {
  const query = new URLSearchParams({ profileId });
  const data = await zernioRequest(`/accounts?${query.toString()}`);
  if (!isRecord(data) || !Array.isArray(data.accounts)) {
    throw new Error("Zernio returned an invalid accounts response.");
  }

  const account = data.accounts.find(
    (item) => isRecord(item) && item._id === accountId,
  );
  if (!isRecord(account) || typeof account.platform !== "string") {
    return null;
  }

  const accountProfileId = isRecord(account.profileId)
    ? account.profileId._id
    : account.profileId;
  if (accountProfileId !== profileId) {
    return null;
  }

  let profileUrl: string | null = null;
  if (typeof account.profileUrl === "string") {
    try {
      const parsedProfileUrl = new URL(account.profileUrl);
      if (parsedProfileUrl.protocol === "https:") {
        profileUrl = parsedProfileUrl.toString();
      }
    } catch {
      // Do not persist malformed profile URLs returned by an upstream API.
    }
  }

  return {
    id: accountId,
    platform: account.platform,
    username: typeof account.username === "string" ? account.username : null,
    displayName:
      typeof account.displayName === "string" ? account.displayName : null,
    profileUrl,
  };
}

export async function disconnectZernioAccount(accountId: string) {
  await zernioRequest(`/accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
  });
}

export type ZernioPostTarget = {
  platform: string;
  accountId: string;
};

type ZernioPostDetails = {
  content: string;
  mediaUrl: string;
  targets: ZernioPostTarget[];
};

function getPostId(data: unknown) {
  if (!isRecord(data) || !isRecord(data.post)) {
    return null;
  }

  const id = data.post._id;
  return typeof id === "string" && id ? id : null;
}

function createPostBody(details: ZernioPostDetails) {
  return {
    content: details.content,
    mediaItems: [{ url: details.mediaUrl, type: "image" }],
    platforms: details.targets,
  };
}

export async function createZernioDraftPost(
  postId: string,
  details: ZernioPostDetails,
) {
  const data = await zernioRequest("/posts", {
    method: "POST",
    headers: { "Idempotency-Key": postId },
    body: JSON.stringify({ ...createPostBody(details), isDraft: true }),
  });
  const zernioPostId = getPostId(data);
  if (!zernioPostId) {
    throw new Error("Zernio did not return a usable post ID.");
  }

  return zernioPostId;
}

export async function updateZernioScheduledPost(
  zernioPostId: string,
  details: ZernioPostDetails,
  scheduledAt: string,
) {
  await zernioRequest(`/posts/${encodeURIComponent(zernioPostId)}`, {
    method: "PUT",
    body: JSON.stringify({
      ...createPostBody(details),
      isDraft: false,
      scheduledFor: new Date(scheduledAt).toISOString(),
      timezone: "UTC",
    }),
  });
}

export async function updateZernioDraftPost(
  zernioPostId: string,
  content: string,
) {
  await zernioRequest(`/posts/${encodeURIComponent(zernioPostId)}`, {
    method: "PUT",
    body: JSON.stringify({ content, isDraft: true }),
  });
}

export function combinePostCaption(caption: string, hashtags: string[]) {
  const uniqueHashtags = hashtags
    .map((hashtag) => hashtag.trim())
    .filter(Boolean)
    .filter((hashtag) => !caption.toLowerCase().includes(hashtag.toLowerCase()))
    .map((hashtag) => hashtag.startsWith("#") ? hashtag : `#${hashtag}`);
  return [caption.trim(), uniqueHashtags.join(" ")].filter(Boolean).join("\n\n");
}

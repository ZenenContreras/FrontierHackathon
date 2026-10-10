export interface RequestContext {
  token: string | null;
  stateKey: string;
}

const BEARER_PREFIX = "Bearer ";
const MISSING_TOKEN_KEY = "";

export function readBearerToken(header: string | undefined): string | null {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = header.slice(BEARER_PREFIX.length);
  if (token.length === 0) {
    return null;
  }

  return token;
}

export function readRequestContext(authorizationHeader: string | undefined): RequestContext {
  const token = readBearerToken(authorizationHeader);
  return {
    token,
    stateKey: token ?? MISSING_TOKEN_KEY,
  };
}

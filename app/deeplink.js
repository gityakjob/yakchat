const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const DEEP_LINK_HOSTS = new Set([
  'web.whatsapp.com',
  'api.whatsapp.com',
  'wa.me',
  'www.wa.me',
  'chat.whatsapp.com'
]);

const SHORT_RESOLVE_HOSTS = new Set([
  'api.whatsapp.com',
  'wa.me',
  'www.wa.me'
]);

const BARE_HOST_PREFIXES = [
  'api.whatsapp.com/',
  'wa.me/',
  'www.wa.me/',
  'chat.whatsapp.com/',
  'web.whatsapp.com/'
];

const SHORT_CODE_RE = /^[A-Za-z0-9_-]{4,64}$/;
const INVITE_CODE_RE = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * Validates that a URL belongs to an official WhatsApp origin allowed to hold permissions.
 * Uses strict URL parsing to prevent substring-sanitization bypasses.
 */
function isWhatsAppPermissionOrigin(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'web.whatsapp.com' ||
      host.endsWith('.whatsapp.com') ||
      host.endsWith('.whatsapp.net')
    );
  } catch {
    return false;
  }
}

/**
 * Checks if a URL can be loaded directly inside the main web.whatsapp.com BrowserWindow
 * without intercepting and resolving a /message/ or /qr/ shortlink first.
 */
function isDirectWebWhatsAppUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() !== 'web.whatsapp.com') return false;
    const pathLower = parsed.pathname.toLowerCase();
    if (pathLower.startsWith('/message/') || pathLower.startsWith('/qr/')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a URL is a supported WhatsApp deep link / click-to-chat / group invite URL.
 */
function isDeepLinkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const proto = parsed.protocol.toLowerCase();
    if (proto === 'whatsapp:') {
      return true;
    }
    if (proto === 'https:' || proto === 'http:') {
      return DEEP_LINK_HOSTS.has(parsed.hostname.toLowerCase());
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Normalizes user-entered URLs, host-relative links, or phone numbers into a supported URL.
 */
function normalizeUserInputToUrl(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (/^(whatsapp|https?):/i.test(trimmed)) {
    return isDeepLinkUrl(trimmed) ? trimmed : null;
  }

  const lower = trimmed.toLowerCase();
  if (BARE_HOST_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    const withScheme = `https://${trimmed}`;
    return isDeepLinkUrl(withScheme) ? withScheme : null;
  }

  if (/^\+?[\d\s\-().]{7,20}$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return `https://web.whatsapp.com/send?phone=${digits}`;
    }
  }

  return null;
}

/**
 * Extracts the first supported deep-link URL from process CLI arguments.
 */
function extractDeepLinkFromArgv(argv) {
  if (!Array.isArray(argv)) return null;
  for (const arg of argv.slice(1)) {
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    if (isDeepLinkUrl(arg)) {
      return arg.trim();
    }
  }
  return null;
}

function validateFinalWebUrl(candidateUrl) {
  if (!candidateUrl || typeof candidateUrl !== 'string') return null;
  try {
    const parsed = new URL(candidateUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname.toLowerCase() !== 'web.whatsapp.com') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, '&');
}

/**
 * Synchronously converts whatsapp:// (send, chat, accept) URIs to web.whatsapp.com URLs.
 */
function convertWhatsappSchemeToWebUrl(parsed) {
  const host = (parsed.hostname || '').toLowerCase();
  const pathSegments = (parsed.pathname || '').split('/').filter(Boolean);
  const action = host || (pathSegments[0] ? pathSegments[0].toLowerCase() : '');

  if (action === 'send') {
    return validateFinalWebUrl(`https://web.whatsapp.com/send${parsed.search || ''}`);
  }

  if (action === 'chat' || action === 'accept') {
    const code = parsed.searchParams.get('code');
    if (code && INVITE_CODE_RE.test(code)) {
      return validateFinalWebUrl(
        `https://web.whatsapp.com/accept?code=${encodeURIComponent(code)}`
      );
    }
    if (parsed.search) {
      return validateFinalWebUrl(`https://web.whatsapp.com/accept${parsed.search}`);
    }
    return 'https://web.whatsapp.com';
  }

  return null;
}

function preserveTextParam(resolvedUrl, originalParsed) {
  const origText = originalParsed.searchParams.get('text');
  if (!origText) return resolvedUrl;

  const finalParsed = new URL(resolvedUrl);
  const existingText = finalParsed.searchParams.get('text');
  if (!finalParsed.searchParams.has('text') || existingText === '') {
    finalParsed.searchParams.set('text', origText);
  }
  return finalParsed.toString();
}

/**
 * Resolves api.whatsapp.com/message/<CODE> (or /qr/<CODE>) and wa.me/message/<CODE> URLs
 * into their underlying https://web.whatsapp.com/send?... target URL.
 */
async function resolveShortMessageUrl(shortUrl, userAgent = DEFAULT_USER_AGENT) {
  let parsed;
  try {
    parsed = new URL(shortUrl);
  } catch {
    return null;
  }

  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }
  if (parsed.protocol !== 'https:') return null;
  if (!SHORT_RESOLVE_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const ua = userAgent || DEFAULT_USER_AGENT;
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  const chromeMajor = chromeMatch ? chromeMatch[1] : '140';

  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Sec-Ch-Ua': `"Chromium";v="${chromeMajor}", "Not=A?Brand";v="24", "Google Chrome";v="${chromeMajor}"`,
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': ua
    }
  });

  if (response.url) {
    try {
      const landed = new URL(response.url);
      if (
        landed.protocol === 'https:' &&
        landed.hostname.toLowerCase() === 'web.whatsapp.com' &&
        (landed.pathname.startsWith('/send') || landed.pathname.startsWith('/accept'))
      ) {
        return validateFinalWebUrl(preserveTextParam(landed.toString(), parsed));
      }
    } catch {
      // Ignore malformed response.url and continue parsing HTML body
    }
  }

  const html = await response.text();

  // Priority 1: Direct https://web.whatsapp.com/send... or /accept... link in HTML CTA
  const webLinkMatch = html.match(/https:\/\/web\.whatsapp\.com\/(?:send|accept)[^"'<\s\\]+/i);
  if (webLinkMatch) {
    const candidate = decodeHtmlEntities(webLinkMatch[0]);
    const valid = validateFinalWebUrl(candidate);
    if (valid) {
      return validateFinalWebUrl(preserveTextParam(valid, parsed));
    }
  }

  // Priority 2: Embedded whatsapp://send/... or whatsapp://chat... deep link in script payload
  const schemeMatch = html.match(/whatsapp:\\?\/\\?\/(?:send|chat|accept)[^"'<\s]+/i);
  if (schemeMatch) {
    const rawScheme = decodeHtmlEntities(schemeMatch[0].replace(/\\\//g, '/'));
    try {
      const schemeParsed = new URL(rawScheme);
      const converted = convertWhatsappSchemeToWebUrl(schemeParsed);
      if (converted) {
        return validateFinalWebUrl(preserveTextParam(converted, parsed));
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Resolves any supported WhatsApp URL (api.whatsapp.com, wa.me, chat.whatsapp.com,
 * whatsapp://, web.whatsapp.com) into a validated https://web.whatsapp.com URL.
 */
async function resolveToWebWhatsAppUrl(rawUrl, userAgent = DEFAULT_USER_AGENT) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const proto = parsed.protocol.toLowerCase();

  // 1. Custom whatsapp:// scheme
  if (proto === 'whatsapp:') {
    const direct = convertWhatsappSchemeToWebUrl(parsed);
    if (direct) return direct;

    const host = (parsed.hostname || '').toLowerCase();
    const segments = (parsed.pathname || '').split('/').filter(Boolean);

    let action = host;
    let code = segments[0] || '';
    if (!action && segments.length >= 2) {
      action = segments[0].toLowerCase();
      code = segments[1];
    }

    if ((action === 'message' || action === 'qr') && SHORT_CODE_RE.test(code)) {
      const search = parsed.search || '?autoload=1&app_absent=0';
      return resolveShortMessageUrl(
        `https://api.whatsapp.com/${action}/${encodeURIComponent(code)}${search}`,
        userAgent
      );
    }

    if (!action) {
      return 'https://web.whatsapp.com';
    }

    return 'https://web.whatsapp.com';
  }

  if (proto !== 'https:' && proto !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);
  const firstSeg = (segments[0] || '').toLowerCase();

  // 2. web.whatsapp.com
  if (host === 'web.whatsapp.com') {
    if ((firstSeg === 'message' || firstSeg === 'qr') && segments[1] && SHORT_CODE_RE.test(segments[1])) {
      const search = parsed.search || '?autoload=1&app_absent=0';
      return resolveShortMessageUrl(
        `https://api.whatsapp.com/${firstSeg}/${encodeURIComponent(segments[1])}${search}`,
        userAgent
      );
    }
    parsed.protocol = 'https:';
    return validateFinalWebUrl(parsed.toString());
  }

  // 3. api.whatsapp.com
  if (host === 'api.whatsapp.com') {
    if (firstSeg === 'send') {
      return validateFinalWebUrl(`https://web.whatsapp.com/send${parsed.search || ''}`);
    }
    if ((firstSeg === 'message' || firstSeg === 'qr') && segments[1] && SHORT_CODE_RE.test(segments[1])) {
      const search = parsed.search || '?autoload=1&app_absent=0';
      return resolveShortMessageUrl(
        `https://api.whatsapp.com/${firstSeg}/${encodeURIComponent(segments[1])}${search}`,
        userAgent
      );
    }
    return null;
  }

  // 4. wa.me / www.wa.me
  if (host === 'wa.me' || host === 'www.wa.me') {
    if ((firstSeg === 'message' || firstSeg === 'qr') && segments[1] && SHORT_CODE_RE.test(segments[1])) {
      const search = parsed.search || '?autoload=1&app_absent=0';
      return resolveShortMessageUrl(
        `https://api.whatsapp.com/${firstSeg}/${encodeURIComponent(segments[1])}${search}`,
        userAgent
      );
    }
    if (firstSeg === 'send') {
      return validateFinalWebUrl(`https://web.whatsapp.com/send${parsed.search || ''}`);
    }
    if (segments.length === 0) {
      return validateFinalWebUrl(`https://web.whatsapp.com/send${parsed.search || ''}`);
    }
    const digits = segments[0].replace(/\D/g, '');
    if (digits.length >= 6 && digits.length <= 15) {
      const target = new URL('https://web.whatsapp.com/send');
      for (const [k, v] of parsed.searchParams.entries()) {
        target.searchParams.append(k, v);
      }
      target.searchParams.set('phone', digits);
      return validateFinalWebUrl(target.toString());
    }
    return null;
  }

  // 5. chat.whatsapp.com group invite links
  if (host === 'chat.whatsapp.com') {
    const code = firstSeg === 'invite' ? segments[1] : segments[0];
    if (code && INVITE_CODE_RE.test(code)) {
      return validateFinalWebUrl(
        `https://web.whatsapp.com/accept?code=${encodeURIComponent(code)}`
      );
    }
    return null;
  }

  return null;
}

module.exports = {
  isWhatsAppPermissionOrigin,
  isDirectWebWhatsAppUrl,
  isDeepLinkUrl,
  normalizeUserInputToUrl,
  extractDeepLinkFromArgv,
  resolveShortMessageUrl,
  resolveToWebWhatsAppUrl
};

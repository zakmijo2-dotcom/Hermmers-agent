/**
 * Security & Safety Utilities
 * Protection against Path Traversal, Command Injection, SSRF, and Secret Leaks
 */

import { resolve, normalize, sep, isAbsolute } from 'path';
import { realpathSync, existsSync } from 'fs';
import { spawn, SpawnOptions } from 'child_process';
import { createHash } from 'crypto';

export class SecurityError extends Error {
  constructor(message: string, public readonly code: string = 'SECURITY_VIOLATION') {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * 1. PATH TRAVERSAL PROTECTION
 */

/**
 * Safely resolves a path and ensures it stays strictly within the workspaceRoot.
 * Prevents traversal via `../`, symlinks, or absolute paths outside the workspace.
 */
export function resolveSafePath(
  targetPath: string,
  workspaceRoot: string = process.cwd(),
  allowEscape: boolean = false
): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new SecurityError('Invalid path: path must be a non-empty string', 'INVALID_PATH');
  }

  // Null-byte injection check
  if (targetPath.includes('\0')) {
    throw new SecurityError('Path contains null bytes', 'NULL_BYTE_INJECTION');
  }

  const normalizedWorkspace = resolve(workspaceRoot);
  const resolvedTarget = isAbsolute(targetPath)
    ? normalize(targetPath)
    : resolve(normalizedWorkspace, targetPath);

  if (allowEscape) {
    return resolvedTarget;
  }

  // Canonicalize symlinks if paths exist
  let canonicalWorkspace = normalizedWorkspace;
  let canonicalTarget = resolvedTarget;

  try {
    if (existsSync(normalizedWorkspace)) {
      canonicalWorkspace = realpathSync(normalizedWorkspace);
    }
  } catch {
    // Keep normalized path if realpath fails
  }

  try {
    if (existsSync(resolvedTarget)) {
      canonicalTarget = realpathSync(resolvedTarget);
    }
  } catch {
    // Path might not exist yet (e.g. For writeFile), check parent directory
    let parent = resolve(resolvedTarget, '..');
    while (parent !== resolve(parent, '..')) {
      if (existsSync(parent)) {
        try {
          const canonicalParent = realpathSync(parent);
          const relativeChild = resolvedTarget.slice(parent.length);
          canonicalTarget = normalize(resolve(canonicalParent, '.' + relativeChild));
        } catch {
          // fallback
        }
        break;
      }
      parent = resolve(parent, '..');
    }
  }

  const isInside =
    canonicalTarget === canonicalWorkspace ||
    canonicalTarget.startsWith(canonicalWorkspace + sep);

  if (!isInside) {
    throw new SecurityError(
      `Access denied: Path "${targetPath}" resolves to "${canonicalTarget}", which is outside workspace "${canonicalWorkspace}"`,
      'PATH_TRAVERSAL'
    );
  }

  return canonicalTarget;
}

/**
 * 2. COMMAND INJECTION & PROCESS SAFETY
 */

export interface SafeExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface SafeExecOptions {
  cwd?: string;
  timeout?: number; // milliseconds (default 30,000)
  maxBuffer?: number; // max output size in bytes (default 1MB)
  env?: Record<string, string>;
  allowAllCommands?: boolean;
}

// Allowlist of pre-approved binary executables
export const SAFE_COMMAND_ALLOWLIST: Record<string, true> = {
  git: true,
  npm: true,
  node: true,
  npx: true,
  ls: true,
  dir: true,
  echo: true,
  cat: true,
  grep: true,
  find: true,
  which: true,
  where: true,
  diff: true,
  pwd: true,
  tsc: true,
  tsx: true
};

// Patterns that indicate malicious or destructive intent in command strings
export const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+(-[rfRF]+\s+)?[\/\\]/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
  />\s*\/dev\/sd[a-z]/i,
  /chmod\s+(-R\s+)?777\s+[\/\\]/i,
  /wget\s+.*\|\s*sh/i,
  /curl\s+.*\|\s*sh/i,
  /nc\s+-e/i,
  /bash\s+-i/i
];

/**
 * Executes a binary safely without shell interpolation.
 * Uses separate argument arrays and enforces timeouts and buffer limits.
 */
export async function safeSpawn(
  command: string,
  args: string[] = [],
  options: SafeExecOptions = {}
): Promise<SafeExecResult> {
  const {
    cwd = process.cwd(),
    timeout = 30000,
    maxBuffer = 1024 * 1024, // 1 MB
    env,
    allowAllCommands = false
  } = options;

  const binary = command.trim();

  // Validate command against allowlist if not unrestricted
  if (!allowAllCommands && !SAFE_COMMAND_ALLOWLIST[binary]) {
    throw new SecurityError(
      `Command "${binary}" is not in the safe command allowlist. Allowed: ${Object.keys(SAFE_COMMAND_ALLOWLIST).join(', ')}`,
      'COMMAND_NOT_ALLOWED'
    );
  }

  // Check arguments for dangerous shell patterns
  const fullCommandString = `${binary} ${args.join(' ')}`;
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(fullCommandString)) {
      throw new SecurityError(
        `Command rejected: matches dangerous command pattern ${pattern.toString()}`,
        'DANGEROUS_COMMAND'
      );
    }
  }

  const startTime = Date.now();
  const { promise, resolve: resolveResult, reject } = Promise.withResolvers<SafeExecResult>();

  const spawnOptions: SpawnOptions = {
    cwd,
    env: env || process.env,
    shell: false, // CRITICAL: prevent shell injection
    stdio: ['pipe', 'pipe', 'pipe']
  };

  let child;
  try {
    child = spawn(binary, args, spawnOptions);
  } catch (err) {
    reject(err);
    return promise;
  }

  let stdout = '';
  let stderr = '';
  let stdoutTruncated = false;
  let stderrTruncated = false;
  let isSettled = false;

  const timer = setTimeout(() => {
    if (!isSettled) {
      isSettled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      reject(new SecurityError(`Command timed out after ${timeout}ms: ${binary}`, 'COMMAND_TIMEOUT'));
    }
  }, timeout);

  child.stdout?.on('data', (data: Buffer) => {
    if (stdout.length < maxBuffer) {
      const remaining = maxBuffer - stdout.length;
      stdout += data.toString('utf-8', 0, remaining);
    } else if (!stdoutTruncated) {
      stdoutTruncated = true;
      stdout += '\n[Output truncated: maximum buffer limit reached]';
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    if (stderr.length < maxBuffer) {
      const remaining = maxBuffer - stderr.length;
      stderr += data.toString('utf-8', 0, remaining);
    } else if (!stderrTruncated) {
      stderrTruncated = true;
      stderr += '\n[Error output truncated: maximum buffer limit reached]';
    }
  });

  child.on('error', (err) => {
    if (!isSettled) {
      isSettled = true;
      clearTimeout(timer);
      reject(err);
    }
  });

  child.on('close', (exitCode) => {
    if (!isSettled) {
      isSettled = true;
      clearTimeout(timer);
      resolveResult({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? 0,
        duration: Date.now() - startTime
      });
    }
  });

  return promise;
}

/**
 * 3. SSRF & NETWORK SECURITY
 */

// Private IP address ranges (IPv4 & IPv6) and local domain names
const FORBIDDEN_HOSTS: Record<string, true> = {
  localhost: true,
  '127.0.0.1': true,
  '0.0.0.0': true,
  '::1': true,
  '::': true,
  'metadata.google.internal': true,
  'instance-data': true
};

/**
 * Checks if an IP or hostname is in private, link-local, or loopback range (SSRF guard).
 */
export function isPrivateOrLoopbackHost(host: string): boolean {
  const lower = host.toLowerCase().trim();

  if (FORBIDDEN_HOSTS[lower]) return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localhost')) return true;

  // Cloud metadata IP
  if (lower === '169.254.169.254') return true;

  // IPv4 regex checks
  const ipv4Match = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, aStr, bStr, cStr, dStr] = ipv4Match;
    const a = parseInt(aStr, 10);
    const b = parseInt(bStr, 10);
    const c = parseInt(cStr, 10);
    const d = parseInt(dStr, 10);

    if (a < 0 || a > 255 || b < 0 || b > 255 || c < 0 || c > 255 || d < 0 || d > 255) {
      return true; // invalid IP, block
    }

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (Link-local)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  // IPv6 loopback and unique local address
  if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL for HTTP requests, preventing SSRF and forbidden protocols.
 */
export function validateSafeUrl(rawUrl: string, allowPrivateNetwork: boolean = false): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SecurityError(`Invalid URL format: "${rawUrl}"`, 'INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SecurityError(`Forbidden URL protocol "${parsed.protocol}". Only http: and https: are allowed.`, 'FORBIDDEN_PROTOCOL');
  }

  if (!allowPrivateNetwork && isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new SecurityError(
      `SSRF Blocked: Request to private, link-local, or loopback address "${parsed.hostname}" is forbidden by default.`,
      'SSRF_PROTECTION'
    );
  }

  return parsed;
}

/**
 * Checks for sensitive headers that should not be transmitted without explicit authorization.
 */
export const SENSITIVE_HEADER_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /^api-key$/i,
  /^proxy-authorization$/i,
  /^x-auth-token$/i
];

export function checkSensitiveHeaders(headers?: Record<string, string>, allowSensitive: boolean = false): void {
  if (!headers || allowSensitive) return;

  for (const key of Object.keys(headers)) {
    for (const pattern of SENSITIVE_HEADER_PATTERNS) {
      if (pattern.test(key)) {
        throw new SecurityError(
          `Sending sensitive header "${key}" is forbidden without explicit security approval.`,
          'SENSITIVE_HEADER_BLOCKED'
        );
      }
    }
  }
}

/**
 * 4. ENVIRONMENT VARIABLE REDACTION & ALLOWLIST
 */

export const SAFE_ENV_ALLOWLIST: Record<string, true> = {
  NODE_ENV: true,
  PATH: true,
  LANG: true,
  LANGUAGE: true,
  LC_ALL: true,
  HOME: true,
  USER: true,
  LOGNAME: true,
  PWD: true,
  SHELL: true,
  TERM: true,
  TMPDIR: true,
  TEMP: true,
  TMP: true,
  CI: true,
  EDITOR: true,
  VISUAL: true,
  TZ: true,
  HEMMERS_HOME: true,
  HEMMERS_ENV: true
};

export const SENSITIVE_ENV_PATTERNS = [
  /_KEY$/i,
  /_SECRET$/i,
  /_TOKEN$/i,
  /_PASSWORD$/i,
  /_PASS$/i,
  /_AUTH$/i,
  /_CREDENTIALS?$/i,
  /PRIVATE/i,
  /OPENAI_/i,
  /ANTHROPIC_/i,
  /GOOGLE_API/i,
  /AWS_/i,
  /GITHUB_TOKEN/i,
  /DATABASE_URL/i,
  /DB_PASS/i
];

export function isSensitiveEnvKey(key: string): boolean {
  if (SAFE_ENV_ALLOWLIST[key]) return false;
  return SENSITIVE_ENV_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redacts secrets from data structures for audit logging.
 */
export function redactSecrets<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact Bearer tokens, API keys
    return data
      .replace(/Bearer\s+[A-Za-z0-9_\-\.]{10,}/gi, 'Bearer [REDACTED]')
      .replace(/(sk-[A-Za-z0-9_\-]{20,})/g, '[REDACTED_API_KEY]')
      .replace(/(key-[A-Za-z0-9_\-]{20,})/g, '[REDACTED_API_KEY]') as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSecrets(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (isSensitiveEnvKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSecrets(value);
      }
    }
    return result as T;
  }

  return data;
}

/**
 * 5. REQUEST HASHING & APPROVAL TOKENS
 */

export function computeRequestHash(action: string, resource: string, params: unknown): string {
  const canonicalPayload = JSON.stringify({
    action,
    resource,
    params: params ?? {}
  });
  return createHash('sha256').update(canonicalPayload).digest('hex');
}

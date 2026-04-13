/**
 * Server-side secret masking. Mask sensitive values before storing in DB.
 * Mirrors the client-side maskSecret but runs on the server.
 */
export function maskSecret(line) {
  if (!line || typeof line !== 'string') return line;

  // AWS keys
  line = line.replace(/(AKIA[0-9A-Z]{4})[0-9A-Z]{12,}/g, '$1************');
  // GitHub tokens
  line = line.replace(/(ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{4}[a-zA-Z0-9]*/g, '$1************...');
  // Stripe keys
  line = line.replace(/(sk_live_|pk_live_|sk_test_|pk_test_)[a-zA-Z0-9]{4}[a-zA-Z0-9]*/g, '$1************...');
  // OpenAI keys
  line = line.replace(/(sk-)[a-zA-Z0-9]{4}[a-zA-Z0-9]*/g, '$1************...');
  // SendGrid
  line = line.replace(/(SG\.)[a-zA-Z0-9._\-]{4}[a-zA-Z0-9._\-]*/g, '$1************...');
  // Slack tokens
  line = line.replace(/(xox[bpras]-)[a-zA-Z0-9\-]{4}[a-zA-Z0-9\-]*/g, '$1************...');
  // Database URIs - mask password
  line = line.replace(/((?:mongodb|postgres|postgresql|mysql|redis):\/\/[^:]+:)[^@]+(@)/gi, '$1********$2');
  // Generic long tokens (32+ hex/base64 chars after = or :)
  line = line.replace(/([=:]\s*['"]?)[a-zA-Z0-9+/]{32,}(['"]?\s*$)/g, '$1********...$2');

  return line;
}

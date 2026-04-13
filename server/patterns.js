// Secret detection patterns with metadata
// Each pattern has: id, name, regex (for local matching), searchQuery (for GitHub code search),
// severity (critical/high/medium/low), description

const patterns = [
  // AWS
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    regex: /(?:^|[^A-Z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/,
    searchQueries: ['AKIA'],
    severity: 'critical',
    description: 'AWS Access Key ID that could provide access to AWS services',
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Access Key',
    regex: /(?:aws_secret_access_key|aws_secret_key|secret_access_key|secretaccesskey)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i,
    searchQueries: ['aws_secret_access_key', 'aws_secret_key'],
    severity: 'critical',
    description: 'AWS Secret Access Key for authenticating AWS API requests',
  },
  // GitHub Tokens
  {
    id: 'github-pat',
    name: 'GitHub Personal Access Token',
    regex: /(?:^|[^a-zA-Z0-9_])(ghp_[a-zA-Z0-9]{36,})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['ghp_'],
    severity: 'critical',
    description: 'GitHub Personal Access Token with repository access',
  },
  {
    id: 'github-oauth',
    name: 'GitHub OAuth Access Token',
    regex: /(?:^|[^a-zA-Z0-9_])(gho_[a-zA-Z0-9]{36,})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['gho_'],
    severity: 'critical',
    description: 'GitHub OAuth Access Token',
  },
  {
    id: 'github-app-token',
    name: 'GitHub App Token',
    regex: /(?:^|[^a-zA-Z0-9_])(ghu_[a-zA-Z0-9]{36,}|ghs_[a-zA-Z0-9]{36,}|ghr_[a-zA-Z0-9]{36,})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['ghu_', 'ghs_', 'ghr_'],
    severity: 'critical',
    description: 'GitHub App installation or refresh token',
  },
  // Google
  {
    id: 'google-api-key',
    name: 'Google API Key',
    regex: /AIza[0-9A-Za-z\-_]{35}/,
    searchQueries: ['AIza'],
    severity: 'high',
    description: 'Google Cloud API key',
  },
  {
    id: 'google-oauth-secret',
    name: 'Google OAuth Client Secret',
    regex: /(?:client_secret|google_client_secret)\s*[=:]\s*['"]?([A-Za-z0-9_-]{24,})['"]?/i,
    searchQueries: ['google_client_secret', 'GOCSPX-'],
    severity: 'high',
    description: 'Google OAuth2 client secret',
  },
  // Slack
  {
    id: 'slack-token',
    name: 'Slack Token',
    regex: /xox[bporas]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/,
    searchQueries: ['xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
    severity: 'critical',
    description: 'Slack API token (bot, user, or app)',
  },
  {
    id: 'slack-webhook',
    name: 'Slack Webhook URL',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/,
    searchQueries: ['hooks.slack.com/services'],
    severity: 'high',
    description: 'Slack incoming webhook URL',
  },
  // Stripe
  {
    id: 'stripe-secret-key',
    name: 'Stripe Secret Key',
    regex: /(?:^|[^a-zA-Z0-9_])(sk_live_[a-zA-Z0-9]{24,})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['sk_live_'],
    severity: 'critical',
    description: 'Stripe live secret key with full API access',
  },
  {
    id: 'stripe-publishable-key',
    name: 'Stripe Publishable Key',
    regex: /(?:^|[^a-zA-Z0-9_])(pk_live_[a-zA-Z0-9]{24,})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['pk_live_'],
    severity: 'low',
    description: 'Stripe publishable key (limited risk, but indicates live environment)',
  },
  // Twilio
  {
    id: 'twilio-api-key',
    name: 'Twilio API Key',
    regex: /(?:twilio_api_key|twilio_auth_token|TWILIO_AUTH_TOKEN)\s*[=:]\s*['"]?([a-f0-9]{32})['"]?/i,
    searchQueries: ['TWILIO_AUTH_TOKEN', 'twilio_api_key'],
    severity: 'high',
    description: 'Twilio authentication token or API key',
  },
  // SendGrid
  {
    id: 'sendgrid-api-key',
    name: 'SendGrid API Key',
    regex: /(?:^|[^a-zA-Z0-9_])(SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['SG.'],
    severity: 'high',
    description: 'SendGrid API key for email service',
  },
  // Database Connection Strings
  {
    id: 'mongodb-uri',
    name: 'MongoDB Connection String',
    regex: /mongodb(\+srv)?:\/\/[^\s'"<>]+:[^\s'"<>]+@[^\s'"<>]+/,
    searchQueries: ['mongodb+srv://', 'mongodb://'],
    severity: 'critical',
    description: 'MongoDB connection URI with credentials',
  },
  {
    id: 'postgres-uri',
    name: 'PostgreSQL Connection String',
    regex: /postgres(ql)?:\/\/[^\s'"<>]+:[^\s'"<>]+@[^\s'"<>]+/,
    searchQueries: ['postgresql://', 'postgres://'],
    severity: 'critical',
    description: 'PostgreSQL connection URI with credentials',
  },
  {
    id: 'mysql-uri',
    name: 'MySQL Connection String',
    regex: /mysql:\/\/[^\s'"<>]+:[^\s'"<>]+@[^\s'"<>]+/,
    searchQueries: ['mysql://'],
    severity: 'critical',
    description: 'MySQL connection URI with credentials',
  },
  {
    id: 'redis-uri',
    name: 'Redis Connection String',
    regex: /redis:\/\/[^\s'"<>]*:[^\s'"<>]+@[^\s'"<>]+/,
    searchQueries: ['redis://'],
    severity: 'high',
    description: 'Redis connection URI with credentials',
  },
  // Private Keys
  {
    id: 'private-key-rsa',
    name: 'RSA Private Key',
    regex: /-----BEGIN RSA PRIVATE KEY-----/,
    searchQueries: ['BEGIN RSA PRIVATE KEY'],
    severity: 'critical',
    description: 'RSA private key, likely used for SSH or TLS',
  },
  {
    id: 'private-key-openssh',
    name: 'OpenSSH Private Key',
    regex: /-----BEGIN OPENSSH PRIVATE KEY-----/,
    searchQueries: ['BEGIN OPENSSH PRIVATE KEY'],
    severity: 'critical',
    description: 'OpenSSH private key',
  },
  {
    id: 'private-key-ec',
    name: 'EC Private Key',
    regex: /-----BEGIN EC PRIVATE KEY-----/,
    searchQueries: ['BEGIN EC PRIVATE KEY'],
    severity: 'critical',
    description: 'Elliptic Curve private key',
  },
  {
    id: 'private-key-pgp',
    name: 'PGP Private Key',
    regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    searchQueries: ['BEGIN PGP PRIVATE KEY BLOCK'],
    severity: 'critical',
    description: 'PGP private key block',
  },
  // Azure
  {
    id: 'azure-storage-key',
    name: 'Azure Storage Account Key',
    regex: /(?:AccountKey|azure_storage_key|AZURE_STORAGE_KEY)\s*[=:]\s*['"]?([A-Za-z0-9+/=]{88})['"]?/i,
    searchQueries: ['AccountKey=', 'AZURE_STORAGE_KEY'],
    severity: 'critical',
    description: 'Azure Storage account access key',
  },
  {
    id: 'azure-connection-string',
    name: 'Azure SQL Connection String',
    regex: /Server=tcp:[^;]+;.*Password=[^;]+/i,
    searchQueries: ['Server=tcp:', 'Password='],
    severity: 'critical',
    description: 'Azure SQL database connection string with password',
  },
  // Heroku
  {
    id: 'heroku-api-key',
    name: 'Heroku API Key',
    regex: /(?:heroku_api_key|HEROKU_API_KEY)\s*[=:]\s*['"]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"]?/i,
    searchQueries: ['HEROKU_API_KEY'],
    severity: 'high',
    description: 'Heroku platform API key',
  },
  // DigitalOcean
  {
    id: 'digitalocean-token',
    name: 'DigitalOcean Token',
    regex: /(?:^|[^a-zA-Z0-9_])(dop_v1_[a-f0-9]{64})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['dop_v1_'],
    severity: 'high',
    description: 'DigitalOcean personal access token',
  },
  // npm
  {
    id: 'npm-token',
    name: 'npm Access Token',
    regex: /(?:^|[^a-zA-Z0-9_])(npm_[a-zA-Z0-9]{36,})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['npm_'],
    severity: 'high',
    description: 'npm registry access token',
  },
  // JWT
  {
    id: 'jwt-secret',
    name: 'JWT Secret',
    regex: /(?:jwt_secret|JWT_SECRET|jwt_key|JWT_KEY)\s*[=:]\s*['"]([^'"]{8,})['"]?/i,
    searchQueries: ['JWT_SECRET', 'jwt_secret'],
    severity: 'high',
    description: 'JWT signing secret key',
  },
  // Generic Secrets
  {
    id: 'generic-api-key',
    name: 'Generic API Key',
    regex: /(?:api_key|apikey|api-key|API_KEY)\s*[=:]\s*['"]([a-zA-Z0-9_\-]{20,})['"]?/i,
    searchQueries: ['api_key=', 'API_KEY=', 'apikey='],
    severity: 'medium',
    description: 'Generic API key found in configuration',
  },
  {
    id: 'generic-secret',
    name: 'Generic Secret/Password',
    regex: /(?:password|passwd|secret|SECRET_KEY|ENCRYPTION_KEY)\s*[=:]\s*['"]([^'"]{8,})['"]?/i,
    searchQueries: ['password=', 'SECRET_KEY=', 'ENCRYPTION_KEY='],
    severity: 'medium',
    description: 'Hardcoded password or secret in configuration',
  },
  // Mailgun
  {
    id: 'mailgun-api-key',
    name: 'Mailgun API Key',
    regex: /(?:^|[^a-zA-Z0-9_])(key-[a-f0-9]{32})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['key-', 'MAILGUN_API_KEY'],
    severity: 'high',
    description: 'Mailgun API key',
  },
  // Firebase
  {
    id: 'firebase-key',
    name: 'Firebase API Key / Database URL',
    regex: /(?:firebase_api_key|FIREBASE_API_KEY)\s*[=:]\s*['"]?([A-Za-z0-9_-]{39})['"]?/i,
    searchQueries: ['FIREBASE_API_KEY', 'firebaseio.com'],
    severity: 'medium',
    description: 'Firebase configuration key',
  },
  // Shopify
  {
    id: 'shopify-token',
    name: 'Shopify Access Token',
    regex: /shpat_[a-fA-F0-9]{32}/,
    searchQueries: ['shpat_'],
    severity: 'high',
    description: 'Shopify Admin API access token',
  },
  // Discord
  {
    id: 'discord-token',
    name: 'Discord Bot Token',
    regex: /(?:discord_token|DISCORD_TOKEN|discord_bot_token)\s*[=:]\s*['"]?([A-Za-z0-9._-]{59,})['"]?/i,
    searchQueries: ['DISCORD_TOKEN', 'discord_bot_token'],
    severity: 'high',
    description: 'Discord bot authentication token',
  },
  // OpenAI
  {
    id: 'openai-api-key',
    name: 'OpenAI API Key',
    regex: /(?:^|[^a-zA-Z0-9_])(sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20})(?:[^a-zA-Z0-9_]|$)/,
    searchQueries: ['sk-', 'OPENAI_API_KEY'],
    severity: 'high',
    description: 'OpenAI API key',
  },
];

export default patterns;

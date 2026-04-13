import fetch from 'node-fetch';
import logger from './logger.js';

const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT = 15000;

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'SecretSweep',
  };
}

/**
 * Fetch with timeout and single retry on 5xx errors.
 */
async function resilientFetch(url, options = {}, retries = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });

    // Retry once on server errors
    if (res.status >= 500 && retries > 0) {
      logger.warn(`GitHub API 5xx (${res.status}) for ${new URL(url).pathname}, retrying...`);
      clearTimeout(timeout);
      await new Promise((r) => setTimeout(r, 1000));
      return resilientFetch(url, options, retries - 1);
    }

    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`GitHub API request timed out: ${new URL(url).pathname}`);
    }
    if (retries > 0) {
      logger.warn(`GitHub API network error for ${new URL(url).pathname}, retrying...`);
      await new Promise((r) => setTimeout(r, 1000));
      return resilientFetch(url, options, retries - 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getUser(token) {
  // Try /user first (works with classic tokens and fine-grained tokens with profile access)
  const res = await resilientFetch(`${GITHUB_API}/user`, { headers: headers(token) });
  if (res.ok) return res.json();

  // If /user fails (fine-grained token without profile permission), try authenticated check
  // via /octocat which validates the token without needing specific permissions
  const checkRes = await resilientFetch(`${GITHUB_API}/octocat`, { headers: headers(token) });
  if (checkRes.ok || checkRes.status === 200) {
    // Token is valid but can't read profile — extract username from token metadata
    const metaRes = await resilientFetch(`${GITHUB_API}/`, { headers: headers(token) });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.current_user_url) {
        const userRes = await resilientFetch(meta.current_user_url, { headers: headers(token) });
        if (userRes.ok) return userRes.json();
      }
    }
    // Fallback — return a minimal user object
    return { login: 'github-user', id: 0 };
  }

  throw new Error(`GitHub API error: ${res.status}`);
}

export async function getUserOrgs(token) {
  const orgs = [];
  let page = 1;
  while (true) {
    const res = await resilientFetch(`${GITHUB_API}/user/orgs?per_page=100&page=${page}`, {
      headers: headers(token),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    if (data.length === 0) break;
    orgs.push(...data);
    page++;
  }
  return orgs;
}

export async function getOrgRepos(token, org) {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await resilientFetch(
      `${GITHUB_API}/orgs/${encodeURIComponent(org)}/repos?per_page=100&page=${page}&type=all`,
      { headers: headers(token) }
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    if (data.length === 0) break;
    repos.push(...data);
    page++;
  }
  return repos;
}

export async function getUserRepos(token) {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await resilientFetch(
      `${GITHUB_API}/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator&sort=updated`,
      { headers: headers(token) }
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    if (data.length === 0) break;
    repos.push(...data);
    page++;
  }
  return repos;
}

export async function searchCode(token, query, org, page = 1) {
  const q = encodeURIComponent(`${query} org:${org}`);
  const res = await resilientFetch(
    `${GITHUB_API}/search/code?q=${q}&per_page=100&page=${page}`,
    { headers: { ...headers(token), Accept: 'application/vnd.github.v3.text-match+json' } }
  );
  if (res.status === 403) {
    const rateLimitReset = res.headers.get('x-ratelimit-reset');
    const waitTime = rateLimitReset ? (parseInt(rateLimitReset) * 1000 - Date.now()) : 60000;
    return { rate_limited: true, wait_time: Math.max(waitTime, 1000), total_count: 0, items: [] };
  }
  if (res.status === 422) {
    return { total_count: 0, items: [], validation_error: true };
  }
  if (!res.ok) {
    return { total_count: 0, items: [], error: `HTTP ${res.status}` };
  }
  return res.json();
}

// Get the recursive file tree for a repo (only text-like files)
export async function getRepoTree(token, owner, repo, sha = 'HEAD') {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${sha}?recursive=1`;
  const res = await resilientFetch(url, { headers: headers(token) });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.tree) return [];
  const skipExts = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp', '.tiff',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.wav', '.ogg',
    '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z', '.jar', '.war',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.min.js', '.min.css', '.map',
    '.lock', '.sum',
  ]);
  return data.tree.filter((item) => {
    if (item.type !== 'blob') return false;
    if (item.size > 500000) return false;
    const lower = item.path.toLowerCase();
    for (const ext of skipExts) {
      if (lower.endsWith(ext)) return false;
    }
    if (/\/(node_modules|vendor|dist|build|\.git)\//.test('/' + item.path + '/')) return false;
    return true;
  });
}

// Get raw file content via the blob API (base64)
export async function getBlobContent(token, owner, repo, sha) {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${sha}`;
  const res = await resilientFetch(url, { headers: headers(token) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding === 'base64' && data.content) {
    try {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }
  return null;
}

export async function getFileContent(token, owner, repo, path, ref) {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}${ref ? `?ref=${ref}` : ''}`;
  const res = await resilientFetch(url, { headers: headers(token) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }
  return null;
}

export async function getCommitForFile(token, owner, repo, path) {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?path=${encodeURIComponent(path)}&per_page=1`;
  const res = await resilientFetch(url, { headers: headers(token) });
  if (!res.ok) return null;
  const commits = await res.json();
  if (commits.length > 0) {
    const c = commits[0];
    return {
      sha: c.sha,
      author: c.commit?.author?.name || c.author?.login || 'Unknown',
      authorLogin: c.author?.login || null,
      authorAvatar: c.author?.avatar_url || null,
      date: c.commit?.author?.date || null,
      message: c.commit?.message?.split('\n')[0] || '',
      url: c.html_url,
    };
  }
  return null;
}

export async function getRateLimit(token) {
  const res = await resilientFetch(`${GITHUB_API}/rate_limit`, { headers: headers(token) });
  if (!res.ok) return null;
  return res.json();
}

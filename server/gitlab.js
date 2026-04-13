import fetch from 'node-fetch';
import logger from './logger.js';

const REQUEST_TIMEOUT = 15000;

function headers(token) {
  return {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
    'User-Agent': 'SecretSweep',
  };
}

async function resilientFetch(url, options = {}, retries = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (res.status >= 500 && retries > 0) {
      logger.warn(`GitLab API 5xx (${res.status}), retrying...`);
      clearTimeout(timeout);
      await new Promise(r => setTimeout(r, 1000));
      return resilientFetch(url, options, retries - 1);
    }
    return res;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('GitLab API request timed out');
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return resilientFetch(url, options, retries - 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getGitLabUser(token, baseUrl = 'https://gitlab.com') {
  const res = await resilientFetch(`${baseUrl}/api/v4/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitLab API error: ${res.status}`);
  return res.json();
}

export async function getGitLabGroups(token, baseUrl = 'https://gitlab.com') {
  const groups = [];
  let page = 1;
  while (true) {
    const res = await resilientFetch(`${baseUrl}/api/v4/groups?per_page=100&page=${page}&min_access_level=10`, { headers: headers(token) });
    if (!res.ok) break;
    const data = await res.json();
    if (data.length === 0) break;
    groups.push(...data.map(g => ({ id: g.id, name: g.name, full_path: g.full_path, web_url: g.web_url, avatar_url: g.avatar_url })));
    page++;
    if (data.length < 100) break;
  }
  return groups;
}

export async function getGitLabGroupProjects(token, groupId, baseUrl = 'https://gitlab.com') {
  const projects = [];
  let page = 1;
  while (true) {
    const res = await resilientFetch(
      `${baseUrl}/api/v4/groups/${encodeURIComponent(groupId)}/projects?per_page=100&page=${page}&include_subgroups=true&archived=false`,
      { headers: headers(token) }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (data.length === 0) break;
    projects.push(...data.map(p => ({
      id: p.id, name: p.name, full_name: p.path_with_namespace, html_url: p.web_url,
      private: p.visibility !== 'public', default_branch: p.default_branch || 'main',
    })));
    page++;
    if (data.length < 100) break;
  }
  return projects;
}

export async function getGitLabUserProjects(token, baseUrl = 'https://gitlab.com') {
  const projects = [];
  let page = 1;
  while (true) {
    const res = await resilientFetch(
      `${baseUrl}/api/v4/projects?per_page=100&page=${page}&membership=true&archived=false`,
      { headers: headers(token) }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (data.length === 0) break;
    projects.push(...data.map(p => ({
      id: p.id, name: p.name, full_name: p.path_with_namespace, html_url: p.web_url,
      private: p.visibility !== 'public', default_branch: p.default_branch || 'main',
    })));
    page++;
    if (data.length < 100) break;
  }
  return projects;
}

export async function getGitLabFileContent(token, projectId, filePath, ref = 'HEAD', baseUrl = 'https://gitlab.com') {
  const res = await resilientFetch(
    `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${ref}`,
    { headers: headers(token) }
  );
  if (!res.ok) return null;
  return res.text();
}

export async function searchGitLabCode(token, groupId, query, baseUrl = 'https://gitlab.com') {
  const res = await resilientFetch(
    `${baseUrl}/api/v4/groups/${encodeURIComponent(groupId)}/search?scope=blobs&search=${encodeURIComponent(query)}&per_page=100`,
    { headers: headers(token) }
  );
  if (!res.ok) return [];
  return res.json();
}

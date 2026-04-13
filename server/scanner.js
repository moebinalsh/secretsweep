import patterns from './patterns.js';
import { searchCode, getCommitForFile, getRepoTree, getBlobContent } from './github.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run promises with concurrency limit, calling onResult for each completed item
async function pooled(items, concurrency, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = { _error: err.message };
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Scan a single file's content against all patterns, return findings array
function scanFileContent(content, patterns, seenKeys, repoFullName, filePath, fileUrl, defaultBranch) {
  const findings = [];
  const lines = content.split('\n');

  for (const pattern of patterns) {
    const dedupeKey = `${repoFullName}:${filePath}:${pattern.id}`;
    if (seenKeys.has(dedupeKey)) continue;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (pattern.regex.test(line)) {
        if (isFalsePositive(line)) continue;

        seenKeys.add(dedupeKey);
        const repoHtmlUrl = `https://github.com/${repoFullName}`;
        const fUrl = fileUrl || `${repoHtmlUrl}/blob/${defaultBranch}/${filePath}#L${li + 1}`;

        findings.push({
          type: 'finding',
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          repo: repoFullName,
          repoUrl: repoHtmlUrl,
          file: filePath,
          fileUrl: fUrl,
          line: li + 1,
          matchingLines: [line.trim()],
          secretType: pattern.name,
          secretTypeId: pattern.id,
          severity: pattern.severity,
          description: pattern.description,
          commit: null, // filled in later
        });
        break;
      }
    }
  }
  return findings;
}

// Reduce false positives
function isFalsePositive(line) {
  const trimmed = line.trim();
  if (/^\s*(#|\/\/|\/\*|\*|<!--|;)\s/.test(trimmed) && !/[=:]/.test(trimmed)) return true;
  if (/your[-_]?(api[-_]?key|secret|token|password)|<your|CHANGE[-_]?ME|INSERT[-_]?HERE|REPLACE[-_]?ME|put[-_]?your/i.test(trimmed)) return true;
  if (/[=:]\s*['"]?(xxx+|yyy+|zzz+|aaa+|TODO|FIXME|PLACEHOLDER|EXAMPLE|dummy|sample_key|test_key|fake_key)['"]?\s*$/i.test(trimmed)) return true;
  if (/[=:]\s*['"]?\s*['"]?\s*$/.test(trimmed)) return true;
  if (/[=:]\s*['"]?\$\{?[A-Z_]+\}?['"]?\s*$/.test(trimmed)) return true;
  if (/[=:]\s*['"]?(?:process\.env\.|os\.environ|os\.getenv|ENV\[|System\.getenv|getenv\()/i.test(trimmed)) return true;
  return false;
}

// Phase 1: GitHub Code Search API (fast)
async function* searchPhase(token, org) {
  const seenKeys = new Set();
  const totalPatterns = patterns.length;
  let patternIndex = 0;

  for (const pattern of patterns) {
    patternIndex++;
    for (const query of pattern.searchQueries) {
      yield {
        type: 'progress',
        message: `[Code Search] ${pattern.name} (${patternIndex}/${totalPatterns})...`,
        patternIndex,
        totalPatterns,
        pattern: pattern.name,
        phase: 'search',
      };

      try {
        await sleep(2200);
        const result = await searchCode(token, query, org);

        if (result.rate_limited) {
          yield { type: 'rate_limit', message: `Rate limited. Waiting...`, waitTime: result.wait_time };
          await sleep(Math.min(result.wait_time, 65000));
          continue;
        }

        if (result.items && result.items.length > 0) {
          for (const item of result.items) {
            const dedupeKey = `${item.repository.full_name}:${item.path}:${pattern.id}`;
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);

            let matchingLines = [];
            let lineNumber = null;
            if (item.text_matches) {
              for (const tm of item.text_matches) {
                const lines = (tm.fragment || '').split('\n');
                for (let i = 0; i < lines.length; i++) {
                  if (pattern.regex.test(lines[i])) {
                    matchingLines.push(lines[i].trim());
                    if (!lineNumber) lineNumber = i + 1;
                  }
                }
              }
            }
            if (matchingLines.length === 0) matchingLines = ['(match found via code search)'];

            yield {
              type: 'finding',
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              repo: item.repository.full_name,
              repoUrl: item.repository.html_url,
              file: item.path,
              fileUrl: item.html_url,
              line: lineNumber,
              matchingLines,
              secretType: pattern.name,
              secretTypeId: pattern.id,
              severity: pattern.severity,
              description: pattern.description,
              commit: null,
            };
          }
        }
      } catch (err) {
        yield { type: 'error', message: `Code search error for ${pattern.name}: ${err.message}` };
      }
    }
  }
}

// Phase 2: Concurrent deep content scan
async function* contentPhase(token, org, repos, existingFindings, emit) {
  const seenKeys = new Set();
  for (const f of existingFindings) {
    seenKeys.add(`${f.repo}:${f.file}:${f.secretTypeId}`);
  }

  const totalRepos = repos.length;
  // Process repos in batches of 5 concurrently
  const REPO_CONCURRENCY = 5;
  const FILE_CONCURRENCY = 10;

  for (let batchStart = 0; batchStart < totalRepos; batchStart += REPO_CONCURRENCY) {
    const batch = repos.slice(batchStart, batchStart + REPO_CONCURRENCY);

    yield {
      type: 'progress',
      message: `[Deep Scan] Repos ${batchStart + 1}-${Math.min(batchStart + REPO_CONCURRENCY, totalRepos)} of ${totalRepos}...`,
      patternIndex: Math.min(batchStart + REPO_CONCURRENCY, totalRepos),
      totalPatterns: totalRepos,
      pattern: batch.map((r) => r.name).join(', '),
      phase: 'content',
    };

    // Fetch all trees in parallel
    const trees = await pooled(batch, REPO_CONCURRENCY, async (repo) => {
      const owner = repo.owner?.login || org;
      const defaultBranch = repo.default_branch || 'main';
      for (const branch of [defaultBranch, 'main', 'master', 'HEAD']) {
        try {
          const tree = await getRepoTree(token, owner, repo.name, branch);
          if (tree && tree.length > 0) return { tree, branch };
        } catch { /* next */ }
      }
      return { tree: [], branch: defaultBranch };
    });

    // For each repo in the batch, scan files concurrently
    for (let bi = 0; bi < batch.length; bi++) {
      const repo = batch[bi];
      const { tree, branch } = trees[bi]?._error ? { tree: [], branch: 'main' } : (trees[bi] || { tree: [], branch: 'main' });
      const repoFullName = repo.full_name || `${org}/${repo.name}`;
      const owner = repo.owner?.login || org;
      const defaultBranch = branch || repo.default_branch || 'main';

      if (!tree || tree.length === 0) continue;

      // Prioritize config files
      const highPriority = /\.(env|env\..+|yml|yaml|json|toml|ini|cfg|conf|config|properties|xml|tf|tfvars|sh|bash|zsh|pem|key|crt|cert|secret|credentials)$/i;
      const medPriority = /\.(py|js|ts|jsx|tsx|rb|go|java|php|rs|c|cpp|h|cs|swift|kt|gradle|groovy|scala|pl|pm)$/i;

      const highFiles = tree.filter((f) => highPriority.test(f.path));
      const medFiles = tree.filter((f) => medPriority.test(f.path) && !highPriority.test(f.path));
      const otherFiles = tree.filter((f) => !highPriority.test(f.path) && !medPriority.test(f.path));
      const sortedTree = [...highFiles, ...medFiles, ...otherFiles];
      const filesToScan = sortedTree.filter((f) => !/\.(md|rst|adoc)$/i.test(f.path)).slice(0, 500);

      // Fetch and scan files concurrently
      const batchFindings = await pooled(filesToScan, FILE_CONCURRENCY, async (file) => {
        let content;
        try {
          content = await getBlobContent(token, owner, repo.name, file.sha);
        } catch { return []; }
        if (!content) return [];
        return scanFileContent(content, patterns, seenKeys, repoFullName, file.path, null, defaultBranch);
      });

      // Yield all findings from this repo
      for (const result of batchFindings) {
        if (result?._error) continue;
        const fileFindings = result || [];
        for (const finding of fileFindings) {
          yield finding;
        }
      }
    }
  }
}

// Enrich findings with commit info (batched, concurrent)
async function enrichFindings(token, findings) {
  const COMMIT_CONCURRENCY = 15;
  const enriched = await pooled(findings, COMMIT_CONCURRENCY, async (finding) => {
    if (finding.commit) return finding;
    try {
      const [owner, repoName] = finding.repo.split('/');
      const commitInfo = await getCommitForFile(token, owner, repoName, finding.file);
      return { ...finding, commit: commitInfo };
    } catch {
      return finding;
    }
  });
  return enriched.map((r, i) => r?._error ? findings[i] : r);
}

export async function* scanOrg(token, org, repos) {
  const findings = [];

  // Phase 1: Code Search API
  yield { type: 'progress', message: 'Phase 1: GitHub Code Search API...', patternIndex: 0, totalPatterns: 1, phase: 'search' };

  for await (const event of searchPhase(token, org)) {
    if (event.type === 'finding') findings.push(event);
    yield event;
  }

  yield {
    type: 'progress',
    message: `Phase 1 done: ${findings.length} results. Starting Phase 2: Deep scan of ${repos.length} repos (concurrent)...`,
    patternIndex: 0,
    totalPatterns: repos.length,
    phase: 'content',
  };

  // Phase 2: Concurrent content scanning
  for await (const event of contentPhase(token, org, repos, findings)) {
    if (event.type === 'finding') findings.push(event);
    yield event;
  }

  // Phase 3: Enrich with commit info (concurrent batch)
  if (findings.length > 0) {
    yield { type: 'progress', message: `Fetching commit info for ${findings.length} findings...`, patternIndex: 95, totalPatterns: 100, phase: 'enrich' };
    const enriched = await enrichFindings(token, findings);
    // Send enrichment updates
    for (let i = 0; i < enriched.length; i++) {
      if (enriched[i].commit && !findings[i].commit) {
        yield { type: 'enrich', id: findings[i].id, commit: enriched[i].commit };
      }
    }
  }

  yield {
    type: 'complete',
    message: 'Scan complete',
    totalRepos: repos.length,
    reposWithFindings: new Set(findings.map((f) => f.repo)).size,
    totalFindings: findings.length,
  };
}

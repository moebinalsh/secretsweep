export async function fetchUser() {
  const res = await fetch('/auth/user');
  if (!res.ok) return null;
  return res.json();
}

export async function fetchOrgs() {
  const res = await fetch('/api/orgs');
  if (!res.ok) throw new Error('Failed to fetch organizations');
  return res.json();
}

export async function fetchRepos(org) {
  const res = await fetch(`/api/repos/${encodeURIComponent(org)}`);
  if (!res.ok) throw new Error('Failed to fetch repositories');
  return res.json();
}

export async function loginWithPat(token) {
  const res = await fetch('/auth/pat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Invalid token');
  }
  return res.json();
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
}

export async function fetchRateLimit() {
  const res = await fetch('/api/rate-limit');
  if (!res.ok) return null;
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) return {};
  return res.json();
}

export function startScan(org, onEvent, onError, onComplete, selectedRepos = null) {
  let url = `/api/scan/${encodeURIComponent(org)}`;

  // Append repo filter if selective scan
  if (selectedRepos && selectedRepos.length > 0) {
    const repoParam = selectedRepos.map((r) => encodeURIComponent(r)).join(',');
    url += `?repos=${repoParam}`;
  }

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'complete') {
        onComplete(data);
        eventSource.close();
      } else {
        onEvent(data);
      }
    } catch (err) {
      console.error('Failed to parse event:', err);
    }
  };

  eventSource.onerror = (err) => {
    onError(err);
    eventSource.close();
  };

  return eventSource;
}

export interface AccountUser { name: string; email: string }
export interface SavedProgram { id: string; title: string; source: string; updatedAt: string }

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { method, credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  } catch {
    throw new Error('Could not reach Logo Teacher. Check your connection, then try again.')
  }
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null
  if (!response.ok || data === null) throw new Error(data?.error || 'Something went wrong. Try again.')
  return data
}

export const accountApi = {
  me: () => request<{ accounts: boolean; user: AccountUser | null }>('/api/account'),
  signIn: (email: string, password: string) => request<{ user: AccountUser }>('/api/account', 'POST', { action: 'sign-in', email, password }),
  signUp: (name: string, email: string, password: string) => request<{ user: AccountUser }>('/api/account', 'POST', { action: 'sign-up', name, email, password }),
  signOut: () => request<{ user: null }>('/api/account', 'POST', { action: 'sign-out' }),
  listPrograms: () => request<{ programs: SavedProgram[] }>('/api/programs').then(data => data.programs),
  saveProgram: (title: string, source: string) => request<{ program: SavedProgram }>('/api/programs', 'POST', { title, source }).then(data => data.program),
  deleteProgram: (id: string) => request<{ deleted: string }>(`/api/programs?id=${encodeURIComponent(id)}`, 'DELETE'),
  getProgress: () => request<{ completed: string[] }>('/api/progress').then(data => data.completed),
  addProgress: (completed: string[]) => request<{ completed: string[] }>('/api/progress', 'PUT', { completed }).then(data => data.completed),
}

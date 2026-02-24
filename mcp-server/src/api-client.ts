const BASE_URL = process.env.EXECUT_API_URL || 'http://localhost:3333'

interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

export async function apiGet<T = unknown>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`)
  const data = res.ok ? await res.json() as T : (await res.text() as unknown as T)
  return { ok: res.ok, status: res.status, data }
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

export async function apiDelete<T = unknown>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' })
  if (res.status === 204) return { ok: true, status: 204, data: null as T }
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, status: res.status, data }
}

export function formatResult(res: ApiResponse): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  if (!res.ok) {
    return {
      content: [{ type: 'text', text: `Error (${res.status}): ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)}` }],
      isError: true,
    }
  }
  return {
    content: [{ type: 'text', text: typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2) }],
  }
}

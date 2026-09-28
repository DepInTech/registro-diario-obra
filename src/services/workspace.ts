import pb from '@/lib/pocketbase/client'

export async function signIn(email: string, password: string) {
  return pb.collection('users').authWithPassword(email, password)
}

export function signOut() {
  pb.authStore.clear()
}

import { sanitizeRdoPayload, sanitizeFieldSpreadsheetPayload } from '@/lib/payloadSanitizer'

export async function updateRdoStatus(
  id: string,
  status: string,
  reviewNotes = '',
  returnedFields?: string[],
  returnedByName?: string,
  changeHistory?: any[],
) {
  const data: Record<string, any> = { status, review_notes: reviewNotes }
  if (returnedFields !== undefined) {
    data.returned_fields = returnedFields
  }
  if (returnedByName !== undefined) {
    data.returned_by_name = returnedByName
  }
  if (changeHistory !== undefined) {
    data.change_history = changeHistory
  }
  return pb.collection('reports_rdo').update(id, sanitizeRdoPayload(data))
}

export async function updateFieldStatus(
  id: string,
  status: string,
  reviewNotes = '',
  returnedFields?: string[],
  returnedByName?: string,
  changeHistory?: any[],
) {
  const data: Record<string, any> = { status, review_notes: reviewNotes }
  if (returnedFields !== undefined) {
    data.returned_fields = returnedFields
  }
  if (returnedByName !== undefined) {
    data.returned_by_name = returnedByName
  }
  if (changeHistory !== undefined) {
    data.change_history = changeHistory
  }
  return pb.collection('field_spreadsheets').update(id, sanitizeFieldSpreadsheetPayload(data))
}

export async function askEpaCopilot(
  message: string,
  conversationId: string | null,
  projectId?: string | null,
) {
  if (!pb.authStore.token) throw new Error('Entre com sua conta para consultar dados protegidos.')
  const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/epa-copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      project_id: projectId || undefined,
    }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Não foi possível consultar o EPA Copilot.')
  return result as { content: string; conversation_id: string }
}

export function exportUrl(kind: 'rdo' | 'field', id: string) {
  return `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/epa/export/${kind}/${id}`
}

export function authHeaders() {
  return pb.authStore.token ? { Authorization: pb.authStore.token } : {}
}

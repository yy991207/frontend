import { getConfig } from '@/config/appConfig'
import { request } from './request'

export type CustomFieldType =
  | 'select'
  | 'multi_select'
  | 'number'
  | 'text'
  | 'date'
  | 'member'

export interface FieldOption {
  id?: string | null
  label: string
  color?: string | null
  is_disabled?: boolean
  disabled_at?: string | null
}

export interface UpdateFieldOption {
  id?: string | null
  label: string
  color?: string | null
}

export interface CreateFieldOption {
  label: string
  color?: string | null
}

export interface ApiCustomField {
  field_id: string
  project_id: string
  team_id?: string
  name: string
  field_type: CustomFieldType
  options: FieldOption[] | null
  required: boolean
  is_visible: boolean
  sort_order: number
  creator_id?: string
  created_at: string
  updated_at: string
  is_deleted?: boolean
}

const uid = () => encodeURIComponent(getConfig().user_id)

export async function listCustomFields(
  projectId: string,
  options?: {
    includeDisabledOptions?: boolean
  },
): Promise<ApiCustomField[]> {
  const qs = new URLSearchParams({
    user_id: getConfig().user_id,
  })
  if (options?.includeDisabledOptions) {
    qs.set('include_disabled_options', 'true')
  }

  const res = await request<ApiCustomField[] | { items: ApiCustomField[] }>(
    `api/v1/task-center/projects/${projectId}/custom-fields?${qs.toString()}`,
  )
  return Array.isArray(res) ? res : (res?.items ?? [])
}

export async function createCustomField(
  projectId: string,
  data: {
    name: string
    field_type: CustomFieldType
    options?: CreateFieldOption[]
    required?: boolean
  },
): Promise<ApiCustomField> {
  return request<ApiCustomField>(
    `api/v1/task-center/projects/${projectId}/custom-fields`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: getConfig().user_id,
        name: data.name,
        field_type: data.field_type,
        options: data.options ?? null,
        required: data.required ?? false,
      }),
    },
  )
}

export async function updateCustomField(
  projectId: string,
  fieldId: string,
  patch: {
    name?: string
    options?: UpdateFieldOption[]
    required?: boolean
    is_visible?: boolean
    sort_order?: number
  },
): Promise<ApiCustomField> {
  return request<ApiCustomField>(
    `api/v1/task-center/projects/${projectId}/custom-fields/${fieldId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ user_id: getConfig().user_id, ...patch }),
    },
  )
}

export async function deleteCustomField(projectId: string, fieldId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/projects/${projectId}/custom-fields/${fieldId}?user_id=${uid()}`,
    { method: 'DELETE' },
  )
}

export async function patchTaskCustomFields(
  taskId: string,
  customFields: Record<string, unknown>,
): Promise<void> {
  return request<void>(`api/v1/task-center/tasks/${taskId}/custom-fields`, {
    method: 'PATCH',
    body: JSON.stringify({
      user_id: getConfig().user_id,
      custom_fields: customFields,
    }),
  })
}

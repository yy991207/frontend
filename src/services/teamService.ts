import { request } from './request'
import { getConfig } from '@/config/appConfig'

export interface TeamMember {
  team_id: string
  user_id: string
  user_name?: string | null
  avatar_url?: string | null
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

const currentTeamId = (teamId?: string) => encodeURIComponent(teamId || getConfig().team_id)

export function listMembers(teamId?: string): Promise<TeamMember[]> {
  return request<TeamMember[]>(
    `api/v1/task-center/teams/${currentTeamId(teamId)}/members?user_id=${encodeURIComponent(getConfig().user_id)}`,
  )
}

export function addMembers(userIds: string[], teamId?: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/teams/${currentTeamId(teamId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: getConfig().user_id, user_ids: userIds }),
    },
  )
}

export function removeMember(targetUserId: string, teamId?: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/teams/${currentTeamId(teamId)}/members/${encodeURIComponent(targetUserId)}?user_id=${encodeURIComponent(getConfig().user_id)}`,
    { method: 'DELETE' },
  )
}

export function updateMemberRole(
  targetUserId: string,
  role: 'admin' | 'member',
  teamId?: string,
): Promise<void> {
  return request<void>(
    `api/v1/task-center/teams/${currentTeamId(teamId)}/members/${encodeURIComponent(targetUserId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ user_id: getConfig().user_id, role }),
    },
  )
}

export function transferOwner(newOwnerId: string, teamId?: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/teams/${currentTeamId(teamId)}/transfer`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: getConfig().user_id,
        new_owner_id: newOwnerId,
      }),
    },
  )
}

export interface Team {
  team_id: string
  name: string
  description?: string | null
  avatar_url?: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

const uid = () => encodeURIComponent(getConfig().user_id)

export function listTeams(): Promise<Team[]> {
  return request<Team[]>(`api/v1/task-center/teams?user_id=${uid()}`)
}

export function getTeam(teamId: string): Promise<Team> {
  return request<Team>(
    `api/v1/task-center/teams/${teamId}?user_id=${uid()}`,
  )
}

export function createTeam(
  name: string,
  description?: string,
  avatarUrl?: string,
): Promise<Team> {
  return request<Team>(`api/v1/task-center/teams`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: getConfig().user_id,
      name,
      description: description ?? null,
      avatar_url: avatarUrl ?? null,
    }),
  })
}

export function updateTeam(
  teamId: string,
  patch: { name?: string; description?: string | null; avatar_url?: string | null },
): Promise<Team> {
  return request<Team>(`api/v1/task-center/teams/${teamId}`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: getConfig().user_id, ...patch }),
  })
}

export function deleteTeam(teamId: string): Promise<void> {
  return request<void>(
    `api/v1/task-center/teams/${teamId}?user_id=${uid()}`,
    { method: 'DELETE' },
  )
}

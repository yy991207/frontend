import type { Section, Task } from '../../types/task.ts'

export function appendSection(
  currentSections: Section[],
  nextSection: Section,
): Section[] {
  return [...currentSections, nextSection]
}

export function renameSectionInList(
  currentSections: Section[],
  sectionGuid: string,
  name: string,
): Section[] {
  return currentSections.map((section) =>
    section.guid === sectionGuid ? { ...section, name } : section,
  )
}

export function ensureSectionVisible(
  currentVisibleSections: Set<string>,
  sectionGuid: string,
): Set<string> {
  if (currentVisibleSections.has(sectionGuid)) {
    return currentVisibleSections
  }
  const nextVisibleSections = new Set(currentVisibleSections)
  nextVisibleSections.add(sectionGuid)
  return nextVisibleSections
}

export interface DeleteSectionPlan {
  nextSections: Section[]
  nextTasks: Task[]
  affectedTaskCount: number
}

interface BuildDeleteSectionPlanParams {
  currentSections: Section[]
  tasks: Task[]
  tasklistGuid: string
  sectionGuid: string
}

export function buildDeleteSectionPlan({
  currentSections,
  tasks,
  tasklistGuid,
  sectionGuid,
}: BuildDeleteSectionPlanParams): DeleteSectionPlan | null {
  const defaultSection =
    currentSections.find((section) => section.is_default) ??
    currentSections.find((section) => section.guid !== sectionGuid)
  if (!defaultSection) {
    return null
  }

  const nextSections = currentSections.filter((section) => section.guid !== sectionGuid)
  const nextTasks = tasks.map((task) => {
    const shouldMoveTask = task.tasklists.some(
      (ref) => ref.tasklist_guid === tasklistGuid && ref.section_guid === sectionGuid,
    )
    if (!shouldMoveTask) {
      return task
    }
    return {
      ...task,
      tasklists: task.tasklists.map((ref) =>
        ref.tasklist_guid === tasklistGuid && ref.section_guid === sectionGuid
          ? { ...ref, section_guid: defaultSection.guid }
          : ref,
      ),
    }
  })

  const affectedTaskCount = nextTasks.filter((task, index) => task !== tasks[index]).length
  return { nextSections, nextTasks, affectedTaskCount }
}

interface CommitDeleteSectionParams {
  taskGuidsToMove: string[]
  targetSectionGuid: string
  deleteSection: () => Promise<void>
  moveTaskToSection: (taskGuid: string, sectionGuid: string) => Promise<void>
}

export async function commitDeleteSection({
  taskGuidsToMove,
  targetSectionGuid,
  deleteSection,
  moveTaskToSection,
}: CommitDeleteSectionParams): Promise<void> {
  await Promise.all(
    taskGuidsToMove.map((taskGuid) => moveTaskToSection(taskGuid, targetSectionGuid)),
  )
  await deleteSection()
}

export function shouldEnterSectionEditMode(
  creatingSection: boolean,
  pendingSectionGuid: string | null,
  sectionExists: boolean,
): boolean {
  return !creatingSection && Boolean(pendingSectionGuid) && sectionExists
}

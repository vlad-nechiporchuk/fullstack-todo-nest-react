import { type QueryClient, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LIST_LIMIT_DEFAULT, type TaskStatusFilter, type UpdateTask } from "@workspace/common"
import { ApiError } from "../lib/api-client"
import {
  applyPatch,
  applyRemoval,
  confirmVersion,
  forgetVersion,
  readVersion,
  rememberVersion,
  rollbackChange,
  snapshotLists,
  storeConfirmed,
  storeConfirmedVersion,
  TASK_KEYS,
} from "../lib/task-cache"
import { createTask, deleteTask, listTasks, updateTask } from "../services/tasks"

const TASK_MUTATION_KEY = ["tasks", "mutation"] as const

export function useTaskList(status: TaskStatusFilter) {
  return useInfiniteQuery({
    queryKey: TASK_KEYS.list(status),
    queryFn: ({ pageParam }) => listTasks({ status, limit: LIST_LIMIT_DEFAULT, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length

      return nextOffset < lastPage.total ? nextOffset : undefined
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: TASK_MUTATION_KEY,
    mutationFn: (title: string) => createTask({ title }),
    onSettled: () => refreshListsWhenIdle(queryClient),
  })
}

/**
 * Changes to one task run one after another and share one remembered version, so a quick second change names the
 * version the first produced and survives the task leaving a filtered list.
 */
export function useUpdateTask(id: string, onFailure: (error: unknown) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: TASK_MUTATION_KEY,
    scope: { id: taskScope(id) },
    mutationFn: (patch: UpdateTask) => updateTask(id, patch, readVersion(queryClient, id)),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: TASK_KEYS.lists() })
      rememberVersion(queryClient, id)
      const lists = snapshotLists(queryClient)
      const change = applyPatch(queryClient, id, patch)

      return { lists, change }
    },
    onSuccess: (confirmed) => {
      confirmVersion(queryClient, id, confirmed.version)
      // A queued change of the same task already shows its optimistic state; only the version must catch up.
      if (countChanges(queryClient, id) > 1) {
        storeConfirmedVersion(queryClient, confirmed)
      } else {
        storeConfirmed(queryClient, confirmed)
      }
    },
    onError: (error, _patch, context) => {
      if (context?.change) {
        rollbackChange(queryClient, context.lists, context.change)
      }
      onFailure(error)
    },
    onSettled: () => {
      if (countChanges(queryClient, id) <= 1) {
        forgetVersion(queryClient, id)
      }
      return refreshListsWhenIdle(queryClient)
    },
  })
}

export function useDeleteTask(id: string, onFailure: (error: unknown) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: TASK_MUTATION_KEY,
    scope: { id: taskScope(id) },
    mutationFn: () => deleteUnlessGone(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: TASK_KEYS.lists() })
      const lists = snapshotLists(queryClient)
      const change = applyRemoval(queryClient, id)

      return { lists, change }
    },
    onError: (error, _variables, context) => {
      if (context?.change) {
        rollbackChange(queryClient, context.lists, context.change)
      }
      onFailure(error)
    },
    onSettled: () => refreshListsWhenIdle(queryClient),
  })
}

function taskScope(id: string): string {
  return `task:${id}`
}

function countChanges(queryClient: QueryClient, id: string): number {
  return queryClient
    .getMutationCache()
    .getAll()
    .filter((mutation) => mutation.options.scope?.id === taskScope(id) && mutation.state.status === "pending").length
}

// A task someone else deleted first is gone either way, which is what the person asked for.
async function deleteUnlessGone(id: string): Promise<void> {
  try {
    await deleteTask(id)
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      throw error
    }
  }
}

// A refetch while another change is still in flight would show the server's older state over that change.
function refreshListsWhenIdle(queryClient: QueryClient): Promise<void> | undefined {
  if (queryClient.isMutating({ mutationKey: TASK_MUTATION_KEY }) > 1) {
    return undefined
  }

  return queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() })
}

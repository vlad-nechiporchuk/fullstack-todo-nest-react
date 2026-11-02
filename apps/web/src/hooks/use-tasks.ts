import {
  type QueryClient,
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query"
import { LIST_LIMIT_DEFAULT, type TaskStatusFilter, type UpdateTask } from "@workspace/common"
import { ApiError } from "../lib/api-client"
import { createTask, deleteTask, listTasks, updateTask } from "../services/tasks"

const TASK_LISTS_KEY = ["tasks", "list"] as const

const TASK_CHANGE_KEYS = {
  update: (id: string) => ["tasks", "change", id, "update"] as const,
  delete: (id: string) => ["tasks", "change", id, "delete"] as const,
}

export function useTaskList(status: TaskStatusFilter) {
  return useInfiniteQuery({
    queryKey: [...TASK_LISTS_KEY, status],
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
    mutationFn: (title: string) => createTask({ title }),
    onSettled: () => refreshLists(queryClient),
  })
}

/** A change to a task and the version it was based on, which the API checks through `If-Match`. */
export interface TaskUpdate {
  patch: UpdateTask
  version: number
}

/**
 * The cache is never edited: while the change is pending the row shows it from the mutation's variables, and once
 * the lists are reloaded the row shows what the server holds, whether the change succeeded or failed.
 */
export function useUpdateTask(id: string, onFailure: (error: unknown) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: TASK_CHANGE_KEYS.update(id),
    mutationFn: ({ patch, version }: TaskUpdate) => updateTask(id, patch, version),
    onError: onFailure,
    onSettled: () => refreshLists(queryClient),
  })
}

export function useDeleteTask(id: string, onFailure: (error: unknown) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: TASK_CHANGE_KEYS.delete(id),
    mutationFn: () => deleteUnlessGone(id),
    onError: onFailure,
    onSettled: () => refreshLists(queryClient),
  })
}

/**
 * The task's change in flight, read from the mutation cache rather than the row, so a row that unmounts and comes
 * back, as on a tab switch, still shows the change and stays locked.
 */
export function usePendingTaskChange(id: string) {
  const patch = useMutationState({
    filters: { mutationKey: TASK_CHANGE_KEYS.update(id), status: "pending" },
    // Only useUpdateTask registers this key, so its variables are a TaskUpdate.
    select: (mutation) => (mutation.state.variables as TaskUpdate).patch,
  })[0]
  const isDeleting = useIsMutating({ mutationKey: TASK_CHANGE_KEYS.delete(id) }) > 0

  return { patch, isDeleting, isBusy: patch !== undefined || isDeleting }
}

// Returned from onSettled, so the mutation stays pending until the reload lands and the row never flashes back to
// the state it had before the change.
function refreshLists(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: TASK_LISTS_KEY })
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

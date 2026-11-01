import { type TaskStatusFilter, taskStatusFilterSchema } from "@workspace/common"
import { useCallback, useEffect, useState } from "react"

const PARAM = "status"
const DEFAULT_STATUS: TaskStatusFilter = "all"

/** The status filter lives in `?status=`, so a reload, a shared link and the back button keep the tab. */
export function useStatusFilter(): [TaskStatusFilter, (status: TaskStatusFilter) => void] {
  const [status, setStatus] = useState(readStatusFromUrl)

  useEffect(() => {
    const syncFromUrl = () => setStatus(readStatusFromUrl())
    window.addEventListener("popstate", syncFromUrl)

    return () => window.removeEventListener("popstate", syncFromUrl)
  }, [])

  const changeStatus = useCallback(
    (next: TaskStatusFilter) => {
      if (next === status) {
        return
      }

      const url = new URL(window.location.href)
      if (next === DEFAULT_STATUS) {
        url.searchParams.delete(PARAM)
      } else {
        url.searchParams.set(PARAM, next)
      }
      window.history.pushState(null, "", url)
      setStatus(next)
    },
    [status],
  )

  return [status, changeStatus]
}

function readStatusFromUrl(): TaskStatusFilter {
  const parsed = taskStatusFilterSchema.safeParse(new URLSearchParams(window.location.search).get(PARAM))

  return parsed.success ? parsed.data : DEFAULT_STATUS
}

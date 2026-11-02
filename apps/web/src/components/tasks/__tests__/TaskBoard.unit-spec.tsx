import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { waitForRowExit } from "../../../lib/row-exit"
import { buildTask, installFakeTasksApi } from "../../../test/fake-tasks-api"
import { server } from "../../../test/msw-server"
import { renderApp } from "../../../test/render-app"

const TASKS_URL = "http://localhost:3000/api/v1/tasks"
const API_TASK = buildTask({ id: "11111111-1111-4111-8111-111111111111", title: "Build the task API" })
const SETUP_TASK = buildTask({
  id: "22222222-2222-4222-8222-222222222222",
  title: "Set up the project",
  completed: true,
  completedAt: "2026-11-01T11:00:00.000Z",
})

vi.mock("../../../lib/row-exit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/row-exit")>()),
  waitForRowExit: vi.fn(),
}))

describe("TaskBoard", () => {
  beforeEach(() => {
    vi.mocked(waitForRowExit).mockReset().mockResolvedValue(undefined)
  })

  it("should list the tasks with the count of every status and the tasks remaining", async () => {
    installFakeTasksApi([API_TASK, SETUP_TASK])
    renderApp()

    expect(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: 'Mark "Set up the project" as not done' })).toBeChecked()
    expect(readTabs()).toEqual(["All 2", "Active 1", "Completed 1"])
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("1 task remaining")).toBeInTheDocument()
  })

  it("should invite the first task when the list is empty", async () => {
    installFakeTasksApi()
    renderApp()

    expect(await screen.findByText("No tasks yet. Add your first one above.")).toBeInTheDocument()
    expect(screen.getByText("0 tasks remaining")).toBeInTheDocument()
  })

  it("should show the error with a retry when the list fails to load, and the list after retrying", async () => {
    installFakeTasksApi([API_TASK])
    server.use(
      http.get(
        TASKS_URL,
        () => HttpResponse.json({ type: "about:blank", title: "Bad Gateway", status: 502 }, { status: 502 }),
        {
          once: true,
        },
      ),
    )
    const { user } = renderApp()

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("We couldn't load your tasks. Something went wrong. Please try again.")

    await user.click(within(alert).getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Build the task API")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("should filter the list by status", async () => {
    const api = installFakeTasksApi([API_TASK, SETUP_TASK])
    const { user } = renderApp()
    await screen.findByText("Build the task API")

    const releaseCompletedTab = api.holdNext("GET")
    await user.click(screen.getByRole("button", { name: /^Completed/ }))
    expect(readTabs()).toEqual(["All 2", "Active 1", "Completed 1"])
    releaseCompletedTab()

    expect(await screen.findByRole("list", { name: "Tasks" })).toHaveTextContent("Set up the project")
    expect(screen.queryByText("Build the task API")).not.toBeInTheDocument()
    expect(api.requests.at(-1)).toEqual({
      method: "GET",
      url: `${TASKS_URL}?status=completed&limit=50&offset=0`,
      ifMatch: null,
      body: null,
    })
    expect(window.location.search).toBe("?status=completed")
    const historyLength = window.history.length
    await user.click(screen.getByRole("button", { name: /^Completed/ }))
    expect(window.history.length).toBe(historyLength)

    await user.click(screen.getByRole("button", { name: /^All/ }))
    expect(window.location.search).toBe("")
  })

  it("should open on the tab named in the address and follow the back button", async () => {
    window.history.replaceState(null, "", "/?status=completed")
    installFakeTasksApi([API_TASK, SETUP_TASK])
    const { user } = renderApp()

    expect(await screen.findByRole("list", { name: "Tasks" })).toHaveTextContent("Set up the project")
    expect(screen.getByRole("button", { name: /^Completed/ })).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: /^Active/ }))
    expect(await screen.findByText("Build the task API")).toBeInTheDocument()

    window.history.back()

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Completed/ })).toHaveAttribute("aria-pressed", "true"),
    )
    expect(await screen.findByText("Set up the project")).toBeInTheDocument()
  })

  it("should fall back to all tasks when the address names an unknown status", async () => {
    window.history.replaceState(null, "", "/?status=done")
    installFakeTasksApi([API_TASK, SETUP_TASK])
    renderApp()

    expect(await screen.findByText("Build the task API")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("should load the next page with Load more and let a task on it be changed", async () => {
    const tasks = Array.from({ length: 55 }, (_, index) =>
      buildTask({ id: `00000000-0000-4000-9000-${String(index).padStart(12, "0")}`, title: `Task ${index + 1}` }),
    )
    const api = installFakeTasksApi(tasks)
    const { user } = renderApp()

    expect(await screen.findAllByRole("listitem")).toHaveLength(50)

    await user.click(screen.getByRole("button", { name: "Load more" }))

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(55))
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
    expect(api.requests.filter((request) => request.method === "GET").map((request) => request.url)).toEqual([
      `${TASKS_URL}?status=all&limit=50&offset=0`,
      `${TASKS_URL}?status=all&limit=50&offset=50`,
    ])

    await user.click(screen.getByRole("checkbox", { name: 'Mark "Task 55" as done' }))

    expect(await screen.findByRole("checkbox", { name: 'Mark "Task 55" as not done' })).toBeChecked()
    expect(api.requests.find((request) => request.method === "PATCH")?.ifMatch).toBe('"1"')
  })

  describe("adding a task", () => {
    it("should create the task when Enter is pressed and clear the field", async () => {
      const api = installFakeTasksApi()
      const { user } = renderApp()
      const field = await screen.findByRole("textbox", { name: "New task" })

      await user.type(field, "  Write the README  {Enter}")

      expect(await screen.findByText("Write the README")).toBeInTheDocument()
      const row = screen.getByText("Write the README").closest("li")
      expect(row).toHaveAttribute("data-state", "entering")
      fireEvent.animationEnd(row as HTMLLIElement)
      expect(row).not.toHaveAttribute("data-state")
      expect(row?.className).not.toMatch(/animate-/)
      expect(field).toHaveValue("")
      expect(api.requests.filter((request) => request.method === "POST")).toEqual([
        { method: "POST", url: TASKS_URL, ifMatch: null, body: { title: "Write the README" } },
      ])
    })

    it("should keep a new title typed while the previous one is still being created", async () => {
      const api = installFakeTasksApi()
      const { user } = renderApp()
      const field = await screen.findByRole("textbox", { name: "New task" })
      const releaseCreate = api.holdNext("POST")

      await user.type(field, "Write the README{Enter}")
      await user.clear(field)
      await user.type(field, "Record the demo")
      releaseCreate()

      expect(await screen.findByText("Write the README")).toBeInTheDocument()
      expect(field).toHaveValue("Record the demo")
    })

    it("should explain a blank title without sending it", async () => {
      const api = installFakeTasksApi()
      const { user } = renderApp()
      const field = await screen.findByRole("textbox", { name: "New task" })

      await user.type(field, "   ")
      await user.click(screen.getByRole("button", { name: "Add task" }))

      expect(screen.getByRole("alert")).toHaveTextContent("Title must not be empty")
      expect(field).toHaveAttribute("aria-invalid", "true")
      expect(api.requests.some((request) => request.method === "POST")).toBe(false)
    })

    it("should keep the typed text and explain the failure when the API rejects it", async () => {
      installFakeTasksApi()
      server.use(
        http.post(TASKS_URL, () =>
          HttpResponse.json({ type: "about:blank", title: "Internal Server Error", status: 500 }, { status: 500 }),
        ),
      )
      const { user } = renderApp()
      const field = await screen.findByRole("textbox", { name: "New task" })

      await user.type(field, "Write the README{Enter}")

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.")
      expect(field).toHaveValue("Write the README")
    })
  })

  describe("changing a task", () => {
    it("should mark a task done with the version it was loaded at", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()

      await user.click(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' }))

      expect(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as not done' })).toBeChecked()
      await waitFor(() => expect(screen.getByText("0 tasks remaining")).toBeInTheDocument())
      expect(api.requests.filter((request) => request.method === "PATCH")).toEqual([
        { method: "PATCH", url: `${TASKS_URL}/${API_TASK.id}`, ifMatch: '"1"', body: { completed: true } },
      ])
      expect(waitForRowExit).not.toHaveBeenCalled()
    })

    it("should close up a task that leaves the Active tab once it is marked done, and keep it until it has closed", async () => {
      window.history.replaceState(null, "", "/?status=active")
      const api = installFakeTasksApi([API_TASK, SETUP_TASK])
      const { user } = renderApp()
      const releaseRowExit = holdRowExit()

      await user.click(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' }))

      const checkbox = screen.getByRole("checkbox", { name: 'Mark "Build the task API" as not done' })
      expect(checkbox).toBeChecked()
      expect(checkbox.closest("li")).toHaveAttribute("data-state", "leaving")
      await waitFor(() => expect(api.tasks.find((task) => task.id === API_TASK.id)?.completed).toBe(true))
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(checkbox.closest("li")).toHaveAttribute("data-state", "leaving")
      releaseRowExit()

      expect(await screen.findByText("Nothing left to do.")).toBeInTheDocument()
      expect(readTabs()).toEqual(["All 2", "Active 0", "Completed 2"])
      expect(api.requests.filter((request) => request.method === "PATCH")).toEqual([
        { method: "PATCH", url: `${TASKS_URL}/${API_TASK.id}`, ifMatch: '"1"', body: { completed: true } },
      ])
    })

    it("should lock a task until its change is saved, then send the next change with the new version", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()
      const releaseUpdate = api.holdNext("PATCH")

      await user.click(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' }))

      expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as not done' })).toBeDisabled()
      expect(screen.getByRole("button", { name: 'Edit "Build the task API"' })).toBeDisabled()
      expect(screen.getByRole("button", { name: 'Delete "Build the task API"' })).toBeDisabled()
      releaseUpdate()

      const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as not done' })
      await waitFor(() => expect(checkbox).toBeEnabled())
      await user.click(checkbox)

      expect(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })).not.toBeChecked()
      await waitFor(() => expect(api.tasks[0]?.version).toBe(3))
      expect(api.requests.filter((request) => request.method === "PATCH").map((request) => request.ifMatch)).toEqual([
        '"1"',
        '"2"',
      ])
    })

    it("should keep a task locked and its change shown when its tab is left and opened again mid-change", async () => {
      const api = installFakeTasksApi([API_TASK, SETUP_TASK])
      const { user } = renderApp()
      const releaseUpdate = api.holdNext("PATCH")

      await user.click(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' }))
      await user.click(screen.getByRole("button", { name: /^Completed/ }))
      await screen.findByRole("list", { name: "Tasks" })
      await user.click(screen.getByRole("button", { name: /^All/ }))

      const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as not done' })
      expect(checkbox).toBeChecked()
      expect(checkbox).toBeDisabled()
      releaseUpdate()

      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as not done' })).toBeEnabled(),
      )
      expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1)
    })

    it("should keep other tasks available while one task is being changed", async () => {
      const readmeTask = buildTask({ id: "33333333-3333-4333-8333-333333333333", title: "Write the README" })
      const api = installFakeTasksApi([API_TASK, readmeTask])
      const { user } = renderApp()
      const releaseFirstUpdate = api.holdNext("PATCH")

      await user.click(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' }))
      await user.click(screen.getByRole("checkbox", { name: 'Mark "Write the README" as done' }))

      await waitFor(() => expect(api.tasks.find((task) => task.id === readmeTask.id)?.completed).toBe(true))
      releaseFirstUpdate()
      await waitFor(() => expect(readTabs()).toEqual(["All 2", "Active 0", "Completed 2"]))
    })

    it("should show the task as last loaded when its change is saved but the reload fails", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()
      const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })
      server.use(http.get(TASKS_URL, () => HttpResponse.error(), { once: true }))

      await user.click(checkbox)

      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as done' })).toBeEnabled(),
      )
      expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as done' })).not.toBeChecked()
      expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
        "We couldn't load your tasks. Something went wrong. Please try again.Try again",
      ])
      expect(api.tasks).toEqual([
        { ...API_TASK, completed: true, completedAt: expect.any(String), updatedAt: expect.any(String), version: 2 },
      ])
    })

    it("should show the task as last loaded when its change fails and the reload fails too", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()
      const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })
      server.use(
        http.patch(`${TASKS_URL}/${API_TASK.id}`, () => HttpResponse.error(), { once: true }),
        http.get(TASKS_URL, () => HttpResponse.error(), { once: true }),
      )

      await user.click(checkbox)

      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as done' })).toBeEnabled(),
      )
      expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
        "Something went wrong. Please try again.Dismiss",
        "We couldn't load your tasks. Something went wrong. Please try again.Try again",
      ])
      expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as done' })).not.toBeChecked()
      expect(readTabs()).toEqual(["All 1", "Active 1", "Completed 0"])
      expect(api.tasks).toEqual([API_TASK])
    })

    it("should rename a task from the edit field with Enter", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()

      await user.click(await screen.findByRole("button", { name: 'Edit "Build the task API"' }))
      const field = screen.getByRole("textbox", { name: 'New title for "Build the task API"' })
      expect(field).toHaveFocus()
      await user.clear(field)
      await user.type(field, "Build the tasks API{Enter}")

      expect(await screen.findByText("Build the tasks API")).toBeInTheDocument()
      expect(api.requests.filter((request) => request.method === "PATCH")).toEqual([
        { method: "PATCH", url: `${TASKS_URL}/${API_TASK.id}`, ifMatch: '"1"', body: { title: "Build the tasks API" } },
      ])
    })

    it("should keep the draft in the editor when saving it fails, and save it on the next try", async () => {
      const api = installFakeTasksApi([API_TASK])
      server.use(http.patch(`${TASKS_URL}/${API_TASK.id}`, () => HttpResponse.error(), { once: true }))
      const { user } = renderApp()

      await user.click(await screen.findByRole("button", { name: 'Edit "Build the task API"' }))
      const field = screen.getByRole("textbox", { name: 'New title for "Build the task API"' })
      await user.clear(field)
      await user.type(field, "Build the tasks API{Enter}")

      expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole("button", { name: "Save title" })).toBeEnabled())
      expect(screen.getByRole("textbox", { name: 'New title for "Build the task API"' })).toHaveValue(
        "Build the tasks API",
      )

      await user.click(screen.getByRole("button", { name: "Save title" }))

      expect(await screen.findByRole("button", { name: 'Edit "Build the tasks API"' })).toBeInTheDocument()
      expect(api.tasks[0]?.title).toBe("Build the tasks API")
    })

    it("should save a rename with the version the editor opened at and show the newer title on a conflict", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()

      await user.click(await screen.findByRole("button", { name: 'Edit "Build the task API"' }))
      Object.assign(api.tasks[0] ?? {}, { title: "Build the task API v2", version: 2 })
      await user.type(screen.getByRole("textbox", { name: "New task" }), "Write the README{Enter}")
      await screen.findByText("Write the README")
      await waitFor(() =>
        expect(screen.getByRole("textbox", { name: 'New title for "Build the task API v2"' })).toBeInTheDocument(),
      )
      const field = screen.getByRole("textbox", { name: 'New title for "Build the task API v2"' })
      await user.clear(field)
      await user.type(field, "Build the tasks API{Enter}")

      expect(
        await screen.findByText("Someone else changed this task first. You are now seeing the latest version."),
      ).toBeInTheDocument()
      expect(await screen.findByRole("button", { name: 'Edit "Build the task API v2"' })).toBeInTheDocument()
      expect(api.requests.filter((request) => request.method === "PATCH")).toEqual([
        { method: "PATCH", url: `${TASKS_URL}/${API_TASK.id}`, ifMatch: '"1"', body: { title: "Build the tasks API" } },
      ])
      expect(api.tasks.find((task) => task.id === API_TASK.id)?.title).toBe("Build the task API v2")
    })

    it("should leave the title as it was when editing is cancelled with Escape", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()

      await user.click(await screen.findByRole("button", { name: 'Edit "Build the task API"' }))
      await user.type(screen.getByRole("textbox", { name: 'New title for "Build the task API"' }), " now{Escape}")

      expect(screen.getByText("Build the task API")).toBeInTheDocument()
      expect(api.requests.some((request) => request.method === "PATCH")).toBe(false)
    })

    it("should say the task no longer exists when it was deleted elsewhere before a change", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()
      const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })
      api.tasks.splice(0, 1)

      await user.click(checkbox)

      expect(await screen.findByRole("alert")).toHaveTextContent("This task no longer exists.")
      await waitFor(() => expect(screen.queryByText("Build the task API")).not.toBeInTheDocument())
    })

    it("should say the task changed elsewhere and show its latest state when the version is stale", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()
      const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })
      Object.assign(api.tasks[0] ?? {}, { title: "Build the task API v2", version: 2 })

      await user.click(checkbox)

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Someone else changed this task first. You are now seeing the latest version.",
      )
      expect(await screen.findByText("Build the task API v2")).toBeInTheDocument()
      expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API v2" as done' })).not.toBeChecked()

      await user.click(screen.getByRole("checkbox", { name: 'Mark "Build the task API v2" as done' }))

      expect(await screen.findByRole("checkbox", { name: 'Mark "Build the task API v2" as not done' })).toBeChecked()
      expect(api.requests.filter((request) => request.method === "PATCH").map((request) => request.ifMatch)).toEqual([
        '"1"',
        '"2"',
      ])
    })
  })

  it("should close up a deleted task, keep it until it has closed, then update the counts", async () => {
    const api = installFakeTasksApi([API_TASK, SETUP_TASK])
    const { user } = renderApp()
    const releaseRowExit = holdRowExit()

    await user.click(await screen.findByRole("button", { name: 'Delete "Build the task API"' }))

    const row = screen.getByText("Build the task API").closest("li")
    expect(row).toHaveAttribute("data-state", "leaving")
    await waitFor(() => expect(api.tasks.map((task) => task.id)).toEqual([SETUP_TASK.id]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(row).toBeInTheDocument()
    expect(row).toHaveAttribute("data-state", "leaving")
    releaseRowExit()
    await waitFor(() => expect(screen.queryByText("Build the task API")).not.toBeInTheDocument())
    expect(readTabs()).toEqual(["All 1", "Active 0", "Completed 1"])
    expect(api.requests.filter((request) => request.method === "DELETE")).toEqual([
      { method: "DELETE", url: `${TASKS_URL}/${API_TASK.id}`, ifMatch: null, body: null },
    ])
  })

  it("should remove a task someone else already deleted without reporting an error", async () => {
    const api = installFakeTasksApi([API_TASK])
    const { user } = renderApp()
    const deleteButton = await screen.findByRole("button", { name: 'Delete "Build the task API"' })
    api.tasks.splice(0, 1)

    await user.click(deleteButton)

    await waitFor(() => expect(screen.getByText("No tasks yet. Add your first one above.")).toBeInTheDocument())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

function holdRowExit(): () => void {
  let release = () => {}
  vi.mocked(waitForRowExit).mockReturnValueOnce(
    new Promise((resolve) => {
      release = () => resolve()
    }),
  )

  return () => release()
}

function readTabs(): string[] {
  const group = screen.getByRole("group", { name: "Filter tasks" })

  return within(group)
    .getAllByRole("button")
    .map((tab) => tab.textContent ?? "")
    .map((text) => text.replace(/(\D)(\d)/, "$1 $2"))
}

import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { describe, expect, it } from "vitest"
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

describe("TaskBoard", () => {
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
    })

    it("should close up a task that leaves the Active tab once it is marked done", async () => {
      window.history.replaceState(null, "", "/?status=active")
      const api = installFakeTasksApi([API_TASK, SETUP_TASK])
      const { user } = renderApp()

      await user.click(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' }))

      const checkbox = screen.getByRole("checkbox", { name: 'Mark "Build the task API" as not done' })
      expect(checkbox).toBeChecked()
      expect(checkbox.closest("li")).toHaveAttribute("data-state", "leaving")
      expect(api.requests.some((request) => request.method === "PATCH")).toBe(false)

      expect(await screen.findByText("Nothing left to do.")).toBeInTheDocument()
      expect(readTabs()).toEqual(["All 2", "Active 0", "Completed 2"])
      expect(api.requests.filter((request) => request.method === "PATCH")).toEqual([
        { method: "PATCH", url: `${TASKS_URL}/${API_TASK.id}`, ifMatch: '"1"', body: { completed: true } },
      ])
    })

    it("should send a quick second toggle with the version the first one produced", async () => {
      const api = installFakeTasksApi([API_TASK])
      const { user } = renderApp()
      const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })
      const releaseFirstUpdate = api.holdNext("PATCH")

      await user.click(checkbox)
      await user.click(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as not done' }))
      const releaseSecondUpdate = api.holdNext("PATCH")
      releaseFirstUpdate()

      await waitFor(() => expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(2))
      expect(screen.getByRole("checkbox", { name: 'Mark "Build the task API" as done' })).not.toBeChecked()
      releaseSecondUpdate()

      await waitFor(() => expect(api.tasks[0]?.version).toBe(3))
      expect(api.requests.filter((request) => request.method === "PATCH").map((request) => request.ifMatch)).toEqual([
        '"1"',
        '"2"',
      ])
      expect(await screen.findByRole("checkbox", { name: 'Mark "Build the task API" as done' })).not.toBeChecked()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
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

  it("should delete a task and update the counts", async () => {
    const api = installFakeTasksApi([API_TASK, SETUP_TASK])
    const { user } = renderApp()

    await user.click(await screen.findByRole("button", { name: 'Delete "Build the task API"' }))

    expect(screen.getByText("Build the task API").closest("li")).toHaveAttribute("data-state", "leaving")
    expect(api.requests.some((request) => request.method === "DELETE")).toBe(false)
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

function readTabs(): string[] {
  const group = screen.getByRole("group", { name: "Filter tasks" })

  return within(group)
    .getAllByRole("button")
    .map((tab) => tab.textContent ?? "")
    .map((text) => text.replace(/(\D)(\d)/, "$1 $2"))
}

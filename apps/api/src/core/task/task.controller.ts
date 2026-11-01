import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common"
import { ApiHeader, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import type { Task } from "@workspace/common"
import type { Response } from "express"
import { ZodResponse } from "nestjs-zod"
import { ApiProblemResponses } from "../../common/http/api-problem-responses"
import { parseIfMatch, toEtag } from "../../common/http/etag"
import { PARSE_ID } from "../../common/http/parse-id"
import { API_VERSION, toVersionedPath } from "../../common/http/routes"
import { CreateTaskDto } from "./dto/create-task.dto"
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto"
import { TaskPageResponseDto, TaskResponseDto } from "./dto/task-response.dto"
import { UpdateTaskDto } from "./dto/update-task.dto"
import { TaskService } from "./task.service"

const TASKS_PATH = "tasks"

@ApiTags("Tasks")
@Controller({ path: TASKS_PATH, version: API_VERSION })
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @ApiOperation({ summary: "List tasks, newest first" })
  @ZodResponse({ status: HttpStatus.OK, description: "A page of tasks", type: TaskPageResponseDto })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST)
  listTasks(@Query() query: ListTasksQueryDto) {
    return this.taskService.listTasks(query)
  }

  @Post()
  @ApiOperation({ summary: "Create a task" })
  @ZodResponse({ status: HttpStatus.CREATED, description: "The created task", type: TaskResponseDto })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST)
  async createTask(@Body() body: CreateTaskDto, @Res({ passthrough: true }) res: Response) {
    const task = await this.taskService.createTask(body)

    res.location(toVersionedPath(TASKS_PATH, task.id))
    return attachEtag(res, task)
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a task" })
  @ZodResponse({ status: HttpStatus.OK, description: "The task", type: TaskResponseDto })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async getTask(@Param("id", PARSE_ID) id: string, @Res({ passthrough: true }) res: Response) {
    return attachEtag(res, await this.taskService.getTask(id))
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename a task and/or mark it done or not done" })
  @ApiHeader({
    name: "If-Match",
    required: false,
    description: 'The task\'s current version as an ETag, e.g. "3". When it no longer matches, the API answers 412.',
  })
  @ZodResponse({ status: HttpStatus.OK, description: "The updated task", type: TaskResponseDto })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.PRECONDITION_FAILED)
  async updateTask(
    @Param("id", PARSE_ID) id: string,
    @Body() body: UpdateTaskDto,
    @Headers("if-match") ifMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return attachEtag(res, await this.taskService.updateTask(id, body, parseIfMatch(ifMatch)))
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a task" })
  @ApiNoContentResponse({ description: "The task is deleted" })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  deleteTask(@Param("id", PARSE_ID) id: string): Promise<void> {
    return this.taskService.deleteTask(id)
  }
}

function attachEtag(res: Response, task: Task): Task {
  res.setHeader("ETag", toEtag(task.version))
  return task
}

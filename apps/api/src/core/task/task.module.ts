import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { TaskEntity } from "./entities/task.entity"
import { TaskController } from "./task.controller"
import { TaskDao } from "./task.dao"
import { TaskService } from "./task.service"

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity])],
  controllers: [TaskController],
  providers: [TaskService, TaskDao],
})
export class TaskModule {}

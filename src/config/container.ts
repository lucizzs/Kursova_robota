import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

import { UserRepository } from '../repositories/user.repository';
import { ProjectRepository } from '../repositories/project.repository';
import { TaskRepository } from '../repositories/task.repository';
import { CommentRepository } from '../repositories/comment.repository';

import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { TaskService } from '../services/task.service';
import { CommentService } from '../services/comment.service';
import { StatsService } from '../services/stats.service';

import { AuthController } from '../controllers/auth.controller';
import { ProjectController } from '../controllers/project.controller';
import { TaskController } from '../controllers/task.controller';
import { CommentController } from '../controllers/comment.controller';
import { StatsController } from '../controllers/stats.controller';

export interface AppContainer {
  authController: AuthController;
  projectController: ProjectController;
  taskController: TaskController;
  commentController: CommentController;
  statsController: StatsController;
}

export function buildContainer(prisma: PrismaClient, redis: Redis): AppContainer {
  // Repositories
  const userRepo = new UserRepository(prisma);
  const projectRepo = new ProjectRepository(prisma);
  const taskRepo = new TaskRepository(prisma);
  const commentRepo = new CommentRepository(prisma);

  // Services
  const authService = new AuthService(userRepo);
  const projectService = new ProjectService(projectRepo, userRepo);
  const taskService = new TaskService(taskRepo, projectService);
  const commentService = new CommentService(commentRepo, taskRepo, projectService);
  const statsService = new StatsService(taskRepo, projectService, redis);

  // Controllers
  return {
    authController: new AuthController(authService),
    projectController: new ProjectController(projectService),
    taskController: new TaskController(taskService, statsService),
    commentController: new CommentController(commentService),
    statsController: new StatsController(statsService),
  };
}

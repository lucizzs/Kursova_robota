import { PrismaClient, Prisma } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto } from '../dto/task.dto';

// Тип задачі з включеними зв'язками
const taskWithRelations = {
  include: {
    assignee: { select: { id: true, name: true, email: true } },
    createdBy: { select: { id: true, name: true, email: true } },
  },
} as const;

type TaskWithRelations = Prisma.TaskGetPayload<typeof taskWithRelations>;

export class TaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(projectId: string, createdById: string, data: CreateTaskDto): Promise<TaskWithRelations> {
    return this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        assigneeId: data.assigneeId,
        projectId,
        createdById,
      },
      ...taskWithRelations,
    });
  }

  async findById(id: string): Promise<TaskWithRelations | null> {
    return this.prisma.task.findUnique({
      where: { id },
      ...taskWithRelations,
    });
  }

  async findManyByProject(
    projectId: string,
    filter: TaskFilterDto,
  ): Promise<{ items: TaskWithRelations[]; total: number }> {
    const where: Prisma.TaskWhereInput = { projectId };
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    if (filter.assigneeId) where.assigneeId = filter.assigneeId;
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        orderBy: { createdAt: 'desc' },
        ...taskWithRelations,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, data: UpdateTaskDto): Promise<TaskWithRelations> {
    return this.prisma.task.update({
      where: { id },
      data,
      ...taskWithRelations,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }

  async countByStatus(projectId: string): Promise<Record<string, number>> {
    const grouped = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { status: true },
    });
    const result: Record<string, number> = {};
    for (const row of grouped) {
      result[row.status] = row._count.status;
    }
    return result;
  }
}

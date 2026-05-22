import { PrismaClient, Comment } from '@prisma/client';

export class CommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(taskId: string, authorId: string, content: string): Promise<Comment> {
    return this.prisma.comment.create({ data: { taskId, authorId, content } });
  }

  async findByTask(taskId: string): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string): Promise<Comment | null> {
    return this.prisma.comment.findUnique({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.comment.delete({ where: { id } });
  }
}

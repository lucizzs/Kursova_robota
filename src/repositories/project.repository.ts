import { PrismaClient, Project, ProjectMember, ProjectRole } from '@prisma/client';

export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { name: string; description?: string; ownerId: string }): Promise<Project> {
    return this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: data.ownerId,
        members: { create: { userId: data.ownerId, role: ProjectRole.OWNER } },
      },
    });
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  async findByIdWithCounts(
    id: string,
  ): Promise<(Project & { _count: { members: number; tasks: number } }) | null> {
    return this.prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { members: true, tasks: true } } },
    }) as Promise<(Project & { _count: { members: number; tasks: number } }) | null>;
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: { name?: string; description?: string | null }): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async addMember(projectId: string, userId: string): Promise<ProjectMember> {
    return this.prisma.projectMember.create({
      data: { projectId, userId, role: ProjectRole.MEMBER },
    });
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async findMembers(projectId: string): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role }));
  }
}

import { PrismaClient, User } from '@prisma/client';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async findByName(name: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }

  async searchByName(query: string): Promise<Pick<User, 'id' | 'name' | 'email'>[]> {
    return this.prisma.user.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
      take: 10,
    });
  }
}

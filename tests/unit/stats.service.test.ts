import { StatsService } from '../../src/services/stats.service';
import { TaskRepository } from '../../src/repositories/task.repository';
import { ProjectService } from '../../src/services/project.service';
import type { Redis } from 'ioredis';

function makeTaskRepoMock(): jest.Mocked<TaskRepository> {
  return {
    countByStatus: jest.fn(),
  } as unknown as jest.Mocked<TaskRepository>;
}

function makeProjectServiceMock(): jest.Mocked<ProjectService> {
  return {
    ensureMember: jest.fn(),
  } as unknown as jest.Mocked<ProjectService>;
}

function makeRedisMock(): jest.Mocked<Redis> {
  return {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  } as unknown as jest.Mocked<Redis>;
}

describe('StatsService', () => {
  let tasks: jest.Mocked<TaskRepository>;
  let projectService: jest.Mocked<ProjectService>;
  let redis: jest.Mocked<Redis>;
  let service: StatsService;

  beforeEach(() => {
    tasks = makeTaskRepoMock();
    projectService = makeProjectServiceMock();
    redis = makeRedisMock();
    service = new StatsService(tasks, projectService, redis);
  });

  it('повертає кешовану відповідь, коли є', async () => {
    projectService.ensureMember.mockResolvedValue();
    redis.get.mockResolvedValue(
      JSON.stringify({ projectId: 'p1', byStatus: { TODO: 2 }, total: 2 }),
    );

    const res = await service.getProjectStats('u1', 'p1');
    expect(res.cached).toBe(true);
    expect(res.total).toBe(2);
    expect(tasks.countByStatus).not.toHaveBeenCalled();
  });

  it('обчислює і кешує, якщо кеш порожній', async () => {
    projectService.ensureMember.mockResolvedValue();
    redis.get.mockResolvedValue(null);
    tasks.countByStatus.mockResolvedValue({ TODO: 3, DONE: 2 });

    const res = await service.getProjectStats('u1', 'p1');
    expect(res.cached).toBe(false);
    expect(res.total).toBe(5);
    expect(res.byStatus).toEqual({ TODO: 3, DONE: 2 });
    expect(redis.setex).toHaveBeenCalled();
  });

  it('падіння Redis не блокує — gracefully degrades', async () => {
    projectService.ensureMember.mockResolvedValue();
    redis.get.mockRejectedValue(new Error('Redis down'));
    tasks.countByStatus.mockResolvedValue({ TODO: 1 });

    const res = await service.getProjectStats('u1', 'p1');
    expect(res.total).toBe(1);
    expect(res.cached).toBe(false);
  });

  it('invalidateProjectStats — викликає DEL', async () => {
    await service.invalidateProjectStats('p1');
    expect(redis.del).toHaveBeenCalledWith('stats:project:p1');
  });
});

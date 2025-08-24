import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, TodoPriority, TodoStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TodosService {
  constructor(private prisma: PrismaService) {}

  private async resolveAccountingClientIdOrThrow(clientEin: string, user: User) {
    const ac = await this.prisma.accountingClients.findFirst({
      where: {
        accountingCompanyId: user.accountingCompanyId,
        clientCompany: { ein: clientEin },
      },
      select: { id: true },
    });
    if (!ac) throw new ForbiddenException('Client not accessible');
    return ac.id;
  }

  async listTodos(
    clientEin: string,
    user: User,
    params: {
      page?: number;
      size?: number;
      q?: string;
      status?: TodoStatus | 'all';
      priority?: TodoPriority | 'all';
      assigneeId?: number;
      dueFrom?: string;
      dueTo?: string;
      tags?: string[];
    },
  ) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);

    const {
      page = 1,
      size = 25,
      q,
      status,
      priority,
      assigneeId,
      dueFrom,
      dueTo,
      tags,
    } = params;

    const where: Prisma.TodoItemWhereInput = {
      accountingClientId,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(status && status !== 'all' ? { status: status as TodoStatus } : {}),
      ...(priority && priority !== 'all' ? { priority: priority as TodoPriority } : {}),
      ...(assigneeId ? { assignedToId: assigneeId } : {}),
      ...(dueFrom || dueTo
        ? {
            dueDate: {
              ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
              ...(dueTo ? { lte: new Date(dueTo) } : {}),
            },
          }
        : {}),
      ...(tags && tags.length ? { tags: { hasSome: tags } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.todoItem.findMany({
        where,
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * size,
        take: size,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          relatedDocument: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.todoItem.count({ where }),
    ]);

    return { items, total };
  }

  async createTodo(clientEin: string, user: User, data: {
    title: string;
    description?: string;
    status?: TodoStatus;
    priority?: TodoPriority;
    dueDate?: string;
    tags?: string[];
    assignedToId?: number;
    relatedDocumentId?: number;
    relatedTransactionId?: string;
  }) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);

    const todo = await this.prisma.todoItem.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status ?? 'PENDING',
        priority: data.priority ?? 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        tags: data.tags ?? [],
        accountingClientId,
        createdById: user.id,
        assignedToId: data.assignedToId,
        relatedDocumentId: data.relatedDocumentId,
        relatedTransactionId: data.relatedTransactionId,
      },
    });

    return todo;
  }

  async updateTodo(clientEin: string, user: User, id: number, data: Partial<{
    title: string;
    description?: string;
    status?: TodoStatus;
    priority?: TodoPriority;
    dueDate?: string;
    tags?: string[];
    assignedToId?: number;
    relatedDocumentId?: number;
    relatedTransactionId?: string;
  }>) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);

    const existing = await this.prisma.todoItem.findFirst({ where: { id, accountingClientId } });
    if (!existing) throw new NotFoundException('Todo not found');

    const updated = await this.prisma.todoItem.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId } : {}),
        ...(data.relatedDocumentId !== undefined ? { relatedDocumentId: data.relatedDocumentId } : {}),
        ...(data.relatedTransactionId !== undefined ? { relatedTransactionId: data.relatedTransactionId } : {}),
      },
    });

    return updated;
  }

  async deleteTodo(clientEin: string, user: User, id: number) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);
    const existing = await this.prisma.todoItem.findFirst({ where: { id, accountingClientId } });
    if (!existing) throw new NotFoundException('Todo not found');

    await this.prisma.todoItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  async getTodo(clientEin: string, user: User, id: number) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);
    const todo = await this.prisma.todoItem.findFirst({
      where: { id, accountingClientId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        relatedDocument: { select: { id: true, name: true, type: true } },
      },
    });
    if (!todo) throw new NotFoundException('Todo not found');
    return todo;
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma, TodoPriority, TodoStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TodosService {
  constructor(private prisma: PrismaService) {}

  // Normalize incoming priority strings (e.g., "medium") to Prisma enum values
  private normalizePriority(p: any): TodoPriority | undefined {
    if (p === undefined || p === null) return undefined;
    const s = String(p).toUpperCase();
    if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH') return s as TodoPriority;
    return undefined;
  }

  // Resolve assignee IDs from provided IDs, names, or emails. Names/emails are looked up within the same accounting company.
  private async resolveAssigneeIds(
    user: User,
    input: { assigneeIds?: number[]; assignedToId?: number; assigneeNames?: string[]; assigneeEmails?: string[] },
  ): Promise<number[]> {
    const ids = new Set<number>();
    if (input.assignedToId) ids.add(input.assignedToId);
    if (input.assigneeIds && input.assigneeIds.length) {
      for (const id of input.assigneeIds) ids.add(id);
    }

    const names = (input.assigneeNames || []).map((s) => s.trim()).filter(Boolean);
    const emails = (input.assigneeEmails || []).map((s) => s.trim()).filter(Boolean);

    if (names.length || emails.length) {
      const users = await this.prisma.user.findMany({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          OR: [
            ...(names.length ? names.map((n) => ({ name: { equals: n, mode: 'insensitive' as const } })) : []),
            ...(emails.length ? emails.map((e) => ({ email: { equals: e, mode: 'insensitive' as const } })) : []),
          ],
        },
        select: { id: true, name: true, email: true },
      });

      // Build quick lookup to check coverage
      const foundByName = new Set(users.map((u) => u.name?.toLowerCase()).filter(Boolean) as string[]);
      const foundByEmail = new Set(users.map((u) => u.email?.toLowerCase()).filter(Boolean) as string[]);

      // Validate: if a provided identifier didn't match anyone, throw a helpful error
      const missingNames = names.filter((n) => !foundByName.has(n.toLowerCase()));
      const missingEmails = emails.filter((e) => !foundByEmail.has(e.toLowerCase()));
      if (missingNames.length || missingEmails.length) {
        throw new BadRequestException(
          `Unknown assignees: ${[
            ...(missingNames.length ? [`names: ${missingNames.join(', ')}`] : []),
            ...(missingEmails.length ? [`emails: ${missingEmails.join(', ')}`] : []),
          ].join(' | ')}`,
        );
      }

      for (const u of users) ids.add(u.id);
    }

    return Array.from(ids);
  }

  // Attempt to conservatively parse assignees from a free-text description.
  // Supported patterns (case-insensitive):
  //  - "assignee: john doe, jane@example.com"
  //  - "assigned to: john doe"
  // If found and no assignees were explicitly provided, return extracted names/emails and a cleaned description.
  private parseAssigneesFromDescription(desc?: string): {
    names: string[];
    emails: string[];
    cleaned: string | undefined;
  } {
    if (!desc) return { names: [], emails: [], cleaned: desc };
    const lines = desc.split(/\r?\n/);
    const names: string[] = [];
    const emails: string[] = [];
    const outLines: string[] = [];
    const re = /^(assignee|assigned\s*to)\s*:\s*(.+)$/i;
    for (const line of lines) {
      const m = line.match(re);
      if (!m) {
        outLines.push(line);
        continue;
      }
      const payload = m[2];
      // split by comma and trim
      const parts = payload
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        // crude email vs name split
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) emails.push(p);
        else names.push(p);
      }
    }
    const cleaned = outLines.join('\n').trim() || undefined;
    return { names, emails, cleaned };
  }

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
      assigneeIds?: number[];
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
      assigneeIds,
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
      ...(assigneeId ? { assignees: { some: { userId: assigneeId } } } : {}),
      ...(assigneeIds && assigneeIds.length ? { assignees: { some: { userId: { in: assigneeIds } } } } : {}),
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
        // Primary: sortOrder ASC (custom manual ordering)
        // Secondary: status/priority/dueDate/createdAt for reasonable defaults
        orderBy: [
          { sortOrder: 'asc' as const },
          { status: 'asc' as const },
          { priority: 'desc' as const },
          { dueDate: 'asc' as const },
          { createdAt: 'desc' as const },
        ],
        skip: (page - 1) * size,
        take: size,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
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
    assigneeIds?: number[];
    assignedToId?: number; // backward-compat
    assigneeNames?: string[];
    assigneeEmails?: string[];
    relatedDocumentId?: number;
    relatedTransactionId?: string;
  }) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);

    // If no explicit assignees provided, try to parse from description directive
    let parsed = { names: [] as string[], emails: [] as string[], cleaned: data.description };
    const hasExplicitAssignees =
      (data.assigneeIds && data.assigneeIds.length) ||
      data.assignedToId !== undefined ||
      (data.assigneeNames && data.assigneeNames.length) ||
      (data.assigneeEmails && data.assigneeEmails.length);
    if (!hasExplicitAssignees) {
      parsed = this.parseAssigneesFromDescription(data.description);
      if ((parsed.names.length || parsed.emails.length) && parsed.cleaned !== undefined) {
        data = { ...data, description: parsed.cleaned, assigneeNames: parsed.names, assigneeEmails: parsed.emails } as any;
      }
    }

    const assigneeIds = await this.resolveAssigneeIds(user, {
      assigneeIds: data.assigneeIds,
      assignedToId: data.assignedToId,
      assigneeNames: data.assigneeNames,
      assigneeEmails: data.assigneeEmails,
    });

    // Determine next sortOrder for this client's todos (simple incremental ordering)
    const maxSort = await this.prisma.todoItem.aggregate({
      where: { accountingClientId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSort._max.sortOrder ?? 0) + 1;

    const normalizedPriority = this.normalizePriority((data as any).priority);

    // Idempotency/deduplication: if an identical todo was created recently, return it instead.
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15_000); // 15 seconds window
    const existing = await this.prisma.todoItem.findFirst({
      where: {
        accountingClientId,
        createdById: user.id,
        title: data.title,
        description: data.description ?? null,
        status: (data.status ?? 'PENDING') as TodoStatus,
        priority: (normalizedPriority ?? 'MEDIUM') as TodoPriority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        relatedDocumentId: data.relatedDocumentId ?? null,
        relatedTransactionId: data.relatedTransactionId ?? null,
        createdAt: { gte: windowStart },
      },
    });
    if (existing) {
      return existing;
    }

    const todo = await this.prisma.todoItem.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status ?? 'PENDING',
        priority: normalizedPriority ?? 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        tags: data.tags ?? [],
        accountingClientId,
        createdById: user.id,
        relatedDocumentId: data.relatedDocumentId,
        relatedTransactionId: data.relatedTransactionId,
        sortOrder: nextSortOrder,
        ...(assigneeIds && assigneeIds.length
          ? { assignees: { create: assigneeIds.map((id) => ({ userId: id })) } }
          : {}),
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
    assigneeIds?: number[];
    assignedToId?: number; // backward-compat
    assigneeNames?: string[];
    assigneeEmails?: string[];
    relatedDocumentId?: number;
    relatedTransactionId?: string;
  }>) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);

    const existing = await this.prisma.todoItem.findFirst({ where: { id, accountingClientId } });
    if (!existing) throw new NotFoundException('Todo not found');

    // If any assignee fields are present, resolve them now
    const shouldUpdateAssignees = (
      data.assigneeIds !== undefined ||
      data.assignedToId !== undefined ||
      data.assigneeNames !== undefined ||
      data.assigneeEmails !== undefined
    );

    const resolvedAssigneeIds = shouldUpdateAssignees
      ? await this.resolveAssigneeIds(user, {
          assigneeIds: data.assigneeIds,
          assignedToId: data.assignedToId,
          assigneeNames: data.assigneeNames,
          assigneeEmails: data.assigneeEmails,
        })
      : undefined;

    const updated = await this.prisma.todoItem.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined
          ? { priority: this.normalizePriority((data as any).priority) ?? existing.priority }
          : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.relatedDocumentId !== undefined ? { relatedDocumentId: data.relatedDocumentId } : {}),
        ...(data.relatedTransactionId !== undefined ? { relatedTransactionId: data.relatedTransactionId } : {}),
        ...(
          shouldUpdateAssignees
          ? {
              assignees: {
                deleteMany: {},
                ...(resolvedAssigneeIds && resolvedAssigneeIds.length
                  ? { create: resolvedAssigneeIds.map((id) => ({ userId: id })) }
                  : {}),
              },
            }
          : {}),
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
        assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
        relatedDocument: { select: { id: true, name: true, type: true } },
      },
    });
    if (!todo) throw new NotFoundException('Todo not found');
    return todo;
  }

  // Batch reorder todos by setting their sortOrder values.
  async reorderTodos(
    clientEin: string,
    user: User,
    items: Array<{ id: number; sortOrder: number }>,
  ) {
    const accountingClientId = await this.resolveAccountingClientIdOrThrow(clientEin, user);

    // Validate that all ids belong to this accounting client
    const ids = items.map((i) => i.id);
    const existing = await this.prisma.todoItem.findMany({ where: { id: { in: ids }, accountingClientId }, select: { id: true } });
    const existingIds = new Set(existing.map((e) => e.id));
    for (const { id } of items) {
      if (!existingIds.has(id)) throw new NotFoundException(`Todo ${id} not found`);
    }

    await this.prisma.$transaction(
      items.map(({ id, sortOrder }) =>
        this.prisma.todoItem.update({ where: { id }, data: { sortOrder } }),
      ),
    );

    return { updated: items.length };
  }
}

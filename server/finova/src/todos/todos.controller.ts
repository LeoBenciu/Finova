import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { GetUser } from 'src/auth/decorator';
import { TodosService } from './todos.service';
import { TodoPriority, TodoStatus, User } from '@prisma/client';

@UseGuards(JwtGuard)
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get(':clientEin')
  async list(
    @Param('clientEin') clientEin: string,
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('q') q?: string,
    @Query('status') status?: TodoStatus | 'all',
    @Query('priority') priority?: TodoPriority | 'all',
    @Query('assigneeId') assigneeId?: string, 
    @Query('assigneeIds') assigneeIds?: string, 
    @Query('dueFrom') dueFrom?: string,
    @Query('dueTo') dueTo?: string,
    @Query('tags') tags?: string,
  ) {
    const tagsArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    const parsedAssigneeIds = assigneeIds
      ? assigneeIds
          .split(',')
          .map((t) => Number(t.trim()))
          .filter((n) => !Number.isNaN(n))
      : undefined;
    return this.todosService.listTodos(clientEin, user, {
      page: Number(page) || 1,
      size: Number(size) || 25,
      q,
      status,
      priority,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
      assigneeIds: parsedAssigneeIds,
      // Future: extend service to accept assigneeIds[] if needed
      dueFrom,
      dueTo,
      tags: tagsArray,
    });
  }

  @Get(':clientEin/:id')
  async getOne(
    @Param('clientEin') clientEin: string,
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return this.todosService.getTodo(clientEin, user, id);
  }

  @Post(':clientEin')
  async create(
    @Param('clientEin') clientEin: string,
    @GetUser() user: User,
    @Body()
    data: {
      title: string;
      description?: string;
      status?: TodoStatus;
      priority?: TodoPriority;
      dueDate?: string;
      tags?: string[];
      assigneeIds?: number[]; 
      assignedToId?: number; 
      relatedDocumentId?: number;
      relatedTransactionId?: string;
    },
  ) {
    return this.todosService.createTodo(clientEin, user, data);
  }

  @Put(':clientEin/:id')
  async update(
    @Param('clientEin') clientEin: string,
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Body() data: Partial<{
      title: string;
      description?: string;
      status?: TodoStatus;
      priority?: TodoPriority;
      dueDate?: string;
      tags?: string[];
      assigneeIds?: number[]; 
      assignedToId?: number; 
      relatedDocumentId?: number;
      relatedTransactionId?: string;
    }>,
  ) {
    return this.todosService.updateTodo(clientEin, user, id, data);
  }

  @Delete(':clientEin/:id')
  async remove(
    @Param('clientEin') clientEin: string,
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    return this.todosService.deleteTodo(clientEin, user, id);
  }
}

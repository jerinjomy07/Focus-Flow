// mobile/src/api/tasks.ts
// FocusFlow Mobile — Tasks API Endpoints

import { api } from './client';
import { Task, TaskPriority, TaskStatus } from '../types';

export interface TaskFilters {
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export const tasksApi = {
  getTasks: async (filters: TaskFilters = {}): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (filters.projectId) params.append('projectId', filters.projectId);
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get<any>(`/tasks${query}`);
    return Array.isArray(res) ? res : res?.tasks || [];
  },

  createTask: async (data: {
    title: string;
    description?: string;
    projectId?: string;
    priority?: TaskPriority;
    dueDate?: string;
    estimatedMinutes?: number;
  }): Promise<Task> => {
    const res = await api.post<any>('/tasks', data);
    return res?.task || res;
  },

  updateTask: async (
    id: string,
    data: {
      title?: string;
      description?: string | null;
      projectId?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string | null;
      estimatedMinutes?: number | null;
    }
  ): Promise<Task> => {
    const res = await api.patch<any>(`/tasks/${id}`, data);
    return res?.task || res;
  },

  completeTask: async (id: string): Promise<Task> => {
    const res = await api.post<any>(`/tasks/${id}/complete`);
    return res?.task || res;
  },

  reopenTask: async (id: string): Promise<Task> => {
    const res = await api.post<any>(`/tasks/${id}/reopen`);
    return res?.task || res;
  },

  deleteTask: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },
};

// mobile/src/api/projects.ts
// FocusFlow Mobile — Projects API Endpoints

import { api } from './client';
import { Project } from '../types';

export const projectsApi = {
  getProjects: async (includeArchived: boolean = false): Promise<Project[]> => {
    const res = await api.get<any>(`/projects${includeArchived ? '?archived=true' : ''}`);
    return Array.isArray(res) ? res : res?.projects || [];
  },

  createProject: async (data: { name: string; color?: string }): Promise<Project> => {
    const res = await api.post<any>('/projects', data);
    return res?.project || res;
  },

  updateProject: async (id: string, data: { name?: string; color?: string }): Promise<Project> => {
    const res = await api.patch<any>(`/projects/${id}`, data);
    return res?.project || res;
  },

  archiveProject: async (id: string): Promise<Project> => {
    const res = await api.post<any>(`/projects/${id}/archive`);
    return res?.project || res;
  },

  restoreProject: async (id: string): Promise<Project> => {
    const res = await api.post<any>(`/projects/${id}/restore`);
    return res?.project || res;
  },

  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};

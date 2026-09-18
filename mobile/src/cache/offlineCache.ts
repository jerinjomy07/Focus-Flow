// mobile/src/cache/offlineCache.ts
// FocusFlow Mobile — Conservative Read-Only Offline Cache
//
// Caches non-sensitive, read-only entity data in AsyncStorage for offline resilience.
// Strictly NEVER queues optimistic focus session state transitions offline.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Task, UserSettings, ProductivitySummary } from '../types';

const CACHE_KEYS = {
  PROJECTS: 'focusflow_cache_projects',
  TASKS: 'focusflow_cache_tasks',
  SETTINGS: 'focusflow_cache_settings',
  PRODUCTIVITY_SUMMARY: 'focusflow_cache_summary',
};

export const offlineCache = {
  saveProjects: async (projects: Project[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch {
      // Ignore cache write errors
    }
  },

  getCachedProjects: async (): Promise<Project[] | null> => {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.PROJECTS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveTasks: async (tasks: Task[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {
      // Ignore cache write errors
    }
  },

  getCachedTasks: async (): Promise<Task[] | null> => {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.TASKS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveSettings: async (settings: UserSettings): Promise<void> => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore cache write errors
    }
  },

  getCachedSettings: async (): Promise<UserSettings | null> => {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveProductivitySummary: async (summary: ProductivitySummary): Promise<void> => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PRODUCTIVITY_SUMMARY, JSON.stringify(summary));
    } catch {
      // Ignore cache write errors
    }
  },

  getCachedProductivitySummary: async (): Promise<ProductivitySummary | null> => {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.PRODUCTIVITY_SUMMARY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  clearAllCache: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
    } catch {
      // Ignore cache cleanup errors
    }
  },
};

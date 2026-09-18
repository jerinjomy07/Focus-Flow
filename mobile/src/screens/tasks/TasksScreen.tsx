// mobile/src/screens/tasks/TasksScreen.tsx
// FocusFlow Mobile — Tasks & Projects Management Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../api/tasks';
import { projectsApi } from '../../api/projects';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { colors, spacing, borderRadius, typography, layout } from '../../theme';
import { audioHapticsService } from '../../services/audioHapticsService';

export const TasksScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TaskStatus>('TODO');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  // 1. Fetch tasks
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', activeTab],
    queryFn: () => tasksApi.getTasks({ status: activeTab }),
  });

  // 2. Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(false),
  });

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!newTaskTitle.trim()) return;
      return tasksApi.createTask({
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        projectId: selectedProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsCreateModalVisible(false);
      setNewTaskTitle('');
      setNewTaskPriority('MEDIUM');
      setSelectedProjectId(undefined);
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Failed to create task');
    },
  });

  // Toggle Complete Mutation
  const toggleTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      audioHapticsService.hapticPauseResume();
      if (task.status === 'DONE') {
        return tasksApi.reopenTask(task.id);
      } else {
        return tasksApi.completeTask(task.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['productivitySummary'] });
    },
  });

  // Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return tasksApi.deleteTask(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const confirmDelete = (task: Task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTaskMutation.mutate(task.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title} accessibilityRole="header">Tasks</Text>
          <Text style={styles.subtitle}>Organize your deep work backlog.</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsCreateModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add new task"
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'TODO' && styles.tabActive]}
          onPress={() => setActiveTab('TODO')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'TODO' }}
        >
          <Text style={[styles.tabText, activeTab === 'TODO' && styles.tabTextActive]}>
            To Do
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'DONE' && styles.tabActive]}
          onPress={() => setActiveTab('DONE')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'DONE' }}
        >
          <Text style={[styles.tabText, activeTab === 'DONE' && styles.tabTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      {isTasksLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.primaryLight} size="large" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => toggleTaskMutation.mutate(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.status === 'DONE' }}
                accessibilityLabel={`Mark task ${item.title} as ${item.status === 'DONE' ? 'incomplete' : 'complete'}`}
              >
                <View style={[styles.checkbox, item.status === 'DONE' && styles.checkboxChecked]}>
                  {item.status === 'DONE' && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>

              <View style={styles.taskDetails}>
                <Text
                  style={[styles.taskTitle, item.status === 'DONE' && styles.taskTitleDone]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                <View style={styles.metaRow}>
                  {item.project && (
                    <View style={styles.projectTag}>
                      <View style={[styles.projectDot, { backgroundColor: item.project.color }]} />
                      <Text style={styles.projectText}>{item.project.name}</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.priorityBadge,
                      item.priority === 'LOW' && styles.priority_LOW,
                      item.priority === 'MEDIUM' && styles.priority_MEDIUM,
                      item.priority === 'HIGH' && styles.priority_HIGH,
                      item.priority === 'URGENT' && styles.priority_URGENT,
                    ]}
                  >
                    <Text style={styles.priorityText}>{item.priority}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => confirmDelete(item)}
                accessibilityRole="button"
                accessibilityLabel={`Delete task ${item.title}`}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {activeTab === 'TODO' ? 'No tasks to do!' : 'No completed tasks yet.'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'TODO'
                  ? 'Tap "+ New Task" to create your next focus goal.'
                  : 'Complete sessions to populate your accomplishment archive.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Create Task Modal */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Task</Text>
              <TouchableOpacity
                onPress={() => setIsCreateModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="What are you working on?"
              placeholderTextColor={colors.textMuted}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
              accessibilityLabel="Task title input"
            />

            {/* Priority Selector */}
            <Text style={styles.modalFieldLabel}>Priority</Text>
            <View style={styles.prioritySelector}>
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TaskPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    newTaskPriority === p && styles.priorityOptionActive,
                  ]}
                  onPress={() => setNewTaskPriority(p)}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      newTaskPriority === p && styles.priorityOptionTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Project Selector */}
            {projects.length > 0 && (
              <>
                <Text style={styles.modalFieldLabel}>Project (Optional)</Text>
                <View style={styles.projectSelector}>
                  {projects.map((proj) => (
                    <TouchableOpacity
                      key={proj.id}
                      style={[
                        styles.projectOption,
                        selectedProjectId === proj.id && styles.projectOptionActive,
                      ]}
                      onPress={() =>
                        setSelectedProjectId(selectedProjectId === proj.id ? undefined : proj.id)
                      }
                    >
                      <View style={[styles.projectDot, { backgroundColor: proj.color }]} />
                      <Text
                        style={[
                          styles.projectOptionText,
                          selectedProjectId === proj.id && styles.projectOptionTextActive,
                        ]}
                      >
                        {proj.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                (!newTaskTitle.trim() || createTaskMutation.isPending) && styles.buttonDisabled,
              ]}
              onPress={() => createTaskMutation.mutate()}
              disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Save new task"
            >
              {createTaskMutation.isPending ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.modalSubmitText}>Save Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  addButton: {
    height: 38,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    ...typography.bodyBold,
    color: colors.text,
    fontSize: 13,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingVertical: spacing.md,
    marginRight: spacing.xl,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  taskDetails: {
    flex: 1,
    marginHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  taskTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  projectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  projectText: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  priority_LOW: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  priority_MEDIUM: { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
  priority_HIGH: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  priority_URGENT: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  priorityText: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  deleteButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  emptyContainer: {
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  input: {
    height: layout.minTouchTarget,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  modalFieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  priorityOption: {
    flex: 1,
    height: 38,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  priorityOptionText: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  priorityOptionTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  projectSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.round,
  },
  projectOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  projectOptionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  projectOptionTextActive: {
    color: colors.primaryLight,
  },
  modalSubmitButton: {
    height: layout.minTouchTarget,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    ...typography.bodyBold,
    color: colors.text,
  },
});

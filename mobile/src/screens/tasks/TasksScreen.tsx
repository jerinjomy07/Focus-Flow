// mobile/src/screens/tasks/TasksScreen.tsx
// FocusFlow Mobile — Tasks & Directive Backlog Screen (Stitch Redesign)
//
// Source of Truth:
// - Dark: mobile/design/stitch_focusflow_futuristic_redesign/tasks_backlog/
// - Light: mobile/design/stitch_focusflow_futuristic_redesign/tasks_backlog_terra_design/

import React, { useState, useMemo } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Check,
  Play,
  Trash2,
  SlidersHorizontal,
  Clock,
  X,
} from 'lucide-react-native';
import { tasksApi } from '../../api/tasks';
import { projectsApi } from '../../api/projects';
import { Task, TaskPriority, TaskStatus, Project } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { audioHapticsService } from '../../services/audioHapticsService';
import {
  GlassCard,
  KineticButton,
  MetricBadge,
  ScreenHeader,
  ProjectManagerModal,
} from '../../components';

export const TasksScreen: React.FC = () => {
  const router = useRouter();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TaskStatus>('TODO');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [modalProjectId, setModalProjectId] = useState<string | undefined>(undefined);

  // Project streams management modal state
  const [isManageProjectsVisible, setIsManageProjectsVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // 1. Fetch tasks
  const { data: allTasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', activeTab],
    queryFn: () => tasksApi.getTasks({ status: activeTab }),
  });

  // 2. Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(false),
  });

  // Filter tasks by search query and project
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      const matchesSearch =
        !searchQuery.trim() ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesProject =
        !selectedProjectId || task.projectId === selectedProjectId;
      return matchesSearch && matchesProject;
    });
  }, [allTasks, searchQuery, selectedProjectId]);

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!newTaskTitle.trim()) return;
      return tasksApi.createTask({
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        projectId: modalProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsCreateModalVisible(false);
      setNewTaskTitle('');
      setNewTaskPriority('MEDIUM');
      setModalProjectId(undefined);
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
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTaskMutation.mutate(task.id),
      },
    ]);
  };

  const handleFocusTask = (task: Task) => {
    audioHapticsService.hapticStart();
    router.push('/(tabs)/focus');
  };

  const renderPriorityBadge = (priority: TaskPriority) => {
    let label = 'P2 Med';
    let badgeColor = colors.primaryLight;
    let containerBg = isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(74, 124, 89, 0.12)';

    switch (priority) {
      case 'URGENT':
        label = 'P0 Urgent';
        badgeColor = colors.error;
        containerBg = isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(186, 26, 26, 0.15)';
        break;
      case 'HIGH':
        label = 'P1 High';
        badgeColor = colors.error;
        containerBg = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(186, 26, 26, 0.1)';
        break;
      case 'MEDIUM':
        label = 'P2 Med';
        badgeColor = colors.warning;
        containerBg = isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(163, 116, 23, 0.12)';
        break;
      case 'LOW':
        label = 'P3 Low';
        badgeColor = colors.secondary;
        containerBg = isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(45, 90, 67, 0.1)';
        break;
    }

    return (
      <View style={[styles.priorityPill, { backgroundColor: containerBg }]}>
        <Text style={[typography.labelTelemetry, { color: badgeColor, fontSize: 10, fontWeight: '700' }]}>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]} edges={['top']}>
      {/* Unified HUD Screen Header */}
      <ScreenHeader
        title="Tasks"
        subtitle="Organize & orchestrate deep work backlog"
        statusText="BACKLOG"
      />

      <View style={styles.mainContent}>
        {/* Top Action Bar & New Task Button */}
        <View style={styles.actionRow}>
          {/* Recessed Search Bar */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? 'rgba(13, 19, 31, 0.85)' : 'rgba(233, 228, 217, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
              },
            ]}
          >
            <Search size={17} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[typography.bodySm, styles.searchInput, { color: colors.text }]}
              placeholder="Search objectives..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <View
              style={[
                styles.cmdKBadge,
                { backgroundColor: isDark ? 'rgba(36, 42, 55, 0.8)' : 'rgba(219, 213, 201, 0.8)' },
              ]}
            >
              <Text style={[typography.labelTelemetry, { color: colors.secondary, fontSize: 10 }]}>
                ⌘K
              </Text>
            </View>
          </View>

          {/* New Task Button */}
          <TouchableOpacity
            style={[
              styles.newTaskButton,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
            onPress={() => setIsCreateModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Create new task"
          >
            <Plus size={16} color={colors.onPrimary} />
            <Text style={[typography.labelCaps, { color: colors.onPrimary, fontSize: 11 }]}>
              NEW
            </Text>
          </TouchableOpacity>
        </View>

        {/* Segmented Primary View Tabs (To Do vs Completed) */}
        <View
          style={[
            styles.segmentedTabs,
            {
              backgroundColor: isDark ? 'rgba(8, 14, 26, 0.9)' : 'rgba(233, 228, 217, 0.9)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'TODO' && [
                styles.segmentBtnActive,
                {
                  backgroundColor: isDark ? 'rgba(36, 42, 55, 0.9)' : colors.surface,
                  shadowColor: colors.secondary,
                },
              ],
            ]}
            onPress={() => setActiveTab('TODO')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'TODO' }}
          >
            <Text
              style={[
                typography.labelCaps,
                {
                  color: activeTab === 'TODO' ? (isDark ? colors.secondary : colors.primary) : colors.textMuted,
                  fontSize: 11,
                },
              ]}
            >
              TO DO
            </Text>
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor:
                    activeTab === 'TODO'
                      ? isDark
                        ? 'rgba(76, 215, 246, 0.2)'
                        : 'rgba(74, 124, 89, 0.15)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            >
              <Text
                style={[
                  typography.labelTelemetry,
                  {
                    color: activeTab === 'TODO' ? (isDark ? colors.secondary : colors.primary) : colors.textMuted,
                    fontSize: 10,
                  },
                ]}
              >
                {allTasks.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'DONE' && [
                styles.segmentBtnActive,
                {
                  backgroundColor: isDark ? 'rgba(36, 42, 55, 0.9)' : colors.surface,
                  shadowColor: colors.secondary,
                },
              ],
            ]}
            onPress={() => setActiveTab('DONE')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'DONE' }}
          >
            <Text
              style={[
                typography.labelCaps,
                {
                  color: activeTab === 'DONE' ? (isDark ? colors.secondary : colors.primary) : colors.textMuted,
                  fontSize: 11,
                },
              ]}
            >
              COMPLETED
            </Text>
          </TouchableOpacity>
        </View>

        {/* Project Stream Filter Chips & Management Controls */}
        <View style={styles.projectFilterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.projectFilterScroll}
          >
            {/* Direct Project Stream Manager Trigger Button */}
            <TouchableOpacity
              style={[
                styles.projectChip,
                {
                  backgroundColor: isDark ? 'rgba(76, 215, 246, 0.14)' : 'rgba(74, 124, 89, 0.12)',
                  borderColor: isDark ? colors.secondary : colors.primary,
                },
              ]}
              onPress={() => {
                setEditingProject(null);
                setIsManageProjectsVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Manage projects and presets"
            >
              <SlidersHorizontal
                size={11}
                color={isDark ? colors.secondary : colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  typography.labelCaps,
                  {
                    color: isDark ? colors.secondary : colors.primary,
                    fontSize: 10,
                    fontWeight: '700',
                  },
                ]}
              >
                MANAGE
              </Text>
            </TouchableOpacity>

            {/* All Projects Filter Chip */}
            <TouchableOpacity
              style={[
                styles.projectChip,
                selectedProjectId === null && [
                  styles.projectChipActive,
                  {
                    backgroundColor: isDark ? 'rgba(76, 215, 246, 0.18)' : 'rgba(74, 124, 89, 0.15)',
                    borderColor: isDark ? colors.secondary : colors.primary,
                  },
                ],
              ]}
              onPress={() => setSelectedProjectId(null)}
            >
              <View
                style={[
                  styles.microDot,
                  {
                    backgroundColor:
                      selectedProjectId === null ? colors.secondary : colors.textMuted,
                  },
                ]}
              />
              <Text
                style={[
                  typography.labelCaps,
                  {
                    color:
                      selectedProjectId === null
                        ? isDark
                          ? colors.secondary
                          : colors.primary
                        : colors.textMuted,
                    fontSize: 10,
                  },
                ]}
              >
                ALL PROJECTS
              </Text>
            </TouchableOpacity>

            {/* Existing Projects (Long-press to edit directly) */}
            {projects.map((proj) => {
              const isActive = selectedProjectId === proj.id;
              return (
                <TouchableOpacity
                  key={proj.id}
                  style={[
                    styles.projectChip,
                    isActive && [
                      styles.projectChipActive,
                      {
                        backgroundColor: isDark ? 'rgba(192, 193, 255, 0.15)' : 'rgba(74, 124, 89, 0.15)',
                        borderColor: proj.color || colors.primary,
                      },
                    ],
                  ]}
                  onPress={() =>
                    setSelectedProjectId(selectedProjectId === proj.id ? null : proj.id)
                  }
                  onLongPress={() => {
                    setEditingProject(proj);
                    setIsManageProjectsVisible(true);
                  }}
                  delayLongPress={280}
                  accessibilityLabel={`Project ${proj.name}. Long press to edit.`}
                >
                  <View
                    style={[styles.microDot, { backgroundColor: proj.color || colors.primary }]}
                  />
                  <Text
                    style={[
                      typography.labelCaps,
                      {
                        color: isActive ? colors.text : colors.textMuted,
                        fontSize: 10,
                      },
                    ]}
                  >
                    {proj.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Quick Add Stream Chip */}
            <TouchableOpacity
              style={[
                styles.projectChip,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.border,
                  borderStyle: 'dashed',
                },
              ]}
              onPress={() => {
                setEditingProject(null);
                setIsManageProjectsVisible(true);
              }}
              accessibilityLabel="Add new project stream or preset"
            >
              <Plus size={11} color={colors.secondary} style={{ marginRight: 3 }} />
              <Text
                style={[
                  typography.labelCaps,
                  {
                    color: colors.secondary,
                    fontSize: 10,
                  },
                ]}
              >
                + PRESETS
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Tasks Directive Backlog Queue */}
        {isTasksLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={colors.secondary} size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: spacing.bottomDockHeight + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isDone = item.status === 'DONE';
              return (
                <GlassCard level={2} style={styles.taskCard}>
                  <View style={styles.taskCardRow}>
                    {/* Laser-cut Checkbox Trigger */}
                    <TouchableOpacity
                      style={[
                        styles.laserCheckbox,
                        {
                          backgroundColor: isDone
                            ? colors.secondary
                            : isDark
                            ? 'rgba(8, 14, 26, 0.8)'
                            : 'rgba(233, 228, 217, 0.8)',
                          borderColor: isDone ? colors.secondary : colors.border,
                        },
                      ]}
                      onPress={() => toggleTaskMutation.mutate(item)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isDone }}
                      accessibilityLabel={`Mark task "${item.title}" as ${isDone ? 'incomplete' : 'complete'}`}
                    >
                      {isDone && <Check size={14} color={isDark ? '#080E1A' : '#FFFFFF'} />}
                    </TouchableOpacity>

                    {/* Task Content Column */}
                    <View style={styles.taskDetails}>
                      <View style={styles.taskMetaRow}>
                        {/* Project Tag */}
                        {item.project ? (
                          <View style={styles.projectTag}>
                            <View
                              style={[
                                styles.microDot,
                                { backgroundColor: item.project.color || colors.primary },
                              ]}
                            />
                            <Text
                              style={[
                                typography.labelCaps,
                                { color: isDark ? colors.secondary : colors.primary, fontSize: 10 },
                              ]}
                              numberOfLines={1}
                            >
                              {item.project.name}
                            </Text>
                          </View>
                        ) : (
                          <Text
                            style={[
                              typography.labelCaps,
                              { color: colors.textMuted, fontSize: 10 },
                            ]}
                          >
                            GENERAL
                          </Text>
                        )}

                        {/* Priority Badge & Delete */}
                        <View style={styles.rightBadgeRow}>
                          {renderPriorityBadge(item.priority)}
                          <TouchableOpacity
                            onPress={() => confirmDelete(item)}
                            style={styles.deleteIconBtn}
                            accessibilityLabel={`Delete task ${item.title}`}
                          >
                            <Trash2 size={14} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Task Title */}
                      <Text
                        style={[
                          typography.headlineSm,
                          styles.taskTitle,
                          {
                            color: isDone ? colors.textMuted : colors.text,
                            textDecorationLine: isDone ? 'line-through' : 'none',
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>

                      {/* Bottom Action Footer */}
                      <View
                        style={[
                          styles.taskFooter,
                          {
                            borderTopColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.05)',
                          },
                        ]}
                      >
                        <View style={styles.cycleInfo}>
                          <Clock size={13} color={colors.secondary} />
                          <Text
                            style={[
                              typography.labelTelemetry,
                              { color: colors.textSecondary, fontSize: 11 },
                            ]}
                          >
                            1 Cycle • 25m
                          </Text>
                        </View>

                        {/* Attach to Focus Button */}
                        {!isDone && (
                          <TouchableOpacity
                            style={[
                              styles.focusPillBtn,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(76, 215, 246, 0.15)'
                                  : 'rgba(74, 124, 89, 0.12)',
                                borderColor: isDark ? colors.secondary : colors.primary,
                              },
                            ]}
                            onPress={() => handleFocusTask(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`Focus on task ${item.title}`}
                          >
                            <Play size={11} color={isDark ? colors.secondary : colors.primary} />
                            <Text
                              style={[
                                typography.labelCaps,
                                {
                                  color: isDark ? colors.secondary : colors.primary,
                                  fontSize: 10,
                                },
                              ]}
                            >
                              FOCUS
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </GlassCard>
              );
            }}
            ListEmptyComponent={
              <GlassCard level={1} style={styles.emptyCard}>
                <Text style={[typography.headlineSm, { color: colors.text, textAlign: 'center' }]}>
                  {activeTab === 'TODO' ? 'No Directives in Queue' : 'No Completed Directives'}
                </Text>
                <Text
                  style={[
                    typography.bodySm,
                    { color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
                  ]}
                >
                  {activeTab === 'TODO'
                    ? 'All tactical sprints are clear. Tap "+ NEW" to add a target.'
                    : 'Completed focus cycles will be archived here.'}
                </Text>
              </GlassCard>
            }
          />
        )}
      </View>

      {/* Create Task Glass Modal */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard level={3} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <View
                  style={[
                    styles.microDot,
                    { backgroundColor: colors.secondary, width: 8, height: 8, borderRadius: 4 },
                  ]}
                />
                <Text style={[typography.headlineSm, { color: colors.text }]}>
                  New Tactical Objective
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCreateModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                typography.body,
                styles.modalInput,
                {
                  backgroundColor: isDark ? 'rgba(8, 14, 26, 0.8)' : 'rgba(233, 228, 217, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="What is your objective directive?"
              placeholderTextColor={colors.textMuted}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />

            {/* Priority Selector */}
            <Text
              style={[
                typography.labelCaps,
                { color: colors.textSecondary, fontSize: 10, marginTop: 14, marginBottom: 8 },
              ]}
            >
              PRIORITY LEVEL
            </Text>
            <View style={styles.modalPriorityRow}>
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TaskPriority[]).map((p) => {
                const isSelected = newTaskPriority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.modalPriorityBtn,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : isDark
                          ? 'rgba(13, 19, 31, 0.7)'
                          : 'rgba(233, 228, 217, 0.6)',
                        borderColor: isSelected ? colors.primaryLight : colors.border,
                      },
                    ]}
                    onPress={() => setNewTaskPriority(p)}
                  >
                    <Text
                      style={[
                        typography.labelCaps,
                        {
                          color: isSelected ? colors.onPrimary : colors.textSecondary,
                          fontSize: 10,
                        },
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Project Selector */}
            {projects.length > 0 && (
              <>
                <Text
                  style={[
                    typography.labelCaps,
                    { color: colors.textSecondary, fontSize: 10, marginTop: 14, marginBottom: 8 },
                  ]}
                >
                  PROJECT STREAM (OPTIONAL)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 38 }}>
                  {projects.map((proj) => {
                    const isSelected = modalProjectId === proj.id;
                    return (
                      <TouchableOpacity
                        key={proj.id}
                        style={[
                          styles.projectModalChip,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : isDark
                              ? 'rgba(13, 19, 31, 0.7)'
                              : 'rgba(233, 228, 217, 0.6)',
                            borderColor: isSelected ? colors.primaryLight : colors.border,
                          },
                        ]}
                        onPress={() =>
                          setModalProjectId(modalProjectId === proj.id ? undefined : proj.id)
                        }
                      >
                        <View
                          style={[
                            styles.microDot,
                            { backgroundColor: proj.color || colors.primary },
                          ]}
                        />
                        <Text
                          style={[
                            typography.labelCaps,
                            {
                              color: isSelected ? colors.onPrimary : colors.textSecondary,
                              fontSize: 10,
                            },
                          ]}
                        >
                          {proj.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <KineticButton
                title="CREATE OBJECTIVE"
                variant="primary"
                onPress={() => createTaskMutation.mutate()}
                loading={createTaskMutation.isPending}
                disabled={!newTaskTitle.trim()}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Project Stream & Presets Manager Modal */}
      <ProjectManagerModal
        visible={isManageProjectsVisible}
        onClose={() => {
          setIsManageProjectsVisible(false);
          setEditingProject(null);
        }}
        projects={projects}
        initialEditingProject={editingProject}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  cmdKBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  segmentedTabs: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 11,
  },
  segmentBtnActive: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  projectFilterWrapper: {
    marginBottom: 12,
  },
  projectFilterScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  projectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  projectChipActive: {},
  microDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listContent: {
    gap: 10,
    paddingTop: 4,
  },
  taskCard: {
    padding: 14,
  },
  taskCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  laserCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskDetails: {
    flex: 1,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  rightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  deleteIconBtn: {
    padding: 2,
  },
  taskTitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  cycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  focusPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    padding: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalPriorityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modalPriorityBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectModalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
  },
  modalActionRow: {
    marginTop: 18,
  },
});

// mobile/src/components/tasks/ProjectManagerModal.tsx
// FocusFlow Mobile — Project Stream Manager & Preset Customizer (Stitch Design)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Plus,
  Edit3,
  Trash2,
  Check,
  Sparkles,
  Layers,
  SlidersHorizontal,
  BookmarkPlus,
} from 'lucide-react-native';
import { Project } from '../../types';
import { projectsApi } from '../../api/projects';
import { useTheme } from '../../context/ThemeContext';
import { audioHapticsService } from '../../services/audioHapticsService';
import { GlassCard } from '../common/GlassCard';

interface ProjectManagerModalProps {
  visible: boolean;
  onClose: () => void;
  projects: Project[];
  initialEditingProject?: Project | null;
}

export interface ProjectPreset {
  id: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

const STORAGE_CUSTOM_PRESETS_KEY = '@focusflow_custom_presets_v1';

export const COLOR_PALETTE = [
  '#6366F1', // Indigo
  '#3B82F6', // Electric Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Hot Pink
  '#8B5CF6', // Purple
  '#14B8A6', // Teal
  '#EF4444', // Crimson
];

export const DEFAULT_PRESETS: ProjectPreset[] = [
  { id: 'p_deep_work', name: 'Deep Work', color: '#6366F1' },
  { id: 'p_core_eng', name: 'Core Engineering', color: '#3B82F6' },
  { id: 'p_sys_arch', name: 'Architecture', color: '#8B5CF6' },
  { id: 'p_research', name: 'Study & Research', color: '#10B981' },
  { id: 'p_writing', name: 'Writing & Docs', color: '#F59E0B' },
  { id: 'p_sprint', name: 'Sprint Target', color: '#EC4899' },
  { id: 'p_personal', name: 'Personal Goal', color: '#14B8A6' },
  { id: 'p_bugs', name: 'Bug Triage', color: '#EF4444' },
];

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  visible,
  onClose,
  projects,
  initialEditingProject = null,
}) => {
  const { colors, typography, isDark } = useTheme();
  const queryClient = useQueryClient();

  // Active editing project state
  const [editingProject, setEditingProject] = useState<Project | null>(initialEditingProject);
  const [editName, setEditName] = useState(initialEditingProject?.name || '');
  const [editColor, setEditColor] = useState(initialEditingProject?.color || COLOR_PALETTE[0]);

  // Create new project state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(COLOR_PALETTE[0]);

  // Custom user presets state
  const [customPresets, setCustomPresets] = useState<ProjectPreset[]>([]);
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetColor, setNewPresetColor] = useState(COLOR_PALETTE[2]);

  // Load custom presets from storage
  useEffect(() => {
    async function loadCustomPresets() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_CUSTOM_PRESETS_KEY);
        if (stored) {
          setCustomPresets(JSON.parse(stored));
        }
      } catch {
        // Handled silently
      }
    }
    if (visible) {
      loadCustomPresets();
    }
  }, [visible]);

  // Sync initial editing project if passed
  useEffect(() => {
    if (initialEditingProject) {
      setEditingProject(initialEditingProject);
      setEditName(initialEditingProject.name);
      setEditColor(initialEditingProject.color || COLOR_PALETTE[0]);
    }
  }, [initialEditingProject]);

  // Save custom preset to storage
  const handleSaveCustomPreset = async () => {
    if (!newPresetName.trim()) {
      Alert.alert('Required', 'Please provide a name for your custom preset.');
      return;
    }

    const newPreset: ProjectPreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      color: newPresetColor,
      isCustom: true,
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      await AsyncStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(updated));
    } catch {
      // Ignored
    }

    audioHapticsService.hapticComplete();
    setNewPresetName('');
    setIsAddingPreset(false);

    // Prompt user if they'd also like to create this stream right now
    Alert.alert(
      'Preset Saved',
      `Custom preset "${newPreset.name}" has been created. Would you like to activate it as a Project Stream now?`,
      [
        { text: 'Keep As Preset Only', style: 'cancel' },
        {
          text: 'Activate Stream',
          onPress: () => createProjectMutation.mutate({ name: newPreset.name, color: newPreset.color }),
        },
      ]
    );
  };

  // Delete custom preset
  const handleDeleteCustomPreset = async (presetId: string) => {
    const updated = customPresets.filter((p) => p.id !== presetId);
    setCustomPresets(updated);
    try {
      await AsyncStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(updated));
    } catch {
      // Ignored
    }
  };

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => projectsApi.createProject(data),
    onSuccess: () => {
      audioHapticsService.hapticComplete();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreatingNew(false);
      setNewProjectName('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Failed to create project stream');
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; color: string } }) =>
      projectsApi.updateProject(id, data),
    onSuccess: () => {
      audioHapticsService.hapticComplete();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingProject(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Failed to update project stream');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (project: Project) => {
      try {
        await projectsApi.deleteProject(project.id);
      } catch (err: any) {
        // If hard delete fails due to recorded sessions (ADR-013), offer archiving
        if (err?.code === 'PROJECT_HAS_SESSIONS' || err?.statusCode === 409) {
          await projectsApi.archiveProject(project.id);
        } else {
          throw err;
        }
      }
    },
    onSuccess: () => {
      audioHapticsService.hapticPauseResume();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingProject(null);
    },
    onError: (err: any) => {
      Alert.alert('Unable to Delete', err?.message || 'Failed to delete project stream');
    },
  });

  const handleApplyPreset = (preset: ProjectPreset) => {
    const exists = projects.some(
      (p) => p.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (exists) {
      Alert.alert('Already Active', `Project Stream "${preset.name}" already exists.`);
      return;
    }
    createProjectMutation.mutate({ name: preset.name, color: preset.color });
  };

  const handleStartEdit = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditColor(project.color || COLOR_PALETTE[0]);
    setIsCreatingNew(false);
  };

  const confirmDeleteProject = (project: Project) => {
    Alert.alert(
      'Remove Project Stream',
      `Are you sure you want to delete "${project.name}"? Tasks associated with this project will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteProjectMutation.mutate(project),
        },
      ]
    );
  };

  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <GlassCard level={3} style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleGroup}>
              <View
                style={[
                  styles.headerDot,
                  { backgroundColor: colors.secondary },
                ]}
              />
              <View>
                <Text style={[typography.headlineSm, { color: colors.text }]}>
                  Project Streams & Presets
                </Text>
                <Text style={[typography.labelTelemetry, { color: colors.textSecondary, fontSize: 11 }]}>
                  Custom workstreams • Presets • Backlog filters
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody}>
            {/* 1. EDITING ACTIVE PROJECT FORM (If Selected) */}
            {editingProject && (
              <View
                style={[
                  styles.editFormCard,
                  {
                    backgroundColor: isDark ? 'rgba(76, 215, 246, 0.08)' : 'rgba(74, 124, 89, 0.08)',
                    borderColor: isDark ? colors.secondary : colors.primary,
                  },
                ]}
              >
                <View style={styles.formHeaderRow}>
                  <Text style={[typography.labelCaps, { color: colors.secondary, fontSize: 11 }]}>
                    EDITING STREAM: {editingProject.name}
                  </Text>
                  <TouchableOpacity onPress={() => setEditingProject(null)}>
                    <Text style={[typography.labelCaps, { color: colors.textMuted, fontSize: 10 }]}>
                      CANCEL
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    typography.body,
                    styles.nameInput,
                    {
                      backgroundColor: isDark ? 'rgba(8, 14, 26, 0.9)' : 'rgba(233, 228, 217, 0.9)',
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Project Stream Name"
                  placeholderTextColor={colors.textMuted}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                />

                {/* Color Swatch Picker */}
                <Text style={[typography.labelTelemetry, { color: colors.textSecondary, marginTop: 10, marginBottom: 8, fontSize: 10 }]}>
                  COLOR ACCENT:
                </Text>
                <View style={styles.paletteRow}>
                  {COLOR_PALETTE.map((hex) => {
                    const isSelected = editColor === hex;
                    return (
                      <TouchableOpacity
                        key={hex}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: hex },
                          isSelected && styles.colorCircleSelected,
                        ]}
                        onPress={() => setEditColor(hex)}
                      >
                        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.formBtnRow}>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      if (!editName.trim()) return;
                      updateProjectMutation.mutate({
                        id: editingProject.id,
                        data: { name: editName.trim(), color: editColor },
                      });
                    }}
                    disabled={updateProjectMutation.isPending}
                  >
                    {updateProjectMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={[typography.labelCaps, { color: colors.onPrimary, fontSize: 11 }]}>
                        SAVE CHANGES
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteBtn, { borderColor: colors.error }]}
                    onPress={() => confirmDeleteProject(editingProject)}
                    disabled={deleteProjectMutation.isPending}
                  >
                    <Trash2 size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 2. ACTIVE PROJECTS LIST */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Layers size={14} color={colors.secondary} />
                <Text style={[typography.labelCaps, { color: colors.text, fontSize: 11, marginLeft: 6 }]}>
                  ACTIVE WORKSTREAMS ({projects.length})
                </Text>
              </View>
              {!isCreatingNew && !editingProject && (
                <TouchableOpacity
                  style={styles.inlineAddBtn}
                  onPress={() => setIsCreatingNew(true)}
                >
                  <Plus size={13} color={colors.secondary} />
                  <Text style={[typography.labelCaps, { color: colors.secondary, fontSize: 10, marginLeft: 3 }]}>
                    NEW STREAM
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* CREATE NEW STREAM FORM */}
            {isCreatingNew && (
              <View
                style={[
                  styles.editFormCard,
                  {
                    backgroundColor: isDark ? 'rgba(36, 42, 55, 0.7)' : 'rgba(233, 228, 217, 0.7)',
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.formHeaderRow}>
                  <Text style={[typography.labelCaps, { color: colors.text, fontSize: 11 }]}>
                    NEW PROJECT STREAM
                  </Text>
                  <TouchableOpacity onPress={() => setIsCreatingNew(false)}>
                    <Text style={[typography.labelCaps, { color: colors.textMuted, fontSize: 10 }]}>
                      CANCEL
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    typography.body,
                    styles.nameInput,
                    {
                      backgroundColor: isDark ? 'rgba(8, 14, 26, 0.9)' : 'rgba(233, 228, 217, 0.9)',
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g. Core Engineering, Product Design..."
                  placeholderTextColor={colors.textMuted}
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                  autoFocus
                />

                <View style={styles.paletteRow}>
                  {COLOR_PALETTE.map((hex) => {
                    const isSelected = newProjectColor === hex;
                    return (
                      <TouchableOpacity
                        key={hex}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: hex },
                          isSelected && styles.colorCircleSelected,
                        ]}
                        onPress={() => setNewProjectColor(hex)}
                      >
                        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                  onPress={() => {
                    if (!newProjectName.trim()) return;
                    createProjectMutation.mutate({
                      name: newProjectName.trim(),
                      color: newProjectColor,
                    });
                  }}
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={[typography.labelCaps, { color: colors.onPrimary, fontSize: 11 }]}>
                      CREATE STREAM
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* List of projects */}
            <View style={styles.projectsList}>
              {projects.length === 0 ? (
                <Text style={[typography.bodySm, { color: colors.textMuted, marginVertical: 10 }]}>
                  No active project streams. Tap a preset below or create a stream.
                </Text>
              ) : (
                projects.map((proj) => (
                  <View
                    key={proj.id}
                    style={[
                      styles.projectRow,
                      {
                        backgroundColor: isDark ? 'rgba(13, 19, 31, 0.6)' : 'rgba(233, 228, 217, 0.6)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.projectRowLeft}>
                      <View style={[styles.projectSwatchDot, { backgroundColor: proj.color || colors.primary }]} />
                      <Text style={[typography.bodySm, { color: colors.text, fontWeight: '600' }]}>
                        {proj.name}
                      </Text>
                    </View>

                    <View style={styles.projectRowActions}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleStartEdit(proj)}
                        accessibilityLabel={`Edit project ${proj.name}`}
                      >
                        <Edit3 size={15} color={colors.secondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => confirmDeleteProject(proj)}
                        accessibilityLabel={`Delete project ${proj.name}`}
                      >
                        <Trash2 size={15} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* 3. WORKSTREAM PRESETS WITH "+ ADD CUSTOM PRESET" BUTTON */}
            <View style={[styles.presetsContainer, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border }]}>
              <View style={styles.presetHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Sparkles size={14} color={colors.secondary} />
                  <Text style={[typography.labelCaps, { color: colors.text, fontSize: 11, marginLeft: 6 }]}>
                    WORKSTREAM PRESETS
                  </Text>
                </View>

                {/* + BUTTON TO ADD OUR OWN PRESETS */}
                <TouchableOpacity
                  style={[
                    styles.addPresetButton,
                    {
                      backgroundColor: isDark ? 'rgba(76, 215, 246, 0.15)' : 'rgba(74, 124, 89, 0.15)',
                      borderColor: isDark ? colors.secondary : colors.primary,
                    },
                  ]}
                  onPress={() => setIsAddingPreset(!isAddingPreset)}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom preset"
                >
                  <Plus size={13} color={isDark ? colors.secondary : colors.primary} />
                  <Text
                    style={[
                      typography.labelCaps,
                      { color: isDark ? colors.secondary : colors.primary, fontSize: 10, marginLeft: 3 },
                    ]}
                  >
                    + PRESET
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[typography.labelTelemetry, { color: colors.textSecondary, fontSize: 10, marginBottom: 10 }]}>
                Tap any preset to activate as a Project Stream, or create custom presets.
              </Text>

              {/* INLINE CUSTOM PRESET CREATION */}
              {isAddingPreset && (
                <View
                  style={[
                    styles.customPresetCard,
                    {
                      backgroundColor: isDark ? 'rgba(36, 42, 55, 0.85)' : 'rgba(219, 213, 201, 0.85)',
                      borderColor: colors.secondary,
                    },
                  ]}
                >
                  <View style={styles.formHeaderRow}>
                    <Text style={[typography.labelCaps, { color: colors.secondary, fontSize: 10 }]}>
                      NEW CUSTOM PRESET
                    </Text>
                    <TouchableOpacity onPress={() => setIsAddingPreset(false)}>
                      <X size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[
                      typography.bodySm,
                      styles.nameInput,
                      {
                        backgroundColor: isDark ? 'rgba(8, 14, 26, 0.9)' : 'rgba(233, 228, 217, 0.9)',
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="Preset name (e.g. Mobile Dev, Thesis)"
                    placeholderTextColor={colors.textMuted}
                    value={newPresetName}
                    onChangeText={setNewPresetName}
                  />

                  <View style={styles.paletteRow}>
                    {COLOR_PALETTE.map((hex) => {
                      const isSelected = newPresetColor === hex;
                      return (
                        <TouchableOpacity
                          key={hex}
                          style={[
                            styles.colorCircleSmall,
                            { backgroundColor: hex },
                            isSelected && styles.colorCircleSelected,
                          ]}
                          onPress={() => setNewPresetColor(hex)}
                        >
                          {isSelected && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.secondary, marginTop: 10 }]}
                    onPress={handleSaveCustomPreset}
                  >
                    <BookmarkPlus size={13} color={isDark ? '#080E1A' : '#FFFFFF'} />
                    <Text
                      style={[
                        typography.labelCaps,
                        { color: isDark ? '#080E1A' : '#FFFFFF', fontSize: 10, marginLeft: 4 },
                      ]}
                    >
                      SAVE CUSTOM PRESET
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* PRESET CHIPS GRID */}
              <View style={styles.presetChipsWrapper}>
                {allPresets.map((preset) => {
                  const isAlreadyActive = projects.some(
                    (p) => p.name.toLowerCase() === preset.name.toLowerCase()
                  );

                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isAlreadyActive
                            ? isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.04)'
                            : isDark
                            ? 'rgba(13, 19, 31, 0.7)'
                            : 'rgba(233, 228, 217, 0.7)',
                          borderColor: isAlreadyActive
                            ? isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : colors.border
                            : preset.color,
                        },
                      ]}
                      onPress={() => handleApplyPreset(preset)}
                      disabled={isAlreadyActive || createProjectMutation.isPending}
                    >
                      <View style={[styles.presetDot, { backgroundColor: preset.color }]} />
                      <Text
                        style={[
                          typography.labelCaps,
                          {
                            color: isAlreadyActive ? colors.textMuted : colors.text,
                            fontSize: 10,
                          },
                        ]}
                      >
                        {preset.name}
                      </Text>

                      {isAlreadyActive ? (
                        <Check size={11} color={colors.textMuted} style={{ marginLeft: 4 }} />
                      ) : (
                        <Plus size={11} color={preset.color} style={{ marginLeft: 4 }} />
                      )}

                      {preset.isCustom && (
                        <TouchableOpacity
                          onPress={() => handleDeleteCustomPreset(preset.id)}
                          style={styles.deleteCustomPresetBtn}
                        >
                          <X size={10} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    flexGrow: 0,
  },
  editFormCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  saveBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  projectsList: {
    gap: 8,
    marginBottom: 16,
  },
  projectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  projectRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  projectSwatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  projectRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconBtn: {
    padding: 6,
  },
  presetsContainer: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 6,
  },
  presetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addPresetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  customPresetCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  presetChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  deleteCustomPresetBtn: {
    marginLeft: 6,
    padding: 2,
  },
});

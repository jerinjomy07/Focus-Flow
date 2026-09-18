// mobile/src/screens/history/HistoryScreen.tsx
// FocusFlow Mobile — Session History & Logs Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { historyApi } from '../../api/history';
import { FocusSession } from '../../types';
import { colors, spacing, borderRadius, typography } from '../../theme';

export const HistoryScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['focusHistory', selectedFilter],
    queryFn: () =>
      historyApi.getSessionHistory({
        limit: 50,
        status: selectedFilter === 'ALL' ? undefined : selectedFilter,
      }),
  });

  const sessions = data?.sessions || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['focusHistory'] });
    setRefreshing(false);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">History</Text>
        <Text style={styles.subtitle}>Audit your completed focus sessions.</Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {['ALL', 'COMPLETED', 'ABANDONED', 'SKIPPED'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
            onPress={() => setSelectedFilter(filter)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${filter}`}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* History List */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primaryLight} size="large" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryLight}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }: { item: FocusSession }) => {
            const isCompleted = item.status === 'COMPLETED';
            const durationSecs = (item as any).actualDuration ?? (item as any).plannedDuration ?? item.durationSeconds ?? ((item as any).targetDurationMinutes ? (item as any).targetDurationMinutes * 60 : 1500);
            const durationMins = Math.max(1, Math.round(durationSecs / 60));

            return (
              <View style={styles.sessionCard}>
                <View style={styles.sessionMain}>
                  <View style={styles.sessionTitleRow}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {item.task?.title || (item.type === 'POMODORO' || (item.type as string) === 'FOCUS' ? 'Focus Session' : 'Break')}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isCompleted ? styles.statusCompleted : styles.statusAbandoned,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isCompleted ? styles.statusTextCompleted : styles.statusTextAbandoned,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    {item.project && (
                      <View style={styles.projectTag}>
                        <View style={[styles.projectDot, { backgroundColor: item.project.color }]} />
                        <Text style={styles.projectText}>{item.project.name}</Text>
                      </View>
                    )}
                    <Text style={styles.timestampText}>{formatDate(item.startedAt)}</Text>
                  </View>
                </View>

                <View style={styles.durationBadge}>
                  <Text style={styles.durationValue}>{durationMins}</Text>
                  <Text style={styles.durationUnit}>min</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No sessions found</Text>
              <Text style={styles.emptySubtitle}>Completed sessions will appear here automatically.</Text>
            </View>
          }
        />
      )}
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
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionMain: {
    flex: 1,
    marginRight: spacing.md,
    gap: spacing.xs,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
    marginRight: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusCompleted: {
    backgroundColor: colors.successMuted,
  },
  statusAbandoned: {
    backgroundColor: colors.dangerMuted,
  },
  statusText: {
    ...typography.tiny,
  },
  statusTextCompleted: {
    color: colors.success,
  },
  statusTextAbandoned: {
    color: colors.danger,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  timestampText: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  durationBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 44,
  },
  durationValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  durationUnit: {
    ...typography.tiny,
    color: colors.textMuted,
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
});

# ADR-013: Project Deletion & Historical Focus Session Preservation Policy

## Status
Approved

## Context
FocusFlow projects are organizational containers for tasks and recorded focus sessions (`FocusSession`).
In the PostgreSQL schema, `FocusSession.projectId` has foreign key constraint `onDelete: SetNull`.
If a project is permanently deleted (`DELETE FROM "Project"`), PostgreSQL sets `projectId = null` across all associated `FocusSession` rows.
This destroys historical productivity records: analytics queries (such as "Focus Time by Project") would lose historical attribution for every focus session that was invested in that project.

## Decision
We establish a strict archiving-first lifecycle policy for projects:
1. **Primary Lifecycle Action is Archiving**: The primary action in the UI for retiring projects is **Archive** (`status: ARCHIVED`).
   - Archived projects remain in the database with their full history intact.
   - Historical analytics remain 100% accurate.
   - Tasks under an archived project remain associated with it, but are hidden from active views.
   - An archived project can be restored to `ACTIVE` at any time.
2. **Conditional Hard Deletion**: Hard deletion (`DELETE /api/projects/:id`) is strictly guarded on the server:
   - If `focusSessions.count > 0`: Hard deletion is **rejected** with HTTP `409 Conflict` (error code: `PROJECT_HAS_SESSIONS`, message: *"Cannot delete a project with recorded focus history. Archive the project instead to preserve your productivity analytics."*).
   - If `focusSessions.count === 0`: Hard deletion is permitted. Associated tasks have `projectId` set to `null` (reassigned to Inbox) and the empty project container is removed.

## Consequences
- Protects the integrity of historical focus time and analytics.
- Users who accidentally created an empty project can still delete it without friction.
- Completely prevents data loss and phantom unassigned sessions in analytics.

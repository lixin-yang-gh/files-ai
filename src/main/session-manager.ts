// src/main/session-manager.ts
import Store from 'electron-store';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface StoreSchema {
    lastOpenedFolder?: string;
    windowBounds?: Electron.Rectangle;
    systemPrompt?: string;
    task?: string;
    issues?: string;
    selectedHeader?: string;
    maskedSubstrings?: string;
    lastActive?: number;
    fileCount?: number;
}

export interface SessionMetadata {
    id: number; // 0-99
    createdAt: number;
    lastActive: number;
    displayLabel?: string;
}

export interface SessionRegistry {
    sessions: SessionMetadata[];
    defaultSessionId: number | null; // The session that new instances copy data from
}

export interface SessionInfo {
    id: number;
    label?: string;
    isDefault: boolean;
    activeCount: number;
    maxSessions: number;
}

const DEFAULTS: Partial<StoreSchema> = {
    selectedHeader: 'issues',
};

export const SESSION_POOL_SIZE = 100;
const SESSION_REGISTRY_NAME = 'files-ai-session-pool';
const INACTIVE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
const ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes - truly active (heartbeat + buffer)

export class SessionManager {
    private stores = new Map<number, Store<StoreSchema>>();
    private currentSessionId: number | null = null;
    private registryStore: Store<SessionRegistry>;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Initialize registry store (shared across all instances)
        this.registryStore = new Store<SessionRegistry>({
            name: SESSION_REGISTRY_NAME,
            defaults: {
                sessions: [],
                defaultSessionId: null,
            },
        });

        // Clean up dead sessions on startup (must happen before acquiring session)
        this.cleanupDeadSessions().catch(err =>
            console.error('Failed to cleanup dead sessions:', err)
        );

        // Acquire a session - this will copy from default session if it exists
        this.currentSessionId = this.acquireSession();

        if (this.currentSessionId !== null) {
            this.startHeartbeat();
            console.log(`Session [${this.currentSessionId}] acquired successfully (is default: true)`);
        } else {
            console.error('Session pool is full - cannot acquire session');
        }
    }

    private acquireSession(): number | null {
        const registry = this.registryStore.store;
        const now = Date.now();

        // Build set of all used session IDs (regardless of active status)
        const usedSessionIds = new Set<number>();
        for (const session of registry.sessions) {
            usedSessionIds.add(session.id);
        }

        // Find the smallest available session ID
        let newSessionId: number | null = null;
        for (let i = 0; i < SESSION_POOL_SIZE; i++) {
            if (!usedSessionIds.has(i)) {
                newSessionId = i;
                break;
            }
        }

        if (newSessionId === null) {
            return null;
        }

        // Get data from default session to copy (if exists)
        let sessionData: Partial<StoreSchema> = { ...DEFAULTS };
        const defaultSessionId = registry.defaultSessionId;

        if (defaultSessionId !== null) {
            const defaultStore = this.loadSessionStore(defaultSessionId);
            if (defaultStore) {
                // Copy all data from default session
                sessionData = {
                    lastOpenedFolder: defaultStore.get('lastOpenedFolder'),
                    windowBounds: defaultStore.get('windowBounds'),
                    systemPrompt: defaultStore.get('systemPrompt'),
                    task: defaultStore.get('task'),
                    issues: defaultStore.get('issues'),
                    selectedHeader: defaultStore.get('selectedHeader') || 'issues',
                    maskedSubstrings: defaultStore.get('maskedSubstrings'),
                    lastActive: now,
                    fileCount: defaultStore.get('fileCount'),
                };
                console.log(`Copied data from default session [${defaultSessionId}] to new session [${newSessionId}]`);
            }
        }

        // Create the new session store with copied data
        const storeName = this.getStoreName(newSessionId);
        const store = new Store<StoreSchema>({
            name: storeName,
            defaults: DEFAULTS,
        });

        // Write copied data to the new session store
        for (const [key, value] of Object.entries(sessionData)) {
            if (value !== undefined) {
                store.set(key as keyof StoreSchema, value);
            }
        }

        this.stores.set(newSessionId, store);

        // Update registry: add new session and mark it as default
        registry.sessions.push({
            id: newSessionId,
            createdAt: now,
            lastActive: now,
        });

        // This new session becomes the new default session
        registry.defaultSessionId = newSessionId;

        this.registryStore.store = registry;

        const activeCount = this.countActiveSessions(registry, now);
        console.log(`Session [${newSessionId}] acquired and set as default. Active sessions: ${activeCount}/${SESSION_POOL_SIZE}`);

        return newSessionId;
    }

    private loadSessionStore(sessionId: number): Store<StoreSchema> | null {
        if (this.stores.has(sessionId)) {
            return this.stores.get(sessionId) ?? null;
        }

        const storeName = this.getStoreName(sessionId);
        try {
            const store = new Store<StoreSchema>({
                name: storeName,
                defaults: DEFAULTS,
            });
            this.stores.set(sessionId, store);
            return store;
        } catch {
            return null;
        }
    }

    private getStoreName(sessionId: number): string {
        return `files-ai-session-${sessionId.toString().padStart(2, '0')}`;
    }

    private startHeartbeat(): void {
        this.markAsLastActive();

        this.heartbeatInterval = setInterval(() => {
            this.markAsLastActive();
        }, HEARTBEAT_INTERVAL_MS);
    }

    public stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private countActiveSessions(registry: SessionRegistry, now: number): number {
        return registry.sessions.filter(s =>
            now - s.lastActive < ACTIVE_THRESHOLD_MS
        ).length;
    }

    public getCurrentSessionId(): number | null {
        return this.currentSessionId;
    }

    public getCurrentSessionInfo(): SessionInfo | null {
        if (this.currentSessionId === null) return null;

        const registry = this.registryStore.store;
        const now = Date.now();
        const session = registry.sessions.find(s => s.id === this.currentSessionId);
        const activeCount = this.countActiveSessions(registry, now);

        return {
            id: this.currentSessionId,
            label: session?.displayLabel,
            isDefault: registry.defaultSessionId === this.currentSessionId,
            activeCount: activeCount,
            maxSessions: SESSION_POOL_SIZE,
        };
    }

    public getCurrentStore(): Store<StoreSchema> | null {
        if (this.currentSessionId === null) return null;
        return this.stores.get(this.currentSessionId) ?? null;
    }

    public getSessionStore(sessionId: number): Store<StoreSchema> | null {
        return this.loadSessionStore(sessionId);
    }

    public markAsLastActive(): void {
        const store = this.getCurrentStore();
        if (store) {
            store.set('lastActive', Date.now());
        }

        if (this.currentSessionId !== null) {
            const registry = this.registryStore.store;
            const session = registry.sessions.find(s => s.id === this.currentSessionId);
            if (session) {
                session.lastActive = Date.now();
                this.registryStore.store = registry;
            }
        }
    }

    public updateFileCount(count: number): void {
        const store = this.getCurrentStore();
        if (store) {
            store.set('fileCount', count);
        }
    }

    public getAllSessions(): SessionMetadata[] {
        return this.registryStore.get('sessions') || [];
    }

    public getActiveSessionsCount(): number {
        const registry = this.registryStore.store;
        const now = Date.now();
        return this.countActiveSessions(registry, now);
    }

    public getDefaultSessionId(): number | null {
        return this.registryStore.get('defaultSessionId');
    }

    public async cleanupDeadSessions(): Promise<void> {
        const registry = this.registryStore.store;
        const now = Date.now();

        const sessionsToKeep: SessionMetadata[] = [];
        const sessionsToRemove: number[] = [];

        for (const session of registry.sessions) {
            const age = now - session.lastActive;
            const isDefault = registry.defaultSessionId === session.id;
            const isCurrent = session.id === this.currentSessionId;

            // Keep session if:
            // 1. It's active (within 15 min - truly alive with heartbeat)
            // 2. OR it's the default session (always keep as template)
            // 3. OR it's the current session being initialized
            if (now - session.lastActive < ACTIVE_THRESHOLD_MS || isDefault || isCurrent) {
                sessionsToKeep.push(session);
            } else if (age >= INACTIVE_THRESHOLD_MS) {
                // Only remove if dead for more than 1 day AND not default AND not current
                sessionsToRemove.push(session.id);
            } else {
                // Session is inactive but not yet dead (between 15min and 1 day)
                sessionsToKeep.push(session);
            }
        }

        // Remove dead session files from disk
        const userDataPath = path.dirname(this.registryStore.path);
        for (const sessionId of sessionsToRemove) {
            try {
                const storeName = this.getStoreName(sessionId);
                const storePath = path.join(userDataPath, `${storeName}.json`);
                await fs.unlink(storePath).catch(() => { /* ignore */ });
                console.log(`Cleaned up dead session: ${sessionId}`);
            } catch (err) {
                console.warn(`Failed to clean up session ${sessionId}:`, err);
            }
        }

        // Update registry
        registry.sessions = sessionsToKeep;

        // Ensure defaultSessionId is still valid
        if (registry.defaultSessionId !== null) {
            const defaultExists = sessionsToKeep.some(s => s.id === registry.defaultSessionId);
            if (!defaultExists) {
                // Default session was cleaned up, set to most recent session or null
                const mostRecent = sessionsToKeep.sort((a, b) => b.lastActive - a.lastActive)[0];
                registry.defaultSessionId = mostRecent?.id ?? null;
                console.log(`Default session updated to: ${registry.defaultSessionId}`);
            }
        }

        this.registryStore.store = registry;

        if (sessionsToRemove.length > 0) {
            console.log(`Session cleanup complete. Removed ${sessionsToRemove.length} dead sessions.`);
        }
    }

    public setSessionLabel(label: string): void {
        if (this.currentSessionId === null) return;

        const registry = this.registryStore.store;
        const session = registry.sessions.find(s => s.id === this.currentSessionId);
        if (session) {
            session.displayLabel = label.substring(0, 100);
            this.registryStore.store = registry;
        }
    }

    public isPoolFull(): boolean {
        return this.currentSessionId === null;
    }
}
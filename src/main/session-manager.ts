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

export interface SessionInfo {
    id: number;
    label?: string;
    totalActive: number;
    maxSessions: number;
}

const DEFAULTS: Partial<StoreSchema> = {
    selectedHeader: 'issues',
};

export const SESSION_POOL_SIZE = 100;
const SESSION_REGISTRY_NAME = 'files-ai-session-pool';
const INACTIVE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

export class SessionManager {
    private stores = new Map<number, Store<StoreSchema>>();
    private currentSessionId: number | null = null;
    private registryStore: Store<{ sessions: SessionMetadata[] }>;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Initialize registry store (shared across all instances)
        this.registryStore = new Store<{ sessions: SessionMetadata[] }>({
            name: SESSION_REGISTRY_NAME,
            defaults: {
                sessions: [],
            },
        });

        // Clean up dead sessions on startup
        this.cleanupDeadSessions().catch(err =>
            console.error('Failed to cleanup dead sessions:', err)
        );

        // Try to acquire a session
        this.currentSessionId = this.acquireSession();

        if (this.currentSessionId !== null) {
            this.startHeartbeat();
            console.log(`Session [${this.currentSessionId}] acquired successfully`);
        } else {
            console.error('Session pool is full - cannot acquire session');
        }
    }

    private acquireSession(): number | null {
        const registry = this.registryStore.store;
        const now = Date.now();

        // Build set of active session IDs (active within last day)
        const activeSessions = new Set<number>();
        for (const session of registry.sessions) {
            if (now - session.lastActive < INACTIVE_THRESHOLD_MS) {
                activeSessions.add(session.id);
            }
        }

        // If all 100 sessions are active, return null (pool full)
        if (activeSessions.size >= SESSION_POOL_SIZE) {
            return null;
        }

        // Find the smallest available session ID (not in active set)
        let sessionId: number | null = null;
        for (let i = 0; i < SESSION_POOL_SIZE; i++) {
            if (!activeSessions.has(i)) {
                sessionId = i;
                break;
            }
        }

        if (sessionId === null) {
            return null;
        }

        // Create or get the store for this session
        const storeName = this.getStoreName(sessionId);
        const store = new Store<StoreSchema>({
            name: storeName,
            defaults: DEFAULTS,
        });
        this.stores.set(sessionId, store);

        // Update registry with this session
        const existingIndex = registry.sessions.findIndex(s => s.id === sessionId);
        if (existingIndex >= 0) {
            registry.sessions[existingIndex].lastActive = now;
            registry.sessions[existingIndex].createdAt = registry.sessions[existingIndex].createdAt || now;
        } else {
            registry.sessions.push({
                id: sessionId,
                createdAt: now,
                lastActive: now,
            });
        }
        this.registryStore.store = registry;

        console.log(`Session [${sessionId}] acquired. Active sessions: ${activeSessions.size + 1}/${SESSION_POOL_SIZE}`);
        return sessionId;
    }

    private getStoreName(sessionId: number): string {
        // Use padded session ID for consistent file naming (session-00, session-01, etc.)
        return `files-ai-session-${sessionId.toString().padStart(2, '0')}`;
    }

    private startHeartbeat(): void {
        // Record initial activity
        this.markAsLastActive();

        // Update lastActive every 10 minutes
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

    public getCurrentSessionId(): number | null {
        return this.currentSessionId;
    }

    public getCurrentSessionInfo(): SessionInfo | null {
        if (this.currentSessionId === null) return null;

        const registry = this.registryStore.store;
        const now = Date.now();
        const session = registry.sessions.find(s => s.id === this.currentSessionId);

        // Count active sessions
        const activeCount = registry.sessions.filter(s =>
            now - s.lastActive < INACTIVE_THRESHOLD_MS
        ).length;

        return {
            id: this.currentSessionId,
            label: session?.displayLabel,
            totalActive: activeCount,
            maxSessions: SESSION_POOL_SIZE,
        };
    }

    public getCurrentStore(): Store<StoreSchema> | null {
        if (this.currentSessionId === null) return null;
        return this.stores.get(this.currentSessionId) ?? null;
    }

    public getSessionStore(sessionId: number): Store<StoreSchema> | null {
        // Check cache first
        if (this.stores.has(sessionId)) {
            return this.stores.get(sessionId) ?? null;
        }

        // Try to load existing session store
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

    public markAsLastActive(): void {
        const store = this.getCurrentStore();
        if (store) {
            store.set('lastActive', Date.now());
        }

        // Also update registry
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
        return registry.sessions.filter(s =>
            now - s.lastActive < INACTIVE_THRESHOLD_MS
        ).length;
    }

    public async cleanupDeadSessions(): Promise<void> {
        const registry = this.registryStore.store;
        const now = Date.now();

        const sessionsToKeep: SessionMetadata[] = [];
        const sessionsToRemove: number[] = [];

        for (const session of registry.sessions) {
            const age = now - session.lastActive;

            // Keep if active within 1 day OR is current session
            if (age < INACTIVE_THRESHOLD_MS || session.id === this.currentSessionId) {
                sessionsToKeep.push(session);
            } else {
                sessionsToRemove.push(session.id);
            }
        }

        // Remove dead session files from disk
        const userDataPath = path.dirname(this.registryStore.path);
        for (const sessionId of sessionsToRemove) {
            try {
                const storeName = this.getStoreName(sessionId);
                const storePath = path.join(userDataPath, `${storeName}.json`);
                await fs.unlink(storePath).catch(() => { /* ignore if file doesn't exist */ });
                console.log(`Cleaned up dead session: ${sessionId}`);
            } catch (err) {
                console.warn(`Failed to clean up session ${sessionId}:`, err);
            }
        }

        // Update registry
        registry.sessions = sessionsToKeep;
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
            session.displayLabel = label.substring(0, 100); // Limit label length
            this.registryStore.store = registry;
        }
    }

    public isPoolFull(): boolean {
        return this.currentSessionId === null;
    }
}
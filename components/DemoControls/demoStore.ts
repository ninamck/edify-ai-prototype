import { useSyncExternalStore } from 'react';
import type { BriefingRole } from '@/components/briefing';

export type ActingUserId = 'u-manager' | 'u-sam' | 'u-jordan' | 'u-reese';
export type DemoVersion = 'original' | 'mvp1';

let actingUserId: ActingUserId = 'u-manager';
let briefingRole: BriefingRole = 'ed';
let demoVersion: DemoVersion = 'original';

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getActingUser(): ActingUserId {
  return actingUserId;
}

function getBriefingRole(): BriefingRole {
  return briefingRole;
}

function getDemoVersion(): DemoVersion {
  return demoVersion;
}

export function useActingUser(): ActingUserId {
  return useSyncExternalStore(subscribe, getActingUser, getActingUser);
}

export function useDemoBriefingRole(): BriefingRole {
  return useSyncExternalStore(subscribe, getBriefingRole, getBriefingRole);
}

export function useDemoVersion(): DemoVersion {
  return useSyncExternalStore(subscribe, getDemoVersion, getDemoVersion);
}

export function setActingUser(id: ActingUserId) {
  if (actingUserId === id) return;
  actingUserId = id;
  emit();
}

export function setDemoBriefingRole(role: BriefingRole) {
  if (briefingRole === role) return;
  briefingRole = role;
  emit();
}

export function setDemoVersion(version: DemoVersion) {
  if (demoVersion === version) return;
  demoVersion = version;
  emit();
}

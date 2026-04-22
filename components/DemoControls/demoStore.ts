import { useSyncExternalStore } from 'react';
import type { BriefingRole } from '@/components/briefing';
import {
  resetProductionState,
  type RoleId,
} from '@/components/Production/productionStore';
import { DEFAULT_HUB_ID, DEFAULT_SPOKE_ID } from '@/components/Production/fixtures/fitzroyCpu';

export type ActingUserId = 'u-manager' | 'u-sam' | 'u-jordan' | 'u-reese';

let actingUserId: ActingUserId = 'u-manager';
let briefingRole: BriefingRole = 'ravi';
let currentSiteId: string = DEFAULT_HUB_ID;
let currentRole: RoleId = 'planner';

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

function getCurrentSiteId(): string {
  return currentSiteId;
}

function getCurrentRole(): RoleId {
  return currentRole;
}

export function useActingUser(): ActingUserId {
  return useSyncExternalStore(subscribe, getActingUser, getActingUser);
}

export function useDemoBriefingRole(): BriefingRole {
  return useSyncExternalStore(subscribe, getBriefingRole, getBriefingRole);
}

export function useCurrentSiteId(): string {
  return useSyncExternalStore(subscribe, getCurrentSiteId, getCurrentSiteId);
}

export function useCurrentRole(): RoleId {
  return useSyncExternalStore(subscribe, getCurrentRole, getCurrentRole);
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

export function setCurrentSiteId(id: string) {
  if (currentSiteId === id) return;
  currentSiteId = id;
  emit();
}

export function setCurrentRole(role: RoleId) {
  if (currentRole === role) return;
  currentRole = role;
  emit();
}

export function resetDemo() {
  resetProductionState();
  actingUserId = 'u-manager';
  briefingRole = 'ravi';
  currentSiteId = DEFAULT_HUB_ID;
  currentRole = 'planner';
  emit();
}

// Demo A starts with a Store GM placing an order at a spoke.
export function jumpToDemoAStart() {
  resetProductionState();
  currentSiteId = DEFAULT_SPOKE_ID;
  currentRole = 'store_gm';
  emit();
}

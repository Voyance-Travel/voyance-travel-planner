/**
 * Account Management API Service
 * 
 * User account operations:
 * - Account deletion (request + confirm)
 * - Password change
 * - Profile updates
 * 
 * Matches backend: user-validated.ts
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export interface RequestDeletionResponse {
  success: boolean;
  status: 'deletion_requested';
  message: string;
  deletionToken: string;
  expiresIn: string;
}

export interface ConfirmDeletionInput {
  token: string;
  confirmEmail: string;
  finalConfirmation: boolean;
}

export interface ConfirmDeletionResponse {
  success: boolean;
  status: 'deleted';
  message: string;
  anonymized: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export interface UpdateProfileInput {
  name?: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
  preferences?: Record<string, unknown>;
}

export interface UpdateProfileResponse {
  success: boolean;
  profile: {
    id: string;
    name: string | null;
    handle: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

// ============================================================================
// API HELPERS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Request account deletion - generates a deletion token
 */
export async function requestAccountDeletion(): Promise<RequestDeletionResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/request-deletion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to request deletion' }));
    throw new Error(error.error || error._error || error.message || 'Failed to request deletion');
  }

  return response.json();
}

/**
 * Confirm account deletion with token
 */
export async function confirmAccountDeletion(
  input: ConfirmDeletionInput
): Promise<ConfirmDeletionResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/confirm-deletion`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to confirm deletion' }));
    throw new Error(error.error || error._error || error.message || 'Failed to confirm deletion');
  }

  return response.json();
}

/**
 * Change user password
 */
export async function changePassword(
  input: ChangePasswordInput
): Promise<ChangePasswordResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to change password' }));
    throw new Error(error.error || error._error || error.message || 'Failed to change password');
  }

  return response.json();
}

/**
 * Update user profile
 */
export async function updateProfile(
  input: UpdateProfileInput
): Promise<UpdateProfileResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update profile' }));
    throw new Error(error.error || error._error || error.message || 'Failed to update profile');
  }

  return response.json();
}

/**
 * Legacy account deletion (without token confirmation)
 */
export async function deleteAccount(): Promise<ConfirmDeletionResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete account' }));
    throw new Error(error.error || error._error || error.message || 'Failed to delete account');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useRequestAccountDeletion() {
  return useMutation({
    mutationFn: requestAccountDeletion,
  });
}

export function useConfirmAccountDeletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmAccountDeletion,
    onSuccess: () => {
      // Clear all cached data after account deletion
      queryClient.clear();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['my-diagnostics'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = [
    'text-red-600',
    'text-orange-600',
    'text-yellow-600',
    'text-lime-600',
    'text-green-600',
    'text-emerald-600',
  ];

  const index = Math.min(score, labels.length - 1);

  return {
    score,
    label: labels[index],
    color: colors[index],
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const accountManagementAPI = {
  requestAccountDeletion,
  confirmAccountDeletion,
  changePassword,
  updateProfile,
  deleteAccount,
};

export default accountManagementAPI;

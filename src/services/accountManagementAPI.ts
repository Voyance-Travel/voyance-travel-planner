/**
 * Account Management API Service
 * 
 * User account operations using Supabase Auth directly:
 * - Account deletion
 * - Password change
 * - Profile updates
 */

import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
// API FUNCTIONS
// ============================================================================

/**
 * Request account deletion - generates a deletion token
 * Note: For now, this creates a local token. In production, use edge function.
 */
export async function requestAccountDeletion(): Promise<RequestDeletionResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  // Generate a simple token (in production, store in DB and send via email)
  const deletionToken = crypto.randomUUID();
  const expiresIn = '24h';
  
  // Store token in user metadata for verification
  await supabase.auth.updateUser({
    data: { 
      deletion_token: deletionToken,
      deletion_requested_at: new Date().toISOString()
    }
  });
  
  return {
    success: true,
    status: 'deletion_requested',
    message: 'Deletion request initiated. Please confirm within 24 hours.',
    deletionToken,
    expiresIn,
  };
}

/**
 * Confirm account deletion with token
 * Uses Supabase edge function for secure deletion
 */
export async function confirmAccountDeletion(
  input: ConfirmDeletionInput
): Promise<ConfirmDeletionResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  // Verify email matches
  if (user.email !== input.confirmEmail) {
    throw new Error('Email does not match');
  }
  
  // Verify token (stored in user metadata)
  const storedToken = user.user_metadata?.deletion_token;
  if (storedToken !== input.token) {
    throw new Error('Invalid deletion token');
  }
  
  // Call edge function to delete user
  const { error } = await supabase.functions.invoke('delete-users', {
    body: { userIds: [user.id] }
  });
  
  if (error) {
    throw new Error(error.message || 'Failed to delete account');
  }
  
  // Sign out
  await supabase.auth.signOut();
  
  return {
    success: true,
    status: 'deleted',
    message: 'Account successfully deleted',
    anonymized: true,
  };
}

/**
 * Change user password using Supabase Auth
 */
export async function changePassword(
  input: ChangePasswordInput
): Promise<ChangePasswordResponse> {
  if (input.newPassword !== input.confirmPassword) {
    throw new Error('Passwords do not match');
  }
  
  // Supabase requires re-authentication for password change
  // First verify current password by signing in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');
  
  // Attempt to sign in with current password to verify
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  
  if (verifyError) {
    throw new Error('Current password is incorrect');
  }
  
  // Update to new password
  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });
  
  if (error) {
    throw new Error(error.message || 'Failed to change password');
  }
  
  return {
    success: true,
    message: 'Password changed successfully',
  };
}

/**
 * Update user profile using Supabase directly
 */
export async function updateProfile(
  input: UpdateProfileInput
): Promise<UpdateProfileResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.display_name = input.name;
  if (input.handle !== undefined) updates.handle = input.handle;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, display_name, handle, avatar_url')
    .single();
  
  if (error) {
    throw new Error(error.message || 'Failed to update profile');
  }
  
  return {
    success: true,
    profile: {
      id: profile.id,
      name: profile.display_name,
      handle: profile.handle,
      email: user.email || '',
      avatarUrl: profile.avatar_url,
    },
  };
}

/**
 * Delete account directly (simpler flow)
 */
export async function deleteAccount(): Promise<ConfirmDeletionResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  // Call edge function to delete user
  const { error } = await supabase.functions.invoke('delete-users', {
    body: { userIds: [user.id] }
  });
  
  if (error) {
    throw new Error(error.message || 'Failed to delete account');
  }
  
  await supabase.auth.signOut();
  
  return {
    success: true,
    status: 'deleted',
    message: 'Account successfully deleted',
    anonymized: true,
  };
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

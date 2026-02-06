/**
 * Integration Tests for AuthContext
 * 
 * Tests the authentication flow and user state management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Mock Supabase client
const mockSupabaseAuth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

const mockSupabaseFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
  upsert: vi.fn(() => Promise.resolve({ error: null })),
  update: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: mockSupabaseAuth,
    from: mockSupabaseFrom,
  },
}));

// Mock audit logging
vi.mock('@/services/authAuditAPI', () => ({
  logLogin: vi.fn(),
  logSignup: vi.fn(),
  logLogout: vi.fn(),
  logOAuthLogin: vi.fn(),
}));

// Test component that uses the auth context
function TestConsumer() {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) return <div data-testid="loading">Loading...</div>;
  
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      {user && <div data-testid="user-email">{user.email}</div>}
    </div>
  );
}

// Helper to find elements
function queryByTestId(container: HTMLElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`);
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  describe('Initial State', () => {
    it('should show loading state initially', () => {
      const { container } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      // Should show loading initially
      expect(queryByTestId(container, 'loading')).not.toBeNull();
    });

    it('should show not authenticated when no session', async () => {
      const { container } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      // Wait for async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      const authStatus = queryByTestId(container, 'auth-status');
      expect(authStatus?.textContent).toBe('Not Authenticated');
    });
  });

  describe('With Authenticated User', () => {
    const mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        user_metadata: { name: 'Test User' },
      },
      access_token: 'mock-token',
    };

    beforeEach(() => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
    });

    it('should show authenticated status with user email', async () => {
      const { container } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      const authStatus = queryByTestId(container, 'auth-status');
      expect(authStatus?.textContent).toBe('Authenticated');
      
      const userEmail = queryByTestId(container, 'user-email');
      expect(userEmail?.textContent).toBe('test@example.com');
    });
  });

  describe('Auth State Change Listener', () => {
    it('should subscribe to auth state changes on mount', () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled();
    });

    it('should unsubscribe on unmount', () => {
      const mockUnsubscribe = vi.fn();
      mockSupabaseAuth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });
      
      const { unmount } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      unmount();
      
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});

describe('useAuth hook', () => {
  it('should throw error when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');
    
    consoleSpy.mockRestore();
  });
});

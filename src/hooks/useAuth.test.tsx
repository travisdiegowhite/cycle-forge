import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

// Import after mocking
import { supabase } from '@/integrations/supabase/client'
const mockSupabase = supabase as {
  auth: {
    onAuthStateChange: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
}

// Test component that uses the hook
function TestComponent() {
  const { user, session, loading, signOut } = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="user">{user ? user.email : 'no user'}</div>
      <div data-testid="session">{session ? 'has session' : 'no session'}</div>
      <button onClick={signOut} data-testid="signout">Sign Out</button>
    </div>
  )
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw error when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = vi.fn()
    
    expect(() => render(<TestComponent />)).toThrow(
      'useAuth must be used within an AuthProvider'
    )
    
    console.error = originalError
  })

  it('should provide initial loading state', () => {
    const mockSubscription = { unsubscribe: vi.fn() }
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: mockSubscription }
    })
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    expect(screen.getByTestId('user')).toHaveTextContent('no user')
    expect(screen.getByTestId('session')).toHaveTextContent('no session')
  })

  it('should handle user session', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    const mockSession = { user: mockUser, access_token: 'token' }
    const mockSubscription = { unsubscribe: vi.fn() }

    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      // Simulate auth state change
      setTimeout(() => callback('SIGNED_IN', mockSession), 0)
      return { data: { subscription: mockSubscription } }
    })

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    expect(screen.getByTestId('session')).toHaveTextContent('has session')
  })

  it('should handle sign out', async () => {
    const mockSubscription = { unsubscribe: vi.fn() }
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: mockSubscription }
    })
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null }
    })
    mockSupabase.auth.signOut.mockResolvedValue({ error: null })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const signOutButton = screen.getByTestId('signout')
    signOutButton.click()

    await waitFor(() => {
      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })
  })

  it('should clean up subscription on unmount', () => {
    const mockSubscription = { unsubscribe: vi.fn() }
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: mockSubscription }
    })
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null }
    })

    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    unmount()

    expect(mockSubscription.unsubscribe).toHaveBeenCalled()
  })
})
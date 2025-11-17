import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getCurrentUser, updatePassword, checkComputingIdExists, createAccount, resetPassword } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [computingId, setComputingId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [createAccountData, setCreateAccountData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [resetPasswordData, setResetPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const navigate = useNavigate()

  useEffect(() => {
    // Check if already logged in
    const user = getCurrentUser()
    if (user) {
      navigate(user.isExec ? '/exec' : '/dashboard', { replace: true })
    }
  }, [navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Check if computing ID exists
      const exists = await checkComputingIdExists(computingId)
      if (!exists) {
        setError('')
        setShowCreateAccount(true)
        setLoading(false)
        return
      }

      const user = await login(computingId, password)
      if (!user) {
        setError('Invalid computing ID or password')
        setLoading(false)
        return
      }

      // Check if this is first login (no password set, using default)
      const { data, error: passwordCheckError } = await supabase
        .from('members')
        .select('password')
        .eq('computingId', computingId.toLowerCase())
        .maybeSingle()

      // If no password is set, prompt for password change
      if (!passwordCheckError && (!data || !data.password)) {
        setIsFirstLogin(true)
        setLoading(false)
        return
      }

      // Redirect based on user type - reload to refresh app state
      window.location.href = user.isExec ? '/exec' : '/dashboard'
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const success = await updatePassword(computingId, newPassword)
      if (!success) {
        setError('Failed to update password. Please try again.')
        setLoading(false)
        return
      }

      // Login with new password
      const user = await login(computingId, newPassword)
      if (user) {
        window.location.href = user.isExec ? '/exec' : '/dashboard'
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!createAccountData.name.trim()) {
      setError('Name is required')
      return
    }

    if (!createAccountData.email.trim()) {
      setError('Email is required')
      return
    }

    if (createAccountData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (createAccountData.password !== createAccountData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const user = await createAccount(
        computingId,
        createAccountData.email,
        createAccountData.name,
        createAccountData.password
      )

      if (!user) {
        setError('Failed to create account. Computing ID may already exist.')
        setLoading(false)
        return
      }

      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (resetPasswordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const success = await resetPassword(computingId, resetPasswordData.newPassword)
      if (!success) {
        setError('Failed to reset password. Computing ID may not exist.')
        setLoading(false)
        return
      }

      setError('')
      alert('Password reset successfully! You can now log in with your new password.')
      setShowForgotPassword(false)
      setResetPasswordData({ newPassword: '', confirmPassword: '' })
      setLoading(false)
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md border-2 border-[#0E396D]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#0E396D] mb-2">RAM Points Tracker</h1>
          <p className="text-gray-600 text-sm">Remote Area Medical at UVA</p>
        </div>

        {!isFirstLogin && !showCreateAccount && !showForgotPassword ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="computingId" className="block text-sm font-medium text-gray-700">
                Computing ID
              </label>
              <input
                id="computingId"
                type="text"
                value={computingId}
                onChange={(e) => setComputingId(e.target.value.toLowerCase())}
                placeholder="Enter your computing ID"
                required
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!computingId) {
                    setError('Please enter your computing ID first')
                    return
                  }
                  setShowForgotPassword(true)
                  setError('')
                }}
                className="text-sm text-[#0E396D] hover:underline"
              >
                Forgot Password?
              </button>
              <div className="text-center">
                <p className="text-gray-500 text-xs">Default password: rampoints12!</p>
              </div>
            </div>
          </form>
        ) : showCreateAccount ? (
          <form onSubmit={handleCreateAccount} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Create Account</h2>
              <p className="text-gray-600 text-sm">Create an account for computing ID: <strong>{computingId}</strong></p>
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={createAccountData.name}
                onChange={(e) => setCreateAccountData({ ...createAccountData, name: e.target.value })}
                placeholder="Enter your full name"
                required
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={createAccountData.email}
                onChange={(e) => setCreateAccountData({ ...createAccountData, email: e.target.value })}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="createPassword" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="createPassword"
                type="password"
                value={createAccountData.password}
                onChange={(e) => setCreateAccountData({ ...createAccountData, password: e.target.value })}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="createConfirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="createConfirmPassword"
                type="password"
                value={createAccountData.confirmPassword}
                onChange={(e) => setCreateAccountData({ ...createAccountData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                required
                minLength={8}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCreateAccount(false)
                setCreateAccountData({ name: '', email: '', password: '', confirmPassword: '' })
                setError('')
              }}
              className="w-full bg-transparent border-2 border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:border-[#0E396D] hover:text-[#0E396D] transition-colors"
            >
              Back to Login
            </button>
          </form>
        ) : showForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Reset Password</h2>
              <p className="text-gray-600 text-sm">Reset password for computing ID: <strong>{computingId}</strong></p>
            </div>

            <div className="space-y-2">
              <label htmlFor="resetNewPassword" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="resetNewPassword"
                type="password"
                value={resetPasswordData.newPassword}
                onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="resetConfirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="resetConfirmPassword"
                type="password"
                value={resetPasswordData.confirmPassword}
                onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                required
                minLength={8}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false)
                setResetPasswordData({ newPassword: '', confirmPassword: '' })
                setError('')
              }}
              className="w-full bg-transparent border-2 border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:border-[#0E396D] hover:text-[#0E396D] transition-colors"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Set Your Password</h2>
              <p className="text-gray-600 text-sm">Please create a new password for your account</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={8}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

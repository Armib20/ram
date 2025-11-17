import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getCurrentUser, updatePassword } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [computingId, setComputingId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md border-2 border-[#0E396D]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#0E396D] mb-2">RAM Points Tracker</h1>
          <p className="text-gray-600 text-sm">Remote Area Medical at UVA</p>
        </div>

        {!isFirstLogin ? (
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

            <div className="text-center">
              <p className="text-gray-500 text-xs">Default password: rampoints12!</p>
            </div>
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

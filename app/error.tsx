'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-8">
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 max-w-md">
        <h2 className="text-xl font-semibold text-red-400 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p className="text-xs text-zinc-500 mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="w-full px-4 py-2 bg-zinc-800 text-zinc-200 rounded-md hover:bg-zinc-700 transition-colors border border-zinc-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

'use client'

import { ThemeToggle } from '@/components/theme-toggle'

export function AppHeader() {
  return (
    <div className="flex items-center justify-between w-full">
      <div />
      <ThemeToggle />
    </div>
  )
}

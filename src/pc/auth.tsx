import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export interface AuthUser {
  id: number
  username: string
  real_name: string
  role: string
  role_name: string
  permissions: string[]
}

interface AuthCtx {
  user: AuthUser | null
  setUser: (u: AuthUser | null) => void
  can: (perm: string) => boolean
}

const Ctx = createContext<AuthCtx>({ user: null, setUser: () => {}, can: () => false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  const value = useMemo<AuthCtx>(() => ({
    user,
    setUser: (u) => {
      setUserState(u)
      if (u) {
        localStorage.setItem('user', JSON.stringify(u))
      } else {
        localStorage.clear()
      }
    },
    can: (perm: string) => {
      if (!user) return false
      return user.permissions.includes('*') || user.permissions.includes(perm)
    },
  }), [user])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

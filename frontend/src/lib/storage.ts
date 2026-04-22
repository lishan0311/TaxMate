import type { AccountantAuth, OwnerAuth } from '../types'

const OWNER_KEY = 'taxmate_owner_auth'
const ACCOUNTANT_KEY = 'taxmate_accountant_auth'
const CLIENTS_KEY = 'taxmate_accountant_clients'

export function saveOwnerAuth(payload: OwnerAuth): void {
  localStorage.setItem(OWNER_KEY, JSON.stringify(payload))
}

export function getOwnerAuth(): OwnerAuth | null {
  const raw = localStorage.getItem(OWNER_KEY)
  return raw ? (JSON.parse(raw) as OwnerAuth) : null
}

export function saveAccountantAuth(payload: AccountantAuth): void {
  localStorage.setItem(ACCOUNTANT_KEY, JSON.stringify(payload))
}

export function getAccountantAuth(): AccountantAuth | null {
  const raw = localStorage.getItem(ACCOUNTANT_KEY)
  return raw ? (JSON.parse(raw) as AccountantAuth) : null
}

export function getAccountantClients(): string[] {
  const raw = localStorage.getItem(CLIENTS_KEY)
  if (!raw) return ['TaxMate Demo Sdn Bhd', 'Nasi Kari Station', 'Maju Trading']
  return JSON.parse(raw) as string[]
}

export function saveAccountantClients(clients: string[]): void {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients))
}
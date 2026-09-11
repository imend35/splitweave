import type {
  ActivityItem,
  CreateExpenseInput,
  CreateSettlementInput,
  Expense,
  ExpenseCategory,
  Group,
  GroupBalances,
  GroupSummary,
  GroupType,
  Member,
  Settlement,
  SettlementSuggestion,
  SplitMethod,
  Currency,
} from '../types'
import { ApiError, type SplitWeaveApi } from './client'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
).replace(/\/$/, '')

interface ApiErrorEnvelope {
  error?: {
    code?: string
    message?: string
  }
}

interface ApiMember {
  id: string
  name: string
  color: string
  isActive: boolean
  createdAt: string
}

interface ApiExpenseShare {
  memberId: string
  inputValue: string
  allocatedAmount: string
  position: number
}

interface ApiExpense {
  id: string
  groupId: string
  title: string
  amount: string
  expenseDate: string
  category: ExpenseCategory
  paidByMemberId: string
  splitMethod: SplitMethod
  shares: ApiExpenseShare[]
  note: string
  createdAt: string
  updatedAt: string
}

interface ApiSettlement {
  id: string
  groupId: string
  fromMemberId: string
  toMemberId: string
  amount: string
  settlementDate: string
  note: string
  createdAt: string
}

interface ApiGroup {
  id: string
  name: string
  description: string
  groupType: GroupType
  currency: Currency
  isArchived: boolean
  createdAt: string
  updatedAt: string
  members: ApiMember[]
  expenses: ApiExpense[]
  settlements: ApiSettlement[]
  activities: ActivityItem[]
}

interface ApiGroupSummary {
  id: string
  name: string
  description: string
  groupType: GroupType
  currency: Currency
  isArchived: boolean
  memberCount: number
  expenseCount: number
  totalSpent: string
  unsettled: string
  memberPreview: ApiMember[]
  updatedAt: string
}

interface ApiBalance {
  memberId: string
  memberName: string
  memberColor: string
  isActive: boolean
  position: number
  paid: string
  owed: string
  settlementsSent: string
  settlementsReceived: string
  net: string
}

interface ApiGroupBalances {
  totalSpent: string
  unsettled: string
  balances: ApiBalance[]
}

interface ApiSettlementSuggestion {
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  amount: string
}

function moneyToCents(rawValue: string): number {
  const value = rawValue.trim()
  const negative = value.startsWith('-')
  const absolute = negative ? value.slice(1) : value
  if (!/^\d+(?:\.\d{1,2})?$/.test(absolute)) {
    throw new ApiError('INVALID_API_RESPONSE', 'The server returned an invalid money value.')
  }
  const [whole, fraction = ''] = absolute.split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ApiError('INVALID_API_RESPONSE', 'The server returned an amount that is too large.')
  }
  return Number(negative ? -cents : cents)
}

function centsToMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new ApiError('INVALID_MONEY', 'The amount must use whole minor units.')
  }
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'SplitWeave could not reach the API. Check that the backend is running and try again.',
    )
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorEnvelope
    throw new ApiError(
      payload.error?.code ?? `HTTP_${response.status}`,
      payload.error?.message ?? 'The API could not complete this request.',
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function toMember(member: ApiMember): Member {
  return member
}

function toExpense(expense: ApiExpense): Expense {
  return {
    id: expense.id,
    groupId: expense.groupId,
    title: expense.title,
    amountCents: moneyToCents(expense.amount),
    expenseDate: expense.expenseDate,
    category: expense.category,
    paidByMemberId: expense.paidByMemberId,
    splitMethod: expense.splitMethod,
    shares: expense.shares.map((share) => ({
      memberId: share.memberId,
      inputValue: share.inputValue,
      allocatedCents: moneyToCents(share.allocatedAmount),
      position: share.position,
    })),
    note: expense.note,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  }
}

function toSettlement(settlement: ApiSettlement): Settlement {
  return {
    id: settlement.id,
    groupId: settlement.groupId,
    fromMemberId: settlement.fromMemberId,
    toMemberId: settlement.toMemberId,
    amountCents: moneyToCents(settlement.amount),
    settlementDate: settlement.settlementDate,
    note: settlement.note,
    createdAt: settlement.createdAt,
  }
}

function toGroup(group: ApiGroup): Group {
  return {
    ...group,
    members: group.members.map(toMember),
    expenses: group.expenses.map(toExpense),
    settlements: group.settlements.map(toSettlement),
  }
}

function expensePayload(input: CreateExpenseInput) {
  return {
    title: input.title,
    amount: centsToMoney(input.amountCents),
    expenseDate: input.expenseDate,
    category: input.category,
    paidByMemberId: input.paidByMemberId,
    splitMethod: input.splitMethod,
    participants: input.shares.map(({ memberId, inputValue, position }) => ({
      memberId,
      inputValue,
      position,
    })),
    note: input.note,
  }
}

function settlementPayload(input: CreateSettlementInput) {
  return {
    fromMemberId: input.fromMemberId,
    toMemberId: input.toMemberId,
    amount: centsToMoney(input.amountCents),
    settlementDate: input.settlementDate,
    note: input.note,
  }
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`
}

export const httpApi: SplitWeaveApi = {
  async listGroups(): Promise<GroupSummary[]> {
    const groups = await request<ApiGroupSummary[]>('/groups')
    return groups.map((group) => ({
      ...group,
      totalSpentCents: moneyToCents(group.totalSpent),
      unsettledCents: moneyToCents(group.unsettled),
      memberPreview: group.memberPreview.map(toMember),
    }))
  },

  async getGroup(groupId): Promise<Group> {
    return toGroup(await request<ApiGroup>(groupPath(groupId)))
  },

  async createGroup(input): Promise<Group> {
    return toGroup(
      await request<ApiGroup>('/groups', { method: 'POST', body: JSON.stringify(input) }),
    )
  },

  async updateGroup(groupId, input): Promise<Group> {
    return toGroup(
      await request<ApiGroup>(groupPath(groupId), {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    )
  },

  async addMember(groupId, input): Promise<Member> {
    return toMember(
      await request<ApiMember>(`${groupPath(groupId)}/members`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    )
  },

  async updateMember(groupId, memberId, input): Promise<Member> {
    return toMember(
      await request<ApiMember>(
        `${groupPath(groupId)}/members/${encodeURIComponent(memberId)}`,
        { method: 'PATCH', body: JSON.stringify(input) },
      ),
    )
  },

  async createExpense(groupId, input): Promise<Expense> {
    return toExpense(
      await request<ApiExpense>(`${groupPath(groupId)}/expenses`, {
        method: 'POST',
        body: JSON.stringify(expensePayload(input)),
      }),
    )
  },

  async updateExpense(groupId, expenseId, input): Promise<Expense> {
    return toExpense(
      await request<ApiExpense>(
        `${groupPath(groupId)}/expenses/${encodeURIComponent(expenseId)}`,
        { method: 'PUT', body: JSON.stringify(expensePayload(input)) },
      ),
    )
  },

  async deleteExpense(groupId, expenseId): Promise<void> {
    await request<void>(`${groupPath(groupId)}/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'DELETE',
    })
  },

  async getBalances(groupId): Promise<GroupBalances> {
    const payload = await request<ApiGroupBalances>(`${groupPath(groupId)}/balances`)
    return {
      totalSpentCents: moneyToCents(payload.totalSpent),
      unsettledCents: moneyToCents(payload.unsettled),
      balances: payload.balances.map((balance) => ({
        memberId: balance.memberId,
        memberName: balance.memberName,
        memberColor: balance.memberColor,
        isActive: balance.isActive,
        position: balance.position,
        paidCents: moneyToCents(balance.paid),
        owedCents: moneyToCents(balance.owed),
        settlementsSentCents: moneyToCents(balance.settlementsSent),
        settlementsReceivedCents: moneyToCents(balance.settlementsReceived),
        netCents: moneyToCents(balance.net),
      })),
    }
  },

  async getSettlementSuggestions(groupId): Promise<SettlementSuggestion[]> {
    const suggestions = await request<ApiSettlementSuggestion[]>(
      `${groupPath(groupId)}/settlement-suggestions`,
    )
    return suggestions.map((suggestion) => ({
      ...suggestion,
      amountCents: moneyToCents(suggestion.amount),
    }))
  },

  async createSettlement(groupId, input): Promise<Settlement> {
    return toSettlement(
      await request<ApiSettlement>(`${groupPath(groupId)}/settlements`, {
        method: 'POST',
        body: JSON.stringify(settlementPayload(input)),
      }),
    )
  },

  async deleteSettlement(groupId, settlementId): Promise<void> {
    await request<void>(
      `${groupPath(groupId)}/settlements/${encodeURIComponent(settlementId)}`,
      { method: 'DELETE' },
    )
  },
}

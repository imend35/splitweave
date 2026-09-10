import { ApiError, type SplitWeaveApi } from './client'
import {
  buildSettlementSuggestions,
  calculateExpenseShares,
  calculateGroupBalances,
} from '../lib/money'
import type {
  ActivityItem,
  CreateExpenseInput,
  CreateGroupInput,
  CreateMemberInput,
  CreateSettlementInput,
  Expense,
  Group,
  GroupSummary,
  Member,
  Settlement,
} from '../types'

const MEMBER_COLORS = ['#4F46E5', '#0F9F8F', '#E11D48', '#D97706', '#7C3AED', '#0284C7']
const NETWORK_DELAY_MS = 160

function clone<T>(value: T): T {
  return structuredClone(value)
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function isoNow(): string {
  return new Date().toISOString()
}

async function respond<T>(value: T): Promise<T> {
  await new Promise((resolve) => window.setTimeout(resolve, NETWORK_DELAY_MS))
  return clone(value)
}

const members: Member[] = [
  { id: 'ada', name: 'Ada', color: '#4F46E5', isActive: true, createdAt: '2026-09-01T09:00:00Z' },
  { id: 'deniz', name: 'Deniz', color: '#0F9F8F', isActive: true, createdAt: '2026-09-01T09:01:00Z' },
  { id: 'mira', name: 'Mira', color: '#E11D48', isActive: true, createdAt: '2026-09-01T09:02:00Z' },
  { id: 'can', name: 'Can', color: '#D97706', isActive: true, createdAt: '2026-09-01T09:03:00Z' },
]

function seedExpense(
  id: string,
  title: string,
  amountCents: number,
  expenseDate: string,
  category: Expense['category'],
  paidByMemberId: string,
  splitMethod: Expense['splitMethod'],
  participantIds: string[],
  inputValues: Record<string, string>,
  note = '',
): Expense {
  const createdAt = `${expenseDate}T18:00:00Z`
  return {
    id,
    groupId: 'aegean-weekend',
    title,
    amountCents,
    expenseDate,
    category,
    paidByMemberId,
    splitMethod,
    shares: calculateExpenseShares(amountCents, splitMethod, participantIds, inputValues),
    note,
    createdAt,
    updatedAt: createdAt,
  }
}

const seedExpenses: Expense[] = [
  seedExpense(
    'expense-stay',
    'Seaside house',
    120_000,
    '2026-09-06',
    'accommodation',
    'ada',
    'equal',
    ['ada', 'deniz', 'mira', 'can'],
    {},
    'Two nights near the coast',
  ),
  seedExpense(
    'expense-dinner',
    'Harbour dinner',
    64_000,
    '2026-09-07',
    'food_drink',
    'deniz',
    'percentage',
    ['ada', 'deniz', 'mira', 'can'],
    { ada: '40', deniz: '20', mira: '20', can: '20' },
  ),
  seedExpense(
    'expense-transfer',
    'Airport transfer',
    27_550,
    '2026-09-08',
    'transport',
    'mira',
    'exact',
    ['ada', 'mira', 'can'],
    { ada: '100', mira: '100', can: '75.50' },
  ),
]

const seedSettlement: Settlement = {
  id: 'settlement-can-ada',
  groupId: 'aegean-weekend',
  fromMemberId: 'can',
  toMemberId: 'ada',
  amountCents: 10_000,
  settlementDate: '2026-09-09',
  note: 'Partial repayment',
  createdAt: '2026-09-09T12:30:00Z',
}

const seedActivities: ActivityItem[] = [
  {
    id: 'activity-settlement',
    kind: 'settlement',
    title: 'Can recorded a repayment',
    detail: 'TRY 100.00 paid to Ada',
    createdAt: '2026-09-09T12:30:00Z',
  },
  {
    id: 'activity-transfer',
    kind: 'expense',
    title: 'Airport transfer added',
    detail: 'Mira paid TRY 275.50',
    createdAt: '2026-09-08T18:00:00Z',
  },
  {
    id: 'activity-dinner',
    kind: 'expense',
    title: 'Harbour dinner added',
    detail: 'Deniz paid TRY 640.00',
    createdAt: '2026-09-07T18:00:00Z',
  },
  {
    id: 'activity-stay',
    kind: 'expense',
    title: 'Seaside house added',
    detail: 'Ada paid TRY 1,200.00',
    createdAt: '2026-09-06T18:00:00Z',
  },
]

let groups: Group[] = [
  {
    id: 'aegean-weekend',
    name: 'Aegean Weekend',
    description: 'Four friends, one coast, no awkward money conversations.',
    groupType: 'trip',
    currency: 'TRY',
    isArchived: false,
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-09T12:30:00Z',
    members,
    expenses: seedExpenses,
    settlements: [seedSettlement],
    activities: seedActivities,
  },
]

function findGroup(groupId: string): Group {
  const group = groups.find((candidate) => candidate.id === groupId)
  if (!group) throw new ApiError('GROUP_NOT_FOUND', 'This group could not be found.')
  return group
}

function ensureWritable(group: Group): void {
  if (group.isArchived) {
    throw new ApiError('GROUP_ARCHIVED', 'Restore this group before making changes.')
  }
}

function addActivity(group: Group, activity: Omit<ActivityItem, 'id' | 'createdAt'>): void {
  group.activities.unshift({ id: makeId('activity'), createdAt: isoNow(), ...activity })
  group.updatedAt = isoNow()
}

function toSummary(group: Group): GroupSummary {
  const balances = calculateGroupBalances(group)
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    groupType: group.groupType,
    currency: group.currency,
    isArchived: group.isArchived,
    memberCount: group.members.length,
    expenseCount: group.expenses.length,
    totalSpentCents: balances.totalSpentCents,
    unsettledCents: balances.unsettledCents,
    memberPreview: group.members.slice(0, 4),
    updatedAt: group.updatedAt,
  }
}

function validateExpense(group: Group, input: CreateExpenseInput): void {
  if (!group.members.some((member) => member.id === input.paidByMemberId)) {
    throw new ApiError('INVALID_PAYER', 'Choose a payer who belongs to this group.')
  }
  const activeIds = new Set(group.members.filter((member) => member.isActive).map((member) => member.id))
  if (input.shares.some((share) => !activeIds.has(share.memberId))) {
    throw new ApiError('INVALID_PARTICIPANT', 'Every participant must be an active group member.')
  }
  if (input.shares.reduce((sum, share) => sum + share.allocatedCents, 0) !== input.amountCents) {
    throw new ApiError('SPLIT_TOTAL_MISMATCH', 'Participant allocations must equal the expense total.')
  }
}

export const mockApi: SplitWeaveApi = {
  async listGroups() {
    return respond(groups.map(toSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  },

  async getGroup(groupId) {
    return respond(findGroup(groupId))
  },

  async createGroup(input: CreateGroupInput) {
    const names = input.memberNames.map((name) => name.trim()).filter(Boolean)
    if (new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) {
      throw new ApiError('DUPLICATE_MEMBER', 'Member names must be unique within a group.')
    }
    const timestamp = isoNow()
    const group: Group = {
      id: makeId('group'),
      name: input.name.trim(),
      description: input.description.trim(),
      groupType: input.groupType,
      currency: input.currency,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      members: names.map((name, index) => ({
        id: makeId('member'),
        name,
        color: MEMBER_COLORS[index % MEMBER_COLORS.length],
        isActive: true,
        createdAt: timestamp,
      })),
      expenses: [],
      settlements: [],
      activities: [
        {
          id: makeId('activity'),
          kind: 'group',
          title: `${input.name.trim()} created`,
          detail: `${names.length} initial member${names.length === 1 ? '' : 's'}`,
          createdAt: timestamp,
        },
      ],
    }
    groups = [group, ...groups]
    return respond(group)
  },

  async updateGroup(groupId, input) {
    const group = findGroup(groupId)
    const wasArchived = group.isArchived
    Object.assign(group, input, { updatedAt: isoNow() })
    if (input.isArchived !== undefined && input.isArchived !== wasArchived) {
      addActivity(group, {
        kind: 'group',
        title: input.isArchived ? 'Group archived' : 'Group restored',
        detail: group.name,
      })
    }
    return respond(group)
  },

  async addMember(groupId, input: CreateMemberInput) {
    const group = findGroup(groupId)
    ensureWritable(group)
    const name = input.name.trim()
    if (group.members.some((member) => member.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new ApiError('DUPLICATE_MEMBER', 'A member with this name already exists.')
    }
    const member: Member = {
      id: makeId('member'),
      name,
      color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
      isActive: true,
      createdAt: isoNow(),
    }
    group.members.push(member)
    addActivity(group, { kind: 'member', title: `${name} joined the group`, detail: 'Active member' })
    return respond(member)
  },

  async updateMember(groupId, memberId, input) {
    const group = findGroup(groupId)
    ensureWritable(group)
    const member = group.members.find((candidate) => candidate.id === memberId)
    if (!member) throw new ApiError('MEMBER_NOT_FOUND', 'This member could not be found.')
    if (
      input.name &&
      group.members.some(
        (candidate) =>
          candidate.id !== memberId &&
          candidate.name.toLocaleLowerCase() === input.name?.trim().toLocaleLowerCase(),
      )
    ) {
      throw new ApiError('DUPLICATE_MEMBER', 'A member with this name already exists.')
    }
    if (input.name) member.name = input.name.trim()
    if (input.isActive !== undefined) member.isActive = input.isActive
    addActivity(group, {
      kind: 'member',
      title: input.isActive === false ? `${member.name} deactivated` : `${member.name} updated`,
      detail: input.isActive === false ? 'Historical transactions are preserved' : 'Member details changed',
    })
    return respond(member)
  },

  async createExpense(groupId, input) {
    const group = findGroup(groupId)
    ensureWritable(group)
    validateExpense(group, input)
    const timestamp = isoNow()
    const expense: Expense = {
      id: makeId('expense'),
      groupId,
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    group.expenses.push(expense)
    const payer = group.members.find((member) => member.id === expense.paidByMemberId)
    addActivity(group, {
      kind: 'expense',
      title: `${expense.title} added`,
      detail: `${payer?.name ?? 'A member'} recorded a new expense`,
    })
    return respond(expense)
  },

  async updateExpense(groupId, expenseId, input) {
    const group = findGroup(groupId)
    ensureWritable(group)
    validateExpense(group, input)
    const index = group.expenses.findIndex((expense) => expense.id === expenseId)
    if (index < 0) throw new ApiError('EXPENSE_NOT_FOUND', 'This expense could not be found.')
    const updated: Expense = {
      ...group.expenses[index],
      ...input,
      updatedAt: isoNow(),
    }
    group.expenses[index] = updated
    addActivity(group, { kind: 'expense', title: `${updated.title} updated`, detail: 'Balances recalculated' })
    return respond(updated)
  },

  async deleteExpense(groupId, expenseId) {
    const group = findGroup(groupId)
    ensureWritable(group)
    const index = group.expenses.findIndex((expense) => expense.id === expenseId)
    if (index < 0) throw new ApiError('EXPENSE_NOT_FOUND', 'This expense could not be found.')
    const [deleted] = group.expenses.splice(index, 1)
    addActivity(group, { kind: 'expense', title: `${deleted.title} deleted`, detail: 'Balances recalculated' })
    return respond(undefined)
  },

  async getBalances(groupId) {
    return respond(calculateGroupBalances(findGroup(groupId)))
  },

  async getSettlementSuggestions(groupId) {
    const balances = calculateGroupBalances(findGroup(groupId)).balances
    return respond(buildSettlementSuggestions(balances))
  },

  async createSettlement(groupId, input: CreateSettlementInput) {
    const group = findGroup(groupId)
    ensureWritable(group)
    if (input.fromMemberId === input.toMemberId) {
      throw new ApiError('INVALID_SETTLEMENT', 'Sender and receiver must be different members.')
    }
    const balanceData = calculateGroupBalances(group)
    const sender = balanceData.balances.find((balance) => balance.memberId === input.fromMemberId)
    const receiver = balanceData.balances.find((balance) => balance.memberId === input.toMemberId)
    if (!sender || !receiver || sender.netCents >= 0 || receiver.netCents <= 0) {
      throw new ApiError('INVALID_SETTLEMENT', 'Choose a member who owes and a member who should receive.')
    }
    if (input.amountCents <= 0 || input.amountCents > Math.min(-sender.netCents, receiver.netCents)) {
      throw new ApiError('SETTLEMENT_TOO_LARGE', 'The payment exceeds the open balance between these members.')
    }
    const settlement: Settlement = {
      id: makeId('settlement'),
      groupId,
      ...input,
      createdAt: isoNow(),
    }
    group.settlements.push(settlement)
    addActivity(group, {
      kind: 'settlement',
      title: `${sender.memberName} recorded a repayment`,
      detail: `Payment to ${receiver.memberName}`,
    })
    return respond(settlement)
  },

  async deleteSettlement(groupId, settlementId) {
    const group = findGroup(groupId)
    ensureWritable(group)
    const index = group.settlements.findIndex((settlement) => settlement.id === settlementId)
    if (index < 0) throw new ApiError('SETTLEMENT_NOT_FOUND', 'This settlement could not be found.')
    const [deleted] = group.settlements.splice(index, 1)
    const sender = group.members.find((member) => member.id === deleted.fromMemberId)
    addActivity(group, {
      kind: 'settlement',
      title: 'Repayment deleted',
      detail: `${sender?.name ?? 'Member'}'s balance was restored`,
    })
    return respond(undefined)
  },
}

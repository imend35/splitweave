export const GROUP_TYPES = ['trip', 'household', 'friends', 'work', 'other'] as const
export type GroupType = (typeof GROUP_TYPES)[number]

export const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

export const EXPENSE_CATEGORIES = [
  'food_drink',
  'groceries',
  'transport',
  'accommodation',
  'utilities',
  'entertainment',
  'health',
  'shopping',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const SPLIT_METHODS = ['equal', 'exact', 'percentage', 'shares'] as const
export type SplitMethod = (typeof SPLIT_METHODS)[number]

export interface Member {
  id: string
  name: string
  color: string
  isActive: boolean
  createdAt: string
}

export interface ExpenseShare {
  memberId: string
  inputValue: string
  allocatedCents: number
  position: number
}

export interface Expense {
  id: string
  groupId: string
  title: string
  amountCents: number
  expenseDate: string
  category: ExpenseCategory
  paidByMemberId: string
  splitMethod: SplitMethod
  shares: ExpenseShare[]
  note: string
  createdAt: string
  updatedAt: string
}

export interface Settlement {
  id: string
  groupId: string
  fromMemberId: string
  toMemberId: string
  amountCents: number
  settlementDate: string
  note: string
  createdAt: string
}

export type ActivityKind = 'expense' | 'settlement' | 'member' | 'group'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  detail: string
  createdAt: string
}

export interface Group {
  id: string
  name: string
  description: string
  groupType: GroupType
  currency: Currency
  isArchived: boolean
  createdAt: string
  updatedAt: string
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
  activities: ActivityItem[]
}

export interface MemberBalance {
  memberId: string
  memberName: string
  memberColor: string
  isActive: boolean
  position: number
  paidCents: number
  owedCents: number
  settlementsSentCents: number
  settlementsReceivedCents: number
  netCents: number
}

export interface GroupBalances {
  totalSpentCents: number
  unsettledCents: number
  balances: MemberBalance[]
}

export interface SettlementSuggestion {
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  amountCents: number
}

export interface GroupSummary {
  id: string
  name: string
  description: string
  groupType: GroupType
  currency: Currency
  isArchived: boolean
  memberCount: number
  expenseCount: number
  totalSpentCents: number
  unsettledCents: number
  memberPreview: Member[]
  updatedAt: string
}

export interface CreateGroupInput {
  name: string
  description: string
  groupType: GroupType
  currency: Currency
  memberNames: string[]
}

export interface CreateMemberInput {
  name: string
}

export interface CreateExpenseInput {
  title: string
  amountCents: number
  expenseDate: string
  category: ExpenseCategory
  paidByMemberId: string
  splitMethod: SplitMethod
  shares: ExpenseShare[]
  note: string
}

export interface CreateSettlementInput {
  fromMemberId: string
  toMemberId: string
  amountCents: number
  settlementDate: string
  note: string
}

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  trip: 'Trip',
  household: 'Household',
  friends: 'Friends',
  work: 'Work / Team',
  other: 'Other',
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food_drink: 'Food & Drink',
  groceries: 'Groceries',
  transport: 'Transport',
  accommodation: 'Accommodation',
  utilities: 'Utilities',
  entertainment: 'Entertainment',
  health: 'Health',
  shopping: 'Shopping',
  other: 'Other',
}

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  equal: 'Equal',
  exact: 'Exact amounts',
  percentage: 'Percentages',
  shares: 'Weighted shares',
}

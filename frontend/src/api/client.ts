import type {
  CreateExpenseInput,
  CreateGroupInput,
  CreateMemberInput,
  CreateSettlementInput,
  Expense,
  Group,
  GroupBalances,
  GroupSummary,
  Member,
  Settlement,
  SettlementSuggestion,
} from '../types'

export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export interface SplitWeaveApi {
  listGroups(): Promise<GroupSummary[]>
  getGroup(groupId: string): Promise<Group>
  createGroup(input: CreateGroupInput): Promise<Group>
  updateGroup(
    groupId: string,
    input: Partial<Pick<Group, 'name' | 'description' | 'groupType' | 'isArchived'>>,
  ): Promise<Group>
  addMember(groupId: string, input: CreateMemberInput): Promise<Member>
  updateMember(
    groupId: string,
    memberId: string,
    input: Partial<Pick<Member, 'name' | 'isActive'>>,
  ): Promise<Member>
  createExpense(groupId: string, input: CreateExpenseInput): Promise<Expense>
  updateExpense(
    groupId: string,
    expenseId: string,
    input: CreateExpenseInput,
  ): Promise<Expense>
  deleteExpense(groupId: string, expenseId: string): Promise<void>
  getBalances(groupId: string): Promise<GroupBalances>
  getSettlementSuggestions(groupId: string): Promise<SettlementSuggestion[]>
  createSettlement(groupId: string, input: CreateSettlementInput): Promise<Settlement>
  deleteSettlement(groupId: string, settlementId: string): Promise<void>
}

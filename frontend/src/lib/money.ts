import type {
  ExpenseShare,
  Group,
  GroupBalances,
  MemberBalance,
  SettlementSuggestion,
  SplitMethod,
} from '../types'

export class MoneyValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyValidationError'
  }
}

export function parseMoneyToCents(rawValue: string): number {
  const value = rawValue.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) {
    throw new MoneyValidationError('Enter a valid amount with no more than two decimals.')
  }

  const [whole, fraction = ''] = value.split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyValidationError('The amount is too large.')
  }
  return Number(cents)
}

export function formatMoney(cents: number, currency: string, compact = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(cents / 100)
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00Z`))
}

interface WeightedInput {
  memberId: string
  weight: bigint
  inputValue: string
  position: number
}

function allocateByWeights(totalCents: number, inputs: WeightedInput[]): ExpenseShare[] {
  const totalWeight = inputs.reduce((sum, input) => sum + input.weight, 0n)
  if (totalWeight <= 0n) {
    throw new MoneyValidationError('The split values must total more than zero.')
  }

  const total = BigInt(totalCents)
  const allocations = inputs.map((input) => {
    const product = total * input.weight
    return {
      ...input,
      allocatedCents: Number(product / totalWeight),
      remainder: product % totalWeight,
    }
  })

  const allocated = allocations.reduce((sum, item) => sum + item.allocatedCents, 0)
  let remaining = totalCents - allocated
  const remainderOrder = [...allocations].sort(
    (a, b) =>
      (a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1) ||
      a.position - b.position,
  )

  for (let index = 0; remaining > 0; index += 1) {
    remainderOrder[index % remainderOrder.length].allocatedCents += 1
    remaining -= 1
  }

  return allocations
    .sort((a, b) => a.position - b.position)
    .map(({ memberId, inputValue, position, allocatedCents }) => ({
      memberId,
      inputValue,
      position,
      allocatedCents,
    }))
}

function parsePercentageToBasisPoints(rawValue: string): bigint {
  const value = rawValue.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) {
    throw new MoneyValidationError('Percentages may contain up to two decimals.')
  }
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function calculateExpenseShares(
  totalCents: number,
  method: SplitMethod,
  participantIds: string[],
  inputValues: Record<string, string>,
): ExpenseShare[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new MoneyValidationError('Expense amount must be greater than zero.')
  }
  if (participantIds.length === 0 || new Set(participantIds).size !== participantIds.length) {
    throw new MoneyValidationError('Select at least one unique participant.')
  }

  if (method === 'exact') {
    const shares = participantIds.map((memberId, position) => {
      const inputValue = inputValues[memberId] ?? ''
      const allocatedCents = parseMoneyToCents(inputValue)
      return { memberId, inputValue, allocatedCents, position }
    })
    if (shares.reduce((sum, share) => sum + share.allocatedCents, 0) !== totalCents) {
      throw new MoneyValidationError('Exact amounts must equal the expense total.')
    }
    return shares
  }

  let weightedInputs: WeightedInput[]
  if (method === 'equal') {
    weightedInputs = participantIds.map((memberId, position) => ({
      memberId,
      weight: 1n,
      inputValue: '1',
      position,
    }))
  } else if (method === 'percentage') {
    weightedInputs = participantIds.map((memberId, position) => {
      const inputValue = inputValues[memberId] ?? ''
      const weight = parsePercentageToBasisPoints(inputValue)
      if (weight <= 0n) {
        throw new MoneyValidationError('Each percentage must be greater than zero.')
      }
      return { memberId, weight, inputValue, position }
    })
    if (weightedInputs.reduce((sum, item) => sum + item.weight, 0n) !== 10_000n) {
      throw new MoneyValidationError('Percentages must equal 100.00%.')
    }
  } else {
    weightedInputs = participantIds.map((memberId, position) => {
      const inputValue = inputValues[memberId] ?? ''
      if (!/^\d+$/.test(inputValue.trim())) {
        throw new MoneyValidationError('Shares must be positive whole numbers.')
      }
      const weight = BigInt(inputValue)
      if (weight <= 0n) {
        throw new MoneyValidationError('Each share must be greater than zero.')
      }
      return { memberId, weight, inputValue, position }
    })
  }

  return allocateByWeights(totalCents, weightedInputs)
}

export function calculateGroupBalances(group: Group): GroupBalances {
  const byMember = new Map<string, MemberBalance>(
    group.members.map((member, position) => [
      member.id,
      {
        memberId: member.id,
        memberName: member.name,
        memberColor: member.color,
        isActive: member.isActive,
        position,
        paidCents: 0,
        owedCents: 0,
        settlementsSentCents: 0,
        settlementsReceivedCents: 0,
        netCents: 0,
      },
    ]),
  )

  for (const expense of group.expenses) {
    const payer = byMember.get(expense.paidByMemberId)
    if (payer) payer.paidCents += expense.amountCents
    for (const share of expense.shares) {
      const participant = byMember.get(share.memberId)
      if (participant) participant.owedCents += share.allocatedCents
    }
  }

  for (const settlement of group.settlements) {
    const sender = byMember.get(settlement.fromMemberId)
    const receiver = byMember.get(settlement.toMemberId)
    if (sender) sender.settlementsSentCents += settlement.amountCents
    if (receiver) receiver.settlementsReceivedCents += settlement.amountCents
  }

  const balances = [...byMember.values()].map((balance) => ({
    ...balance,
    netCents:
      balance.paidCents -
      balance.owedCents +
      balance.settlementsSentCents -
      balance.settlementsReceivedCents,
  }))

  const netTotal = balances.reduce((sum, balance) => sum + balance.netCents, 0)
  if (netTotal !== 0) {
    throw new Error(`Balance invariant violated by ${netTotal} cents.`)
  }

  return {
    totalSpentCents: group.expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    unsettledCents: balances.reduce(
      (sum, balance) => sum + Math.max(balance.netCents, 0),
      0,
    ),
    balances,
  }
}

export function buildSettlementSuggestions(
  balances: MemberBalance[],
): SettlementSuggestion[] {
  const debtors = balances
    .filter((balance) => balance.netCents < 0)
    .map((balance) => ({ ...balance, remaining: -balance.netCents }))
    .sort((a, b) => b.remaining - a.remaining || a.position - b.position)
  const creditors = balances
    .filter((balance) => balance.netCents > 0)
    .map((balance) => ({ ...balance, remaining: balance.netCents }))
    .sort((a, b) => b.remaining - a.remaining || a.position - b.position)

  const suggestions: SettlementSuggestion[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amountCents = Math.min(debtor.remaining, creditor.remaining)
    suggestions.push({
      fromMemberId: debtor.memberId,
      fromMemberName: debtor.memberName,
      toMemberId: creditor.memberId,
      toMemberName: creditor.memberName,
      amountCents,
    })
    debtor.remaining -= amountCents
    creditor.remaining -= amountCents
    if (debtor.remaining === 0) debtorIndex += 1
    if (creditor.remaining === 0) creditorIndex += 1
  }

  return suggestions
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

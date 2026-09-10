import { describe, expect, it } from 'vitest'

import { calculateExpenseShares, parseMoneyToCents } from './money'

const members = ['ada', 'deniz', 'mira']

describe('parseMoneyToCents', () => {
  it('parses two-decimal amounts without floating-point arithmetic', () => {
    expect(parseMoneyToCents('1200.50')).toBe(120_050)
    expect(parseMoneyToCents('9,7')).toBe(970)
  })

  it('rejects more than two decimals', () => {
    expect(() => parseMoneyToCents('1.009')).toThrow(/two decimals/i)
  })
})

describe('calculateExpenseShares', () => {
  it('distributes equal-split remainders by participant order', () => {
    const result = calculateExpenseShares(10_000, 'equal', members, {})
    expect(result.map((share) => share.allocatedCents)).toEqual([3334, 3333, 3333])
  })

  it('accepts exact allocations that reconcile to the total', () => {
    const result = calculateExpenseShares(12_000, 'exact', members, {
      ada: '50',
      deniz: '40',
      mira: '30',
    })
    expect(result.map((share) => share.allocatedCents)).toEqual([5000, 4000, 3000])
  })

  it('rejects exact allocations that do not reconcile', () => {
    expect(() =>
      calculateExpenseShares(12_000, 'exact', members, {
        ada: '50',
        deniz: '40',
        mira: '20',
      }),
    ).toThrow(/must equal/i)
  })

  it('supports two-decimal percentages', () => {
    const result = calculateExpenseShares(20_000, 'percentage', members, {
      ada: '50',
      deniz: '30',
      mira: '20',
    })
    expect(result.map((share) => share.allocatedCents)).toEqual([10_000, 6000, 4000])
  })

  it('allocates weighted shares proportionally', () => {
    const result = calculateExpenseShares(12_000, 'shares', members, {
      ada: '2',
      deniz: '1',
      mira: '1',
    })
    expect(result.map((share) => share.allocatedCents)).toEqual([6000, 3000, 3000])
  })
})

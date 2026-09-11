import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { API_BASE_URL, httpApi } from './httpApi'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('httpApi', () => {
  it('maps API money strings to integer minor units', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'group-1',
          name: 'Test trip',
          description: '',
          groupType: 'trip',
          currency: 'EUR',
          isArchived: false,
          memberCount: 2,
          expenseCount: 1,
          totalSpent: '125.40',
          unsettled: '62.70',
          memberPreview: [],
          updatedAt: '2026-09-10T10:00:00Z',
        },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const groups = await httpApi.listGroups()

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/groups`,
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    )
    expect(groups[0].totalSpentCents).toBe(12_540)
    expect(groups[0].unsettledCents).toBe(6270)
  })

  it('sends expense money as a string and lets the backend recalculate shares', async () => {
    const responseExpense = {
      id: 'expense-1',
      groupId: 'group-1',
      title: 'Dinner',
      amount: '10.01',
      expenseDate: '2025-01-01',
      category: 'food_drink',
      paidByMemberId: 'member-a',
      splitMethod: 'equal',
      shares: [
        { memberId: 'member-a', inputValue: '1', allocatedAmount: '5.01', position: 0 },
        { memberId: 'member-b', inputValue: '1', allocatedAmount: '5.00', position: 1 },
      ],
      note: '',
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(responseExpense, 201))
    vi.stubGlobal('fetch', fetchMock)

    const expense = await httpApi.createExpense('group-1', {
      title: 'Dinner',
      amountCents: 1001,
      expenseDate: '2025-01-01',
      category: 'food_drink',
      paidByMemberId: 'member-a',
      splitMethod: 'equal',
      shares: [
        { memberId: 'member-a', inputValue: '1', allocatedCents: 501, position: 0 },
        { memberId: 'member-b', inputValue: '1', allocatedCents: 500, position: 1 },
      ],
      note: '',
    })

    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(request.body as string)).toEqual(
      expect.objectContaining({
        amount: '10.01',
        participants: [
          { memberId: 'member-a', inputValue: '1', position: 0 },
          { memberId: 'member-b', inputValue: '1', position: 1 },
        ],
      }),
    )
    expect(expense.amountCents).toBe(1001)
    expect(expense.shares.map((share) => share.allocatedCents)).toEqual([501, 500])
  })

  it('preserves stable API error codes for the UI', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'GROUP_ARCHIVED',
            message: 'Archived groups are read-only.',
            details: [],
          },
        },
        409,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpApi.addMember('group-1', { name: 'Ada' })).rejects.toEqual(
      new ApiError('GROUP_ARCHIVED', 'Archived groups are read-only.'),
    )
  })
})

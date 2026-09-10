import { useMemo, useState, type FormEvent } from 'react'
import { Calculator, Equal, Percent, Scale, UserPlus } from 'lucide-react'

import { api } from '../api'
import {
  calculateExpenseShares,
  formatMoney,
  MoneyValidationError,
  parseMoneyToCents,
  todayIso,
} from '../lib/money'
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  SPLIT_METHOD_LABELS,
  SPLIT_METHODS,
  type Expense,
  type ExpenseShare,
  type Group,
  type GroupBalances,
  type SettlementSuggestion,
  type SplitMethod,
} from '../types'
import { Avatar, Modal } from './ui'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function centsInput(cents: number): string {
  return (cents / 100).toFixed(2)
}

function defaultSplitValues(
  method: SplitMethod,
  participantIds: string[],
  rawAmount: string,
): Record<string, string> {
  if (participantIds.length === 0) return {}
  if (method === 'equal') return {}
  if (method === 'shares') {
    return Object.fromEntries(participantIds.map((memberId) => [memberId, '1']))
  }
  if (method === 'percentage') {
    const totalBasisPoints = 10_000
    const base = Math.floor(totalBasisPoints / participantIds.length)
    let remainder = totalBasisPoints - base * participantIds.length
    return Object.fromEntries(
      participantIds.map((memberId) => {
        const basisPoints = base + (remainder-- > 0 ? 1 : 0)
        return [memberId, (basisPoints / 100).toFixed(2)]
      }),
    )
  }

  try {
    const totalCents = parseMoneyToCents(rawAmount)
    const base = Math.floor(totalCents / participantIds.length)
    let remainder = totalCents - base * participantIds.length
    return Object.fromEntries(
      participantIds.map((memberId) => [memberId, centsInput(base + (remainder-- > 0 ? 1 : 0))]),
    )
  } catch {
    return Object.fromEntries(participantIds.map((memberId) => [memberId, '0.00']))
  }
}

export function ExpenseModal({
  group,
  expense,
  onClose,
  onSaved,
}: {
  group: Group
  expense?: Expense
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const activeMembers = group.members.filter((member) => member.isActive)
  const initialParticipantIds = expense?.shares.map((share) => share.memberId) ?? activeMembers.map((member) => member.id)
  const initialMethod = expense?.splitMethod ?? 'equal'
  const initialAmount = expense ? centsInput(expense.amountCents) : ''

  const [title, setTitle] = useState(expense?.title ?? '')
  const [amount, setAmount] = useState(initialAmount)
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? todayIso())
  const [category, setCategory] = useState<Expense['category']>(expense?.category ?? 'food_drink')
  const [payerId, setPayerId] = useState(expense?.paidByMemberId ?? activeMembers[0]?.id ?? '')
  const [participantIds, setParticipantIds] = useState(initialParticipantIds)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(initialMethod)
  const [splitValues, setSplitValues] = useState<Record<string, string>>(
    expense
      ? Object.fromEntries(expense.shares.map((share) => [share.memberId, share.inputValue]))
      : defaultSplitValues(initialMethod, initialParticipantIds, initialAmount),
  )
  const [note, setNote] = useState(expense?.note ?? '')
  const [submitError, setSubmitError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const preview = useMemo<{ shares: ExpenseShare[]; error: string }>(() => {
    if (!amount || participantIds.length === 0) return { shares: [], error: '' }
    try {
      return {
        shares: calculateExpenseShares(
          parseMoneyToCents(amount),
          splitMethod,
          participantIds,
          splitValues,
        ),
        error: '',
      }
    } catch (error) {
      return { shares: [], error: errorMessage(error) }
    }
  }, [amount, participantIds, splitMethod, splitValues])

  function chooseMethod(method: SplitMethod) {
    setSplitMethod(method)
    setSplitValues(defaultSplitValues(method, participantIds, amount))
  }

  function toggleParticipant(memberId: string) {
    const next = participantIds.includes(memberId)
      ? participantIds.filter((id) => id !== memberId)
      : [...participantIds, memberId]
    setParticipantIds(next)
    setSplitValues(defaultSplitValues(splitMethod, next, amount))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError('')
    if (title.trim().length < 2) {
      setSubmitError('Expense title must contain at least two characters.')
      return
    }
    if (!preview.shares.length || preview.error) {
      setSubmitError(preview.error || 'Complete the split before saving.')
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        title: title.trim(),
        amountCents: parseMoneyToCents(amount),
        expenseDate,
        category,
        paidByMemberId: payerId,
        splitMethod,
        shares: preview.shares,
        note: note.trim(),
      }
      if (expense) {
        await api.updateExpense(group.id, expense.id, payload)
      } else {
        await api.createExpense(group.id, payload)
      }
      await onSaved(expense ? 'Expense updated and balances recalculated.' : 'Expense added to the group.')
      onClose()
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const methodIcons = {
    equal: Equal,
    exact: Calculator,
    percentage: Percent,
    shares: Scale,
  }

  return (
    <Modal
      title={expense ? 'Edit expense' : 'Add an expense'}
      eyebrow={group.name}
      onClose={onClose}
      size="large"
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-grid form-grid--2">
          <label className="field field--wide">
            <span>Expense title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Dinner by the harbour"
              maxLength={120}
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span>Amount ({group.currency})</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              required
            />
          </label>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
              max={todayIso()}
              required
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as Expense['category'])}>
              {EXPENSE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Paid by</span>
            <select value={payerId} onChange={(event) => setPayerId(event.target.value)} required>
              {group.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}{member.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="form-section">
          <legend>Who shared this expense?</legend>
          <div className="participant-grid">
            {activeMembers.map((member) => {
              const checked = participantIds.includes(member.id)
              return (
                <label key={member.id} className={`participant-check${checked ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleParticipant(member.id)}
                  />
                  <Avatar name={member.name} color={member.color} size="small" />
                  <span>{member.name}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>How should it be split?</legend>
          <div className="method-grid">
            {SPLIT_METHODS.map((method) => {
              const Icon = methodIcons[method]
              return (
                <label key={method} className={`method-card${splitMethod === method ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="split-method"
                    value={method}
                    checked={splitMethod === method}
                    onChange={() => chooseMethod(method)}
                  />
                  <Icon size={19} aria-hidden="true" />
                  <span>{SPLIT_METHOD_LABELS[method]}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {splitMethod !== 'equal' && participantIds.length > 0 && (
          <div className="allocation-inputs">
            <div className="allocation-inputs__heading">
              <span>Member</span>
              <span>{splitMethod === 'percentage' ? 'Percent' : splitMethod === 'shares' ? 'Weight' : 'Amount'}</span>
            </div>
            {participantIds.map((memberId) => {
              const member = group.members.find((candidate) => candidate.id === memberId)
              if (!member) return null
              return (
                <label key={member.id} className="allocation-input">
                  <span className="allocation-input__member">
                    <Avatar name={member.name} color={member.color} size="small" />
                    {member.name}
                  </span>
                  <span className="allocation-input__control">
                    <input
                      value={splitValues[member.id] ?? ''}
                      onChange={(event) =>
                        setSplitValues((current) => ({ ...current, [member.id]: event.target.value }))
                      }
                      inputMode={splitMethod === 'shares' ? 'numeric' : 'decimal'}
                      aria-label={`${member.name} ${splitMethod} value`}
                    />
                    {splitMethod === 'percentage' && <span>%</span>}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        <div className={`allocation-preview${preview.error ? ' allocation-preview--error' : ''}`}>
          <div>
            <p className="eyebrow">Live allocation</p>
            <strong>
              {preview.error ||
                (preview.shares.length
                  ? `${preview.shares.length} people · ${SPLIT_METHOD_LABELS[splitMethod]}`
                  : 'Enter an amount and select participants')}
            </strong>
          </div>
          {preview.shares.length > 0 && (
            <div className="allocation-preview__chips">
              {preview.shares.map((share) => {
                const member = group.members.find((candidate) => candidate.id === share.memberId)
                return (
                  <span key={share.memberId}>
                    {member?.name}: {formatMoney(share.allocatedCents, group.currency)}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <label className="field">
          <span>Note <small>Optional</small></span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add context for the group"
            maxLength={500}
            rows={3}
          />
        </label>

        {submitError && <p className="form-error" role="alert">{submitError}</p>}

        <div className="modal-actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function MemberModal({
  group,
  onClose,
  onSaved,
}: {
  group: Group
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    try {
      setIsSaving(true)
      setError('')
      await api.addMember(group.id, { name })
      await onSaved(`${name.trim()} was added to ${group.name}.`)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title="Add a group member" eyebrow={group.name} onClose={onClose} size="small">
      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-callout">
          <UserPlus size={20} aria-hidden="true" />
          <p>Members can be included in new expenses as soon as they are added.</p>
        </div>
        <label className="field">
          <span>Display name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Ece"
            maxLength={60}
            autoFocus
            required
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button button--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button--primary" disabled={isSaving || !name.trim()}>
            {isSaving ? 'Adding…' : 'Add member'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function SettlementModal({
  group,
  balances,
  suggestion,
  onClose,
  onSaved,
}: {
  group: Group
  balances: GroupBalances
  suggestion?: SettlementSuggestion
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const debtors = balances.balances.filter((balance) => balance.netCents < 0)
  const creditors = balances.balances.filter((balance) => balance.netCents > 0)
  const [fromMemberId, setFromMemberId] = useState(suggestion?.fromMemberId ?? debtors[0]?.memberId ?? '')
  const [toMemberId, setToMemberId] = useState(suggestion?.toMemberId ?? creditors[0]?.memberId ?? '')
  const [amount, setAmount] = useState(suggestion ? centsInput(suggestion.amountCents) : '')
  const [settlementDate, setSettlementDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const sender = balances.balances.find((balance) => balance.memberId === fromMemberId)
  const receiver = balances.balances.find((balance) => balance.memberId === toMemberId)
  const maximumCents = sender && receiver ? Math.min(-sender.netCents, receiver.netCents) : 0

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      const amountCents = parseMoneyToCents(amount)
      if (amountCents > maximumCents) {
        throw new MoneyValidationError('This payment is larger than the available open balance.')
      }
      await api.createSettlement(group.id, {
        fromMemberId,
        toMemberId,
        amountCents,
        settlementDate,
        note: note.trim(),
      })
      await onSaved('Repayment recorded and balances updated.')
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title="Record a repayment" eyebrow="No money is transferred" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form-stack">
        <div className="repayment-flow">
          <label className="field">
            <span>Paid by</span>
            <select value={fromMemberId} onChange={(event) => setFromMemberId(event.target.value)}>
              {debtors.map((balance) => (
                <option key={balance.memberId} value={balance.memberId}>
                  {balance.memberName} · owes {formatMoney(-balance.netCents, group.currency)}
                </option>
              ))}
            </select>
          </label>
          <span className="repayment-flow__arrow" aria-hidden="true">→</span>
          <label className="field">
            <span>Paid to</span>
            <select value={toMemberId} onChange={(event) => setToMemberId(event.target.value)}>
              {creditors.map((balance) => (
                <option key={balance.memberId} value={balance.memberId}>
                  {balance.memberName} · gets {formatMoney(balance.netCents, group.currency)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              required
            />
            <small>Maximum {formatMoney(Math.max(maximumCents, 0), group.currency)}</small>
          </label>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={settlementDate}
              onChange={(event) => setSettlementDate(event.target.value)}
              max={todayIso()}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Note <small>Optional</small></span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Bank transfer"
            rows={3}
            maxLength={300}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button button--ghost" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="button button--primary"
            disabled={isSaving || !fromMemberId || !toMemberId || !amount}
          >
            {isSaving ? 'Recording…' : 'Record repayment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Archive,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  Home,
  House,
  LayoutDashboard,
  Pencil,
  Plane,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react'
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { api } from './api'
import { ExpenseModal, MemberModal, SettlementModal } from './components/forms'
import {
  Avatar,
  AvatarStack,
  BrandMark,
  ErrorSurface,
  LoadingSurface,
  Toast,
} from './components/ui'
import { formatDate, formatMoney } from './lib/money'
import {
  CATEGORY_LABELS,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  GROUP_TYPE_LABELS,
  GROUP_TYPES,
  SPLIT_METHOD_LABELS,
  type ActivityItem,
  type Expense,
  type ExpenseCategory,
  type Group,
  type GroupBalances,
  type GroupSummary,
  type GroupType,
  type SettlementSuggestion,
} from './types'

type ShowToast = (message: string) => void

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function AppChrome({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="topbar__brand">
          <BrandMark />
        </Link>
        <div className="topbar__actions">
          <span className="mode-badge"><span aria-hidden="true" /> Prototype mode</span>
          <Link to="/groups/new" className="button button--primary button--compact">
            <Plus size={18} aria-hidden="true" />
            <span>New group</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}

function GroupTypeIcon({ type }: { type: GroupType }) {
  const Icon =
    type === 'trip'
      ? Plane
      : type === 'household'
        ? House
        : type === 'work'
          ? BriefcaseBusiness
          : type === 'friends'
            ? Users
            : CircleDollarSign
  return <Icon size={19} aria-hidden="true" />
}

function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadGroups = useCallback(async () => {
    try {
      setError('')
      setIsLoading(true)
      setGroups(await api.listGroups())
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const activeGroups = groups.filter((group) => !group.isArchived)
  const openBalanceCount = activeGroups.filter((group) => group.unsettledCents > 0).length
  const totalMembers = activeGroups.reduce((sum, group) => sum + group.memberCount, 0)

  return (
    <AppChrome>
      <main className="page page--groups">
        <section className="page-heading page-heading--split">
          <div>
            <p className="eyebrow">Shared expense workspace</p>
            <h1>Your groups</h1>
            <p>See every shared balance at a glance, then settle the right people.</p>
          </div>
          <Link to="/groups/new" className="button button--primary page-heading__action">
            <Plus size={18} aria-hidden="true" /> Create a group
          </Link>
        </section>

        {isLoading ? (
          <LoadingSurface />
        ) : error ? (
          <ErrorSurface message={error} onRetry={() => void loadGroups()} />
        ) : (
          <>
            <section className="portfolio-strip" aria-label="Group summary">
              <div className="portfolio-strip__lead">
                <span className="portfolio-strip__icon"><WalletCards size={23} aria-hidden="true" /></span>
                <div>
                  <small>Active groups</small>
                  <strong>{activeGroups.length}</strong>
                </div>
              </div>
              <div><small>People connected</small><strong>{totalMembers}</strong></div>
              <div><small>Open balances</small><strong>{openBalanceCount}</strong></div>
              <div className="portfolio-strip__note">
                <span className="status-dot" aria-hidden="true" />
                Mock data is active for this prototype
              </div>
            </section>

            {activeGroups.length > 0 ? (
              <section className="group-grid" aria-label="Active groups">
                {activeGroups.map((group, index) => (
                  <Link
                    to={`/groups/${group.id}`}
                    className={`group-card group-card--accent-${(index % 3) + 1}`}
                    key={group.id}
                  >
                    <div className="group-card__top">
                      <span className="group-type-icon"><GroupTypeIcon type={group.groupType} /></span>
                      <span className="group-card__currency">{group.currency}</span>
                    </div>
                    <div className="group-card__copy">
                      <span className="meta-label">{GROUP_TYPE_LABELS[group.groupType]}</span>
                      <h2>{group.name}</h2>
                      <p>{group.description}</p>
                    </div>
                    <div className="group-card__figures">
                      <div>
                        <small>Total spend</small>
                        <strong>{formatMoney(group.totalSpentCents, group.currency)}</strong>
                      </div>
                      <div className={group.unsettledCents > 0 ? 'text-negative' : 'text-positive'}>
                        <small>Still unsettled</small>
                        <strong>{formatMoney(group.unsettledCents, group.currency)}</strong>
                      </div>
                    </div>
                    <div className="group-card__footer">
                      <span className="member-preview">
                        <AvatarStack members={group.memberPreview} />
                        <span>{group.memberCount} members</span>
                      </span>
                      <span className="open-link">Open group <ChevronRight size={17} aria-hidden="true" /></span>
                    </div>
                  </Link>
                ))}
                <Link to="/groups/new" className="new-group-card">
                  <span><Plus size={22} aria-hidden="true" /></span>
                  <strong>Create another group</strong>
                  <p>Start a new trip, home, or team ledger.</p>
                </Link>
              </section>
            ) : (
              <section className="empty-state">
                <span className="empty-state__icon"><WalletCards size={28} aria-hidden="true" /></span>
                <h2>Your first shared ledger starts here</h2>
                <p>Add the people involved, record one expense, and SplitWeave will calculate the rest.</p>
                <Link to="/groups/new" className="button button--primary">Create your first group</Link>
              </section>
            )}
          </>
        )}
      </main>
    </AppChrome>
  )
}

function NewGroupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupType, setGroupType] = useState<GroupType>('trip')
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('TRY')
  const [memberNames, setMemberNames] = useState(['', ''])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function updateMemberName(index: number, value: string) {
    setMemberNames((current) => current.map((nameValue, itemIndex) => (itemIndex === index ? value : nameValue)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validMemberNames = memberNames.map((memberName) => memberName.trim()).filter(Boolean)
    if (name.trim().length < 2) {
      setError('Group name must contain at least two characters.')
      return
    }
    if (validMemberNames.length === 0) {
      setError('Add at least one member to create the group.')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const group = await api.createGroup({
        name,
        description,
        groupType,
        currency,
        memberNames: validMemberNames,
      })
      navigate(`/groups/${group.id}`)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppChrome>
      <main className="page page--form">
        <Link to="/" className="back-link"><ArrowLeft size={17} aria-hidden="true" /> Back to groups</Link>
        <div className="form-page-layout">
          <section className="form-page-intro">
            <p className="eyebrow">New shared ledger</p>
            <h1>Create a group</h1>
            <p>Choose one currency for the group, add the first members, and start tracking together.</p>
            <div className="weave-note">
              <span className="weave-note__mark" aria-hidden="true"><i /><i /><i /></span>
              <div>
                <strong>One clear balance</strong>
                <p>Expenses and repayments stay separate, so every total can be explained.</p>
              </div>
            </div>
          </section>
          <form className="form-card form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Group name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Aegean Weekend"
                maxLength={80}
                autoFocus
                required
              />
            </label>
            <label className="field">
              <span>Description <small>Optional</small></span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this group sharing?"
                maxLength={300}
                rows={3}
              />
            </label>
            <div className="form-grid form-grid--2">
              <label className="field">
                <span>Group type</span>
                <select value={groupType} onChange={(event) => setGroupType(event.target.value as GroupType)}>
                  {GROUP_TYPES.map((value) => <option key={value} value={value}>{GROUP_TYPE_LABELS[value]}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Currency</span>
                <select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}>
                  {CURRENCIES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <small>Locked after the first transaction.</small>
              </label>
            </div>
            <fieldset className="form-section">
              <legend>Initial members</legend>
              <div className="member-name-list">
                {memberNames.map((memberName, index) => (
                  <label className="field" key={index}>
                    <span className="sr-only">Member {index + 1}</span>
                    <input
                      value={memberName}
                      onChange={(event) => updateMemberName(index, event.target.value)}
                      placeholder={`Member ${index + 1} name`}
                      maxLength={60}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setMemberNames((current) => [...current, ''])}
              >
                <Plus size={16} aria-hidden="true" /> Add another member
              </button>
            </fieldset>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-card__actions">
              <Link to="/" className="button button--ghost">Cancel</Link>
              <button type="submit" className="button button--primary" disabled={isSaving}>
                {isSaving ? 'Creating…' : 'Create group'} <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </AppChrome>
  )
}

type GroupView = 'overview' | 'expenses' | 'settlements' | 'members'

function GroupPage({ showToast }: { showToast: ShowToast }) {
  const { groupId } = useParams<{ groupId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [balances, setBalances] = useState<GroupBalances | null>(null)
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>()
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [settlementModalOpen, setSettlementModalOpen] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<SettlementSuggestion | undefined>()

  const loadGroup = useCallback(
    async (showLoading = true) => {
      if (!groupId) return
      try {
        if (showLoading) setIsLoading(true)
        setError('')
        const [groupResult, balanceResult, suggestionResult] = await Promise.all([
          api.getGroup(groupId),
          api.getBalances(groupId),
          api.getSettlementSuggestions(groupId),
        ])
        setGroup(groupResult)
        setBalances(balanceResult)
        setSuggestions(suggestionResult)
      } catch (caught) {
        setError(getErrorMessage(caught))
      } finally {
        setIsLoading(false)
      }
    },
    [groupId],
  )

  useEffect(() => {
    void loadGroup()
  }, [loadGroup])

  const view: GroupView = location.pathname.endsWith('/expenses')
    ? 'expenses'
    : location.pathname.endsWith('/settlements')
      ? 'settlements'
      : location.pathname.endsWith('/members')
        ? 'members'
        : 'overview'

  async function refreshWithToast(message: string) {
    await loadGroup(false)
    showToast(message)
  }

  async function handleDeleteExpense(expense: Expense) {
    if (!group || !window.confirm(`Delete “${expense.title}”? Balances will be recalculated.`)) return
    try {
      await api.deleteExpense(group.id, expense.id)
      await refreshWithToast('Expense deleted and balances recalculated.')
    } catch (caught) {
      setError(getErrorMessage(caught))
    }
  }

  async function handleDeleteSettlement(settlementId: string) {
    if (!group || !window.confirm('Delete this repayment record and restore the previous balances?')) return
    try {
      await api.deleteSettlement(group.id, settlementId)
      await refreshWithToast('Repayment deleted and balances restored.')
    } catch (caught) {
      setError(getErrorMessage(caught))
    }
  }

  async function handleArchive() {
    if (!group) return
    if (!group.isArchived && !window.confirm('Archive this group? It will become read-only until restored.')) return
    try {
      await api.updateGroup(group.id, { isArchived: !group.isArchived })
      await refreshWithToast(group.isArchived ? 'Group restored.' : 'Group archived.')
    } catch (caught) {
      setError(getErrorMessage(caught))
    }
  }

  async function handleToggleMember(memberId: string, isActive: boolean) {
    if (!group) return
    try {
      await api.updateMember(group.id, memberId, { isActive })
      await refreshWithToast(isActive ? 'Member reactivated.' : 'Member deactivated; history was preserved.')
    } catch (caught) {
      setError(getErrorMessage(caught))
    }
  }

  function openExpense(expense?: Expense) {
    setEditingExpense(expense)
    setExpenseModalOpen(true)
  }

  function openSettlement(suggestion?: SettlementSuggestion) {
    setSelectedSuggestion(suggestion)
    setSettlementModalOpen(true)
  }

  if (isLoading) {
    return <AppChrome><main className="page"><LoadingSurface /></main></AppChrome>
  }
  if (error || !group || !balances) {
    return (
      <AppChrome>
        <main className="page"><ErrorSurface message={error || 'Group not found.'} onRetry={() => void loadGroup()} /></main>
      </AppChrome>
    )
  }

  const canAddExpense = !group.isArchived && group.members.filter((member) => member.isActive).length >= 2

  return (
    <AppChrome>
      <main className="group-workspace">
        <aside className="group-rail">
          <Link to="/" className="group-rail__back"><ArrowLeft size={17} aria-hidden="true" /> All groups</Link>
          <div className="group-rail__identity">
            <span className="group-type-icon group-type-icon--large"><GroupTypeIcon type={group.groupType} /></span>
            <p className="eyebrow">{GROUP_TYPE_LABELS[group.groupType]} · {group.currency}</p>
            <h1>{group.name}</h1>
            <p>{group.description}</p>
          </div>
          <nav className="group-nav" aria-label="Group navigation">
            <NavLink end to={`/groups/${group.id}`}><LayoutDashboard size={19} /> Overview</NavLink>
            <NavLink to={`/groups/${group.id}/expenses`}><ReceiptText size={19} /> Expenses <span>{group.expenses.length}</span></NavLink>
            <NavLink to={`/groups/${group.id}/settlements`}><HandCoins size={19} /> Settle up <span>{suggestions.length}</span></NavLink>
            <NavLink to={`/groups/${group.id}/members`}><Users size={19} /> Members <span>{group.members.length}</span></NavLink>
          </nav>
          <div className="group-rail__footer">
            <button type="button" onClick={() => void handleArchive()}>
              {group.isArchived ? <CheckCircle2 size={17} /> : <Archive size={17} />}
              {group.isArchived ? 'Restore group' : 'Archive group'}
            </button>
            <p>Prototype data resets when the page reloads.</p>
          </div>
        </aside>

        <section className="workspace-content">
          {group.isArchived && (
            <div className="archive-banner" role="status">
              <Archive size={18} aria-hidden="true" />
              <span><strong>This group is archived.</strong> Restore it to add or change transactions.</span>
              <button type="button" onClick={() => void handleArchive()}>Restore</button>
            </div>
          )}
          <header className="workspace-heading">
            <div>
              <p className="eyebrow">{view === 'settlements' ? 'Settle up' : view}</p>
              <h2>{view === 'overview' ? 'Group overview' : view === 'settlements' ? 'Clear open balances' : view[0].toUpperCase() + view.slice(1)}</h2>
            </div>
            <div className="workspace-heading__actions">
              {view === 'members' && !group.isArchived && (
                <button type="button" className="button button--secondary" onClick={() => setMemberModalOpen(true)}>
                  <UserPlus size={17} /> Add member
                </button>
              )}
              {view === 'settlements' && suggestions.length > 0 && !group.isArchived && (
                <button type="button" className="button button--secondary" onClick={() => openSettlement()}>
                  <HandCoins size={17} /> Custom repayment
                </button>
              )}
              {(view === 'overview' || view === 'expenses') && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => openExpense()}
                  disabled={!canAddExpense}
                  title={canAddExpense ? undefined : 'Add at least two active members first'}
                >
                  <Plus size={18} /> Add expense
                </button>
              )}
            </div>
          </header>

          {view === 'overview' && (
            <OverviewView
              group={group}
              balances={balances}
              suggestions={suggestions}
              openSettlement={openSettlement}
              goToExpenses={() => navigate(`/groups/${group.id}/expenses`)}
            />
          )}
          {view === 'expenses' && (
            <ExpensesView group={group} onEdit={openExpense} onDelete={(expense) => void handleDeleteExpense(expense)} />
          )}
          {view === 'settlements' && (
            <SettlementsView
              group={group}
              balances={balances}
              suggestions={suggestions}
              onRecord={openSettlement}
              onDelete={(settlementId) => void handleDeleteSettlement(settlementId)}
            />
          )}
          {view === 'members' && (
            <MembersView group={group} balances={balances} onToggle={(id, active) => void handleToggleMember(id, active)} />
          )}
        </section>
      </main>

      {expenseModalOpen && (
        <ExpenseModal
          group={group}
          expense={editingExpense}
          onClose={() => setExpenseModalOpen(false)}
          onSaved={refreshWithToast}
        />
      )}
      {memberModalOpen && (
        <MemberModal group={group} onClose={() => setMemberModalOpen(false)} onSaved={refreshWithToast} />
      )}
      {settlementModalOpen && (
        <SettlementModal
          group={group}
          balances={balances}
          suggestion={selectedSuggestion}
          onClose={() => setSettlementModalOpen(false)}
          onSaved={refreshWithToast}
        />
      )}
    </AppChrome>
  )
}

function OverviewView({
  group,
  balances,
  suggestions,
  openSettlement,
  goToExpenses,
}: {
  group: Group
  balances: GroupBalances
  suggestions: SettlementSuggestion[]
  openSettlement: (suggestion?: SettlementSuggestion) => void
  goToExpenses: () => void
}) {
  const categoryTotals = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>()
    for (const expense of group.expenses) {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountCents)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [group.expenses])
  const largestCategory = Math.max(...categoryTotals.map(([, amount]) => amount), 1)
  const nextSuggestion = suggestions[0]

  return (
    <div className="dashboard-grid">
      <section className="metric-grid dashboard-grid__wide" aria-label="Group totals">
        <article className="metric-card metric-card--primary">
          <span className="metric-card__icon"><WalletCards size={21} aria-hidden="true" /></span>
          <small>Total group spend</small>
          <strong>{formatMoney(balances.totalSpentCents, group.currency)}</strong>
          <p>{group.expenses.length} recorded expense{group.expenses.length === 1 ? '' : 's'}</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--rose"><BadgeDollarSign size={21} aria-hidden="true" /></span>
          <small>Still unsettled</small>
          <strong>{formatMoney(balances.unsettledCents, group.currency)}</strong>
          <p>{suggestions.length} suggested repayment{suggestions.length === 1 ? '' : 's'}</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--teal"><Users size={21} aria-hidden="true" /></span>
          <small>Active members</small>
          <strong>{group.members.filter((member) => member.isActive).length}</strong>
          <p>{group.members.length} total in this group</p>
        </article>
      </section>

      <section className="panel balance-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Current position</p><h3>Member balances</h3></div>
          <button type="button" className="text-button" onClick={goToExpenses}>View expenses <ChevronRight size={16} /></button>
        </div>
        <div className="balance-list">
          {balances.balances.map((balance) => (
            <div className="balance-row" key={balance.memberId}>
              <Avatar name={balance.memberName} color={balance.memberColor} />
              <div className="balance-row__person">
                <strong>{balance.memberName}</strong>
                <span>Paid {formatMoney(balance.paidCents, group.currency)}</span>
              </div>
              <div className={`balance-value ${balance.netCents > 0 ? 'is-positive' : balance.netCents < 0 ? 'is-negative' : 'is-settled'}`}>
                {balance.netCents > 0 ? <ArrowUpRight size={17} /> : balance.netCents < 0 ? <ArrowDownRight size={17} /> : <CheckCircle2 size={17} />}
                <span>
                  <small>{balance.netCents > 0 ? 'gets back' : balance.netCents < 0 ? 'owes' : 'settled'}</small>
                  <strong>{formatMoney(Math.abs(balance.netCents), group.currency)}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel settle-card">
        <div className="settle-card__visual" aria-hidden="true">
          <span /><span /><span />
        </div>
        <p className="eyebrow">Next best action</p>
        {nextSuggestion ? (
          <>
            <h3>One payment clears the largest open thread.</h3>
            <div className="suggestion-inline">
              <strong>{nextSuggestion.fromMemberName}</strong>
              <span><ArrowRight size={17} /> {formatMoney(nextSuggestion.amountCents, group.currency)}</span>
              <strong>{nextSuggestion.toMemberName}</strong>
            </div>
            <button
              className="button button--light"
              type="button"
              onClick={() => openSettlement(nextSuggestion)}
              disabled={group.isArchived}
            >
              Record this repayment
            </button>
            <small>No money moves through SplitWeave.</small>
          </>
        ) : (
          <div className="settled-message">
            <CheckCircle2 size={28} />
            <h3>Everyone is settled.</h3>
            <p>There are no open balances in this group.</p>
          </div>
        )}
      </section>

      <section className="panel category-panel">
        <div className="panel-heading"><div><p className="eyebrow">Composition</p><h3>Spending by category</h3></div></div>
        {categoryTotals.length > 0 ? (
          <div className="category-bars">
            {categoryTotals.map(([category, amount]) => (
              <div className="category-bar" key={category}>
                <div><span>{CATEGORY_LABELS[category]}</span><strong>{formatMoney(amount, group.currency)}</strong></div>
                <span className="category-bar__track"><i style={{ width: `${(amount / largestCategory) * 100}%` }} /></span>
              </div>
            ))}
          </div>
        ) : (
          <p className="panel-empty">Category totals will appear after the first expense.</p>
        )}
      </section>

      <section className="panel activity-panel dashboard-grid__wide">
        <div className="panel-heading"><div><p className="eyebrow">Latest changes</p><h3>Recent activity</h3></div></div>
        <div className="activity-grid">
          {group.activities.slice(0, 5).map((activity) => <ActivityCard key={activity.id} activity={activity} />)}
        </div>
      </section>
    </div>
  )
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  const Icon = activity.kind === 'expense' ? ReceiptText : activity.kind === 'settlement' ? HandCoins : activity.kind === 'member' ? UserRound : Home
  return (
    <article className="activity-card">
      <span><Icon size={18} aria-hidden="true" /></span>
      <div><strong>{activity.title}</strong><p>{activity.detail}</p><small>{formatDate(activity.createdAt.slice(0, 10))}</small></div>
    </article>
  )
}

function ExpensesView({
  group,
  onEdit,
  onDelete,
}: {
  group: Group
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')

  const expenses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return group.expenses
      .filter((expense) => category === 'all' || expense.category === category)
      .filter((expense) => !query || `${expense.title} ${expense.note}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => sort === 'newest' ? b.expenseDate.localeCompare(a.expenseDate) : a.expenseDate.localeCompare(b.expenseDate))
  }, [category, group.expenses, search, sort])

  return (
    <section className="panel list-panel">
      <div className="filter-bar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search expenses</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" />
        </label>
        <label className="filter-select">
          <span className="sr-only">Filter by category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Sort expenses</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {expenses.length > 0 ? (
        <div className="transaction-list">
          {expenses.map((expense) => {
            const payer = group.members.find((member) => member.id === expense.paidByMemberId)
            return (
              <article className="transaction-row" key={expense.id}>
                <span className="transaction-row__icon"><ReceiptText size={19} aria-hidden="true" /></span>
                <div className="transaction-row__main">
                  <strong>{expense.title}</strong>
                  <span>{formatDate(expense.expenseDate)} · {CATEGORY_LABELS[expense.category]}</span>
                </div>
                <div className="transaction-row__payer">
                  {payer && <Avatar name={payer.name} color={payer.color} size="small" />}
                  <span><small>Paid by</small><strong>{payer?.name ?? 'Unknown'}</strong></span>
                </div>
                <div className="transaction-row__split"><small>Split</small><strong>{SPLIT_METHOD_LABELS[expense.splitMethod]}</strong></div>
                <strong className="transaction-row__amount">{formatMoney(expense.amountCents, group.currency)}</strong>
                <div className="transaction-row__actions">
                  <button type="button" onClick={() => onEdit(expense)} aria-label={`Edit ${expense.title}`} disabled={group.isArchived}><Pencil size={17} /></button>
                  <button type="button" onClick={() => onDelete(expense)} aria-label={`Delete ${expense.title}`} disabled={group.isArchived}><Trash2 size={17} /></button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="inline-empty">
          <Search size={25} aria-hidden="true" />
          <h3>{group.expenses.length ? 'No expenses match these filters' : 'No expenses yet'}</h3>
          <p>{group.expenses.length ? 'Clear a filter or try another search.' : 'Add the first expense to calculate group balances.'}</p>
          {group.expenses.length > 0 && <button type="button" className="text-button" onClick={() => { setSearch(''); setCategory('all') }}>Clear filters</button>}
        </div>
      )}
    </section>
  )
}

function SettlementsView({
  group,
  balances,
  suggestions,
  onRecord,
  onDelete,
}: {
  group: Group
  balances: GroupBalances
  suggestions: SettlementSuggestion[]
  onRecord: (suggestion?: SettlementSuggestion) => void
  onDelete: (settlementId: string) => void
}) {
  return (
    <div className="settlement-layout">
      <section className="panel suggestion-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Suggested plan</p><h3>{suggestions.length ? `${suggestions.length} repayments to settle` : 'Everyone is settled'}</h3></div>
          <span className="reconcile-badge"><CheckCircle2 size={15} /> Balances reconcile to zero</span>
        </div>
        {suggestions.length > 0 ? (
          <div className="suggestion-list">
            {suggestions.map((suggestion, index) => (
              <article className="suggestion-card" key={`${suggestion.fromMemberId}-${suggestion.toMemberId}-${index}`}>
                <span className="suggestion-card__number">{String(index + 1).padStart(2, '0')}</span>
                <div className="suggestion-card__people">
                  <strong>{suggestion.fromMemberName}</strong>
                  <span><ArrowRight size={18} aria-hidden="true" /></span>
                  <strong>{suggestion.toMemberName}</strong>
                </div>
                <strong className="suggestion-card__amount">{formatMoney(suggestion.amountCents, group.currency)}</strong>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={() => onRecord(suggestion)}
                  disabled={group.isArchived}
                >
                  Record
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="inline-empty inline-empty--success"><CheckCircle2 size={30} /><h3>No repayments needed</h3><p>Every member's current net balance is zero.</p></div>
        )}
      </section>

      <section className="panel balance-summary-panel">
        <p className="eyebrow">Open balance</p>
        <strong>{formatMoney(balances.unsettledCents, group.currency)}</strong>
        <p>This is the total amount still moving between group members—not additional spending.</p>
        <div className="balance-mini-list">
          {balances.balances.filter((balance) => balance.netCents !== 0).map((balance) => (
            <div key={balance.memberId}>
              <span><Avatar name={balance.memberName} color={balance.memberColor} size="small" /> {balance.memberName}</span>
              <strong className={balance.netCents > 0 ? 'text-positive' : 'text-negative'}>{balance.netCents > 0 ? '+' : '−'}{formatMoney(Math.abs(balance.netCents), group.currency)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel settlement-history settlement-layout__wide">
        <div className="panel-heading"><div><p className="eyebrow">Recorded payments</p><h3>Settlement history</h3></div></div>
        {group.settlements.length > 0 ? (
          <div className="transaction-list">
            {[...group.settlements].sort((a, b) => b.settlementDate.localeCompare(a.settlementDate)).map((settlement) => {
              const sender = group.members.find((member) => member.id === settlement.fromMemberId)
              const receiver = group.members.find((member) => member.id === settlement.toMemberId)
              return (
                <article className="transaction-row transaction-row--settlement" key={settlement.id}>
                  <span className="transaction-row__icon transaction-row__icon--teal"><HandCoins size={19} /></span>
                  <div className="transaction-row__main"><strong>{sender?.name} paid {receiver?.name}</strong><span>{formatDate(settlement.settlementDate)}{settlement.note ? ` · ${settlement.note}` : ''}</span></div>
                  <strong className="transaction-row__amount">{formatMoney(settlement.amountCents, group.currency)}</strong>
                  <div className="transaction-row__actions"><button type="button" onClick={() => onDelete(settlement.id)} aria-label="Delete repayment" disabled={group.isArchived}><Trash2 size={17} /></button></div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="panel-empty">No repayments have been recorded yet.</p>
        )}
      </section>
    </div>
  )
}

function MembersView({
  group,
  balances,
  onToggle,
}: {
  group: Group
  balances: GroupBalances
  onToggle: (memberId: string, isActive: boolean) => void
}) {
  return (
    <section className="member-grid" aria-label="Group members">
      {group.members.map((member) => {
        const balance = balances.balances.find((candidate) => candidate.memberId === member.id)
        return (
          <article className={`member-card${member.isActive ? '' : ' is-inactive'}`} key={member.id}>
            <div className="member-card__heading">
              <Avatar name={member.name} color={member.color} size="large" />
              <span className={`status-chip ${member.isActive ? 'status-chip--active' : ''}`}>{member.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <h3>{member.name}</h3>
            <p>Member since {formatDate(member.createdAt.slice(0, 10))}</p>
            <div className="member-card__balance">
              <small>Current position</small>
              <strong className={(balance?.netCents ?? 0) > 0 ? 'text-positive' : (balance?.netCents ?? 0) < 0 ? 'text-negative' : ''}>
                {(balance?.netCents ?? 0) > 0 ? 'Gets ' : (balance?.netCents ?? 0) < 0 ? 'Owes ' : ''}
                {formatMoney(Math.abs(balance?.netCents ?? 0), group.currency)}
              </strong>
            </div>
            <div className="member-card__figures">
              <span><small>Paid</small><strong>{formatMoney(balance?.paidCents ?? 0, group.currency)}</strong></span>
              <span><small>Share</small><strong>{formatMoney(balance?.owedCents ?? 0, group.currency)}</strong></span>
            </div>
            <button
              type="button"
              className="button button--ghost button--full"
              onClick={() => onToggle(member.id, !member.isActive)}
              disabled={group.isArchived}
            >
              {member.isActive ? 'Deactivate member' : 'Reactivate member'}
            </button>
          </article>
        )
      })}
    </section>
  )
}

export default function App() {
  const [toast, setToast] = useState('')

  return (
    <>
      <Routes>
        <Route path="/" element={<GroupsPage />} />
        <Route path="/groups/new" element={<NewGroupPage />} />
        <Route path="/groups/:groupId" element={<GroupPage showToast={setToast} />} />
        <Route path="/groups/:groupId/expenses" element={<GroupPage showToast={setToast} />} />
        <Route path="/groups/:groupId/settlements" element={<GroupPage showToast={setToast} />} />
        <Route path="/groups/:groupId/members" element={<GroupPage showToast={setToast} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}

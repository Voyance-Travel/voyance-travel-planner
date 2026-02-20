import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  DollarSign,
  Plus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Plane,
  Hotel,
  Utensils,
  Car,
  Ticket,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useTripExpenses,
  useTripMembers,
  useBudgetSummary,
  useAddTripExpense,
  useUpdateTripExpense,
  useDeleteTripExpense,
  type TripExpense,
  type TripMember,
  type ExpenseSplitType,
  type PaymentStatus,
} from '@/services/tripBudgetAPI';

interface TripBudgetTrackerProps {
  tripId: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'flight', label: 'Flights', icon: Plane },
  { value: 'hotel', label: 'Accommodation', icon: Hotel },
  { value: 'activity', label: 'Activities', icon: Ticket },
  { value: 'food', label: 'Food & Dining', icon: Utensils },
  { value: 'transport', label: 'Transport', icon: Car },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

function getCategoryIcon(category: string) {
  const cat = EXPENSE_CATEGORIES.find(c => c.value === category);
  return cat ? cat.icon : DollarSign;
}

function getStatusBadge(status: PaymentStatus) {
  switch (status) {
    case 'paid':
      return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>;
    case 'partial':
      return <Badge variant="default" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" />Partial</Badge>;
    default:
      return <Badge variant="default" className="bg-muted text-muted-foreground border-border"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  }
}

export default function TripBudgetTracker({ tripId }: TripBudgetTrackerProps) {
  const { data: expenses = [], isLoading: expensesLoading } = useTripExpenses(tripId);
  const { data: members = [] } = useTripMembers(tripId);
  const { data: summary } = useBudgetSummary(tripId);
  const addExpense = useAddTripExpense();
  const updateExpense = useUpdateTripExpense();
  const deleteExpense = useDeleteTripExpense();

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: 'other',
    description: '',
    plannedAmount: '',
    splitType: 'equal' as ExpenseSplitType,
    paidByMemberId: '',
  });
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.plannedAmount || parseFloat(newExpense.plannedAmount) <= 0) {
      toast.error('Please fill in description and enter an amount greater than $0');
      return;
    }

    try {
      await addExpense.mutateAsync({
        tripId,
        category: newExpense.category,
        description: newExpense.description,
        plannedAmount: parseFloat(newExpense.plannedAmount),
        splitType: newExpense.splitType,
        paidByMemberId: newExpense.paidByMemberId || undefined,
      });
      toast.success('Expense added');
      setShowAddExpense(false);
      setNewExpense({
        category: 'other',
        description: '',
        plannedAmount: '',
        splitType: 'equal',
        paidByMemberId: '',
      });
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  const handleMarkPaid = async (expense: TripExpense) => {
    try {
      await updateExpense.mutateAsync({
        expenseId: expense.id,
        tripId,
        updates: { paymentStatus: expense.paymentStatus === 'paid' ? 'pending' : 'paid' },
      });
      toast.success(expense.paymentStatus === 'paid' ? 'Marked as pending' : 'Marked as paid');
    } catch (error) {
      toast.error('Failed to update expense');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense.mutateAsync({ expenseId, tripId });
      toast.success('Expense deleted');
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const progressPercent = summary ? (summary.totalPaid / summary.totalActual) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Planned</p>
          <p className="text-2xl font-light">${summary?.totalPlanned.toFixed(0) || '0'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Actual</p>
          <p className="text-2xl font-light">${summary?.totalActual.toFixed(0) || '0'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Paid</p>
          <p className="text-2xl font-light text-green-600">${summary?.totalPaid.toFixed(0) || '0'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pending</p>
          <p className="text-2xl font-light text-yellow-600">${summary?.totalPending.toFixed(0) || '0'}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {summary && summary.totalActual > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Payment Progress</p>
            <p className="text-sm font-medium">{progressPercent.toFixed(0)}%</p>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Member Balances */}
      {summary && summary.memberBalances.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Who Owes What
          </h3>
          <div className="space-y-3">
            {summary.memberBalances.map(balance => (
              <div key={balance.memberId} className="flex items-center justify-between">
                <span className="text-sm">{balance.name}</span>
                <div className="flex items-center gap-4 text-sm">
                  {balance.owes > 0 && (
                    <span className="text-red-500">Owes ${balance.owes.toFixed(0)}</span>
                  )}
                  {balance.owed > 0 && (
                    <span className="text-green-500">Owed ${balance.owed.toFixed(0)}</span>
                  )}
                  {balance.owes === 0 && balance.owed === 0 && (
                    <span className="text-muted-foreground">Settled</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Expenses</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddExpense(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Expense
          </Button>
        </div>

        {expensesLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No expenses yet</p>
            <p className="text-xs mt-1">Add your first expense to start tracking</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map(expense => {
              const CategoryIcon = getCategoryIcon(expense.category);
              const isExpanded = expandedExpenseId === expense.id;
              const paidBy = members.find(m => m.id === expense.paidByMemberId);

              return (
                <motion.div
                  key={expense.id}
                  layout
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedExpenseId(isExpanded ? null : expense.id)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <CategoryIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label}
                        {paidBy && ` • Paid by ${paidBy.name || paidBy.email}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(expense.actualAmount || expense.plannedAmount).toFixed(0)}</p>
                      {getStatusBadge(expense.paymentStatus)}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border overflow-hidden"
                      >
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Planned</p>
                              <p className="font-medium">${expense.plannedAmount.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Actual</p>
                              <p className="font-medium">${(expense.actualAmount || expense.plannedAmount).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Split Type</p>
                              <p className="font-medium capitalize">{expense.splitType}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              <p className="font-medium capitalize">{expense.paymentStatus}</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={expense.paymentStatus === 'paid' ? 'outline' : 'default'}
                              onClick={() => handleMarkPaid(expense)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {expense.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={newExpense.category}
                onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="e.g., Flight to Paris"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-7"
                  value={newExpense.plannedAmount}
                  onChange={(e) => setNewExpense({ ...newExpense, plannedAmount: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Split Type</label>
              <Select
                value={newExpense.splitType}
                onValueChange={(value) => setNewExpense({ ...newExpense, splitType: value as ExpenseSplitType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Split Equally</SelectItem>
                  <SelectItem value="manual">Manual Assignment</SelectItem>
                  <SelectItem value="percentage">By Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {members.length > 0 && (
              <div>
                <label className="text-sm font-medium">Paid By</label>
                <Select
                  value={newExpense.paidByMemberId}
                  onValueChange={(value) => setNewExpense({ ...newExpense, paidByMemberId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who paid" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email}
                        {member.role === 'primary' && ' (Primary)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddExpense(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddExpense} disabled={addExpense.isPending} className="flex-1">
                {addExpense.isPending ? 'Adding...' : 'Add Expense'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

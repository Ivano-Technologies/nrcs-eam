import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import PageLoader from "@/components/ui/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, Loader2, Plus, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatNaira } from "@/lib/format";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { cn } from "@/lib/utils";
import { ModuleFiltersCard, ModuleFilterSearch } from "@/components/ModuleFiltersCard";

export default function Financial() {
  const { user } = useAuth();
  const { data: transactions, isLoading, refetch } = trpc.financial.list.useQuery();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  
  const [newTransaction, setNewTransaction] = useState({
    transactionType: "maintenance",
    amount: "",
    description: "",
    transactionDate: new Date().toISOString().split('T')[0],
    assetId: "",
    receiptNumber: "",
  });

  const [finSearch, setFinSearch] = useState("");
  const [finType, setFinType] = useState<string>("all");

  const createTransactionMutation = trpc.financial.create.useMutation({
    onSuccess: () => {
      toast.success("Transaction created successfully");
      setIsCreateDialogOpen(false);
      refetch();
      setNewTransaction({
        transactionType: "maintenance",
        amount: "",
        description: "",
        transactionDate: new Date().toISOString().split('T')[0],
        assetId: "",
        receiptNumber: "",
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to create transaction: ${error.message}`);
    },
  });

  const updateTransactionMutation = trpc.financial.update.useMutation({
    onSuccess: () => {
      toast.success("Transaction updated successfully");
      setEditingTransactionId(null);
      setEditData({});
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to update transaction: ${error.message}`);
    },
  });

  const handleCreateTransaction = () => {
    if (!newTransaction.amount || parseFloat(newTransaction.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    createTransactionMutation.mutate({
      transactionType: newTransaction.transactionType as any,
      amount: newTransaction.amount,
      description: newTransaction.description || undefined,
      transactionDate: newTransaction.transactionDate,
      assetId: newTransaction.assetId ? parseInt(newTransaction.assetId) : undefined,
      receiptNumber: newTransaction.receiptNumber || undefined,
    });
  };

  const handleStartEdit = (transaction: any) => {
    setEditingTransactionId(transaction.id);
    setEditData({
      transactionType: transaction.transactionType,
      amount: transaction.amount,
      description: transaction.description || "",
      transactionDate: transaction.transactionDate.split('T')[0],
      receiptNumber: transaction.receiptNumber || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editData.amount || parseFloat(editData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    updateTransactionMutation.mutate({
      id: editingTransactionId!,
      transactionType: editData.transactionType,
      amount: editData.amount,
      description: editData.description || undefined,
      transactionDate: editData.transactionDate,
      receiptNumber: editData.receiptNumber || undefined,
    });
  };

  const handleCancelEdit = () => {
    setEditingTransactionId(null);
    setEditData({});
  };

  const filteredTransactions = useMemo(() => {
    let rows = transactions ?? [];
    if (finType !== "all") {
      rows = rows.filter((t) => t.transactionType === finType);
    }
    const q = finSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((t) => {
        const hay = `${t.description ?? ""} ${t.receiptNumber ?? ""} ${String(t.transactionType)} ${t.amount}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [transactions, finSearch, finType]);

  const revenueTransactions = filteredTransactions.filter((t) => t.transactionType === "revenue");
  const expenseTransactions = filteredTransactions.filter((t) => t.transactionType !== "revenue");

  const totalRevenue = revenueTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  const canManageFinancial = user?.role === "admin" || user?.role === "manager";

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Financial Tracking</h1>
        <p className="mt-2 text-muted-foreground">Monitor revenue, costs, and expenses</p>
      </div>

      <ModuleFiltersCard
        filterRow={
          <>
            <ModuleFilterSearch
              placeholder="Search description, receipt, type..."
              value={finSearch}
              onChange={(e) => setFinSearch(e.target.value)}
            />
            <Select value={finType} onValueChange={setFinType}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="acquisition">Acquisition</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="disposal">Disposal</SelectItem>
                <SelectItem value="depreciation">Depreciation</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        toolbarEnd={
          canManageFinancial ? (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Financial Transaction</DialogTitle>
                <DialogDescription>Record a new revenue or expense transaction</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="transactionType">Transaction Type *</Label>
                  <Select 
                    value={newTransaction.transactionType} 
                    onValueChange={(value) => setNewTransaction({ ...newTransaction, transactionType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue (Income)</SelectItem>
                      <SelectItem value="acquisition">Acquisition (Purchase)</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="disposal">Disposal</SelectItem>
                      <SelectItem value="depreciation">Depreciation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₦) *</Label>
                    <Input 
                      id="amount" 
                      type="number" 
                      step="0.01"
                      value={newTransaction.amount} 
                      onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transactionDate">Date *</Label>
                    <Input 
                      id="transactionDate" 
                      type="date" 
                      value={newTransaction.transactionDate} 
                      onChange={(e) => setNewTransaction({ ...newTransaction, transactionDate: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input 
                    id="description" 
                    value={newTransaction.description} 
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })} 
                    placeholder="Enter transaction details"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiptNumber">Receipt/Invoice Number</Label>
                  <Input 
                    id="receiptNumber" 
                    value={newTransaction.receiptNumber} 
                    onChange={(e) => setNewTransaction({ ...newTransaction, receiptNumber: e.target.value })} 
                    placeholder="e.g., INV-2026-001"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTransaction} disabled={createTransactionMutation.isPending}>
                  {createTransactionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Transaction"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(KPI_VALUE_CLASS, "text-green-600")}>{formatNaira(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{revenueTransactions.length} transactions</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(KPI_VALUE_CLASS, "text-red-600")}>{formatNaira(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">{expenseTransactions.length} transactions</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${netProfit >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
            {netProfit >= 0 ? (
              <TrendingUp className="h-5 w-5 text-blue-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-orange-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn(KPI_VALUE_CLASS, netProfit >= 0 ? 'text-blue-600' : 'text-orange-600')}>
              {formatNaira(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {netProfit >= 0 ? 'Profit' : 'Loss'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
            Revenue Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueTransactions.length > 0 ? (
            <div className="space-y-3">
              {revenueTransactions.slice(0, 10).map((t) => (
                <div key={t.id} className="border-b pb-3 last:border-0">
                  {editingTransactionId === t.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Input 
                          type="number"
                          step="0.01"
                          value={editData.amount}
                          onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                          placeholder="Amount"
                        />
                        <Input 
                          type="date"
                          value={editData.transactionDate}
                          onChange={(e) => setEditData({ ...editData, transactionDate: e.target.value })}
                        />
                      </div>
                      <Input 
                        value={editData.description}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}><Save className="h-4 w-4 mr-1" />Save</Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}><X className="h-4 w-4 mr-1" />Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t.description || "Revenue"}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(t.transactionDate).toLocaleDateString()}
                          {t.receiptNumber && ` • ${t.receiptNumber}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold text-green-600">+{formatNaira(parseFloat(t.amount))}</p>
                          <p className="text-xs text-muted-foreground">{t.currency}</p>
                        </div>
                        {canManageFinancial && (
                          <Button size="sm" variant="ghost" onClick={() => handleStartEdit(t)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No revenue transactions found</p>
          )}
        </CardContent>
      </Card>

      {/* Expense Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
            Expense Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenseTransactions.length > 0 ? (
            <div className="space-y-3">
              {expenseTransactions.slice(0, 10).map((t) => (
                <div key={t.id} className="border-b pb-3 last:border-0">
                  {editingTransactionId === t.id ? (
                    <div className="space-y-3">
                      <Select 
                        value={editData.transactionType}
                        onValueChange={(value) => setEditData({ ...editData, transactionType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="acquisition">Acquisition</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="disposal">Disposal</SelectItem>
                          <SelectItem value="depreciation">Depreciation</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-2">
                        <Input 
                          type="number"
                          step="0.01"
                          value={editData.amount}
                          onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                          placeholder="Amount"
                        />
                        <Input 
                          type="date"
                          value={editData.transactionDate}
                          onChange={(e) => setEditData({ ...editData, transactionDate: e.target.value })}
                        />
                      </div>
                      <Input 
                        value={editData.description}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}><Save className="h-4 w-4 mr-1" />Save</Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}><X className="h-4 w-4 mr-1" />Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">{t.transactionType.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(t.transactionDate).toLocaleDateString()}
                          {t.description && ` • ${t.description}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold text-red-600">-{formatNaira(parseFloat(t.amount))}</p>
                          <p className="text-xs text-muted-foreground">{t.currency}</p>
                        </div>
                        {canManageFinancial && (
                          <Button size="sm" variant="ghost" onClick={() => handleStartEdit(t)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No expense transactions found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, Settings, Trash2, Edit2, ArrowDownLeft, ArrowUpRight, Link } from "lucide-react";
import { useDB, CashEntry } from "@/lib/database";

const CATS_IN = ["ATM Withdrawal","Cash Received","Salary Cash","Transfer from Account","Other"];
const CATS_OUT = ["Groceries","Food","Transport","Parking","Laundry","Personal","Entertainment","Utilities","Rent","Other"];

const EMPTY_FORM = { type:"out" as "in"|"out", date: new Date().toISOString().slice(0,10), description:"", amount:"", category:"Other", fromAccountId:"" };

export default function CashTracker() {
  const { cashEntries, cashOpeningBalance, addCashEntry, updateCashEntry, deleteCashEntry, setCashOpeningBalance, accounts, addTransaction , getAccountBalance} = useDB();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CashEntry|null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newBalance, setNewBalance] = useState(String(cashOpeningBalance));
  const [linkWithdrawal, setLinkWithdrawal] = useState(false);

  // Cash Wallet account
  const cashAccount = accounts.find(a => a.type === "cash");
  const cashWalletBalance = cashAccount ? getAccountBalance(cashAccount.id) : null;

  const openAdd = () => { setEditEntry(null); setForm(EMPTY_FORM); setLinkWithdrawal(false); setOpen(true); };
  const openEdit = (e: CashEntry) => { setEditEntry(e); setForm({ type:e.type, date:e.date, description:e.description, amount:String(Math.abs(e.amount)), category:e.category, fromAccountId:"" }); setOpen(true); };

  const handleSave = () => {
    const amt = parseFloat(form.amount);
    if (!form.description || isNaN(amt) || amt <= 0) return;
    const signedAmt = form.type === "out" ? -amt : amt;
    if (editEntry) {
      updateCashEntry(editEntry.id, { type:form.type, date:form.date, description:form.description, amount:signedAmt, category:form.category });
      // Also update the corresponding account transaction if cash wallet exists
      if (cashAccount) {
        addTransaction({ name: form.description, amount: signedAmt, type: form.type==="out"?"expense":"income", category: form.category, accountId: cashAccount.id, date: form.date, notes: "Cash Tracker sync" });
      }
    } else {
      addCashEntry({ type:form.type, date:form.date, description:form.description, amount:signedAmt, category:form.category, linkedAccountId: cashAccount?.id });
      // Always sync to Cash Wallet account if it exists
      if (cashAccount) {
        addTransaction({ name: form.description, amount: signedAmt, type: form.type==="out"?"expense":"income", category: form.category, accountId: cashAccount.id, date: form.date, notes: "Cash Tracker sync" });
      }
      // Additionally: if ATM withdrawal (inflow to cash tracker, deduct from bank)
      if (linkWithdrawal && form.fromAccountId && form.type === "in" && form.fromAccountId !== cashAccount?.id) {
        addTransaction({ name: `ATM Withdrawal - ${form.description}`, amount: -amt, type: "expense", category: "Cash", accountId: form.fromAccountId, date: form.date, notes: "ATM withdrawal linked to Cash Tracker" });
      }
    }
    setOpen(false);
  };

  // Running balance
  const sortedEntries = useMemo(() => [...cashEntries].sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime()), [cashEntries]);
  let running = cashOpeningBalance;
  const entriesWithBalance = sortedEntries.map(e => {
    running += e.amount;
    return { ...e, runningBalance: running };
  });
  const displayEntries = entriesWithBalance.reverse();

  const totalIn = cashEntries.filter(e=>e.type==="in").reduce((s,e)=>s+Math.abs(e.amount),0);
  const totalOut = cashEntries.filter(e=>e.type==="out").reduce((s,e)=>s+Math.abs(e.amount),0);
  const currentBalance = cashOpeningBalance + totalIn - totalOut;

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Tracker" subtitle="Track physical cash in & out"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={()=>{setNewBalance(String(cashOpeningBalance));setSettingsOpen(true);}}>
              <Settings className="w-4 h-4"/>Settings
            </Button>
            <Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>Add Entry</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Opening Balance" value={`AED ${cashOpeningBalance.toLocaleString()}`} icon={Wallet} />
        <StatCard title="Cash In" value={`AED ${totalIn.toLocaleString()}`} icon={ArrowDownLeft} changeType="up" />
        <StatCard title="Cash Out" value={`AED ${totalOut.toLocaleString()}`} icon={ArrowUpRight} changeType="down" />
        <StatCard title="Current Balance" value={`AED ${currentBalance.toLocaleString()}`} icon={Wallet} changeType={currentBalance>=0?"up":"down"} />
      </div>

      {cashAccount && (
        <div className="glass-card p-4 flex items-center gap-3">
          <Link className="w-4 h-4 text-primary shrink-0"/>
          <p className="text-sm text-muted-foreground">Cash Wallet account balance: <span className="font-semibold text-foreground">AED {(cashWalletBalance??0).toLocaleString()}</span> — When you add an ATM withdrawal, you can link it to deduct from your bank account.</p>
        </div>
      )}

      {/* Entries table */}
      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-secondary/30 border-b border-border text-xs font-medium text-muted-foreground">
          <span className="col-span-2">Date</span>
          <span className="col-span-3">Description</span>
          <span className="col-span-2">Category</span>
          <span className="col-span-2 text-right text-primary">In (+)</span>
          <span className="col-span-2 text-right">Out (-)</span>
          <span className="col-span-1 text-right">Balance</span>
        </div>
        <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
          {displayEntries.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No cash entries yet.</div>}
          <AnimatePresence>
            {displayEntries.map((e, i) => (
              <motion.div key={e.id} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{delay:i*0.02}}
                className="grid grid-cols-12 gap-3 px-5 py-3 text-xs hover:bg-secondary/20 group items-center">
                <span className="col-span-2 text-muted-foreground">{e.date}</span>
                <span className="col-span-3 text-foreground font-medium truncate">{e.description}</span>
                <span className="col-span-2"><Badge variant="outline" className="text-[10px]">{e.category}</Badge></span>
                <span className={`col-span-2 text-right font-medium ${e.type==="in"?"text-primary":""}`}>{e.type==="in"?`AED ${Math.abs(e.amount).toFixed(2)}`:"-"}</span>
                <span className="col-span-2 text-right font-medium">{e.type==="out"?`AED ${Math.abs(e.amount).toFixed(2)}`:"-"}</span>
                <span className="col-span-1 text-right font-semibold text-foreground">
                  <span className={e.runningBalance>=0?"":"text-destructive"}>{e.runningBalance.toFixed(0)}</span>
                </span>
                <div className="col-span-12 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1">
                  <button onClick={()=>openEdit(e as CashEntry)} className="text-muted-foreground hover:text-foreground p-0.5"><Edit2 className="w-3 h-3"/></button>
                  <button onClick={()=>deleteCashEntry(e.id)} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="w-3 h-3"/></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editEntry?"Edit":"Add"} Cash Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              {(["in","out"] as const).map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t,category:"Other"}))} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${form.type===t?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:bg-secondary"}`}>
                  {t==="in"?<ArrowDownLeft className="w-4 h-4"/>:<ArrowUpRight className="w-4 h-4"/>}
                  {t==="in"?"Cash In":"Cash Out"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Amount (AED)</Label><Input type="number" placeholder="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input placeholder="e.g. ATM Withdrawal from Mashreq" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v=>setForm(f=>({...f,category:v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                <SelectContent>{(form.type==="in"?CATS_IN:CATS_OUT).map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.type==="in" && !editEntry && (
              <div className="space-y-3 p-3 bg-secondary/40 rounded-xl">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="linkAcc" checked={linkWithdrawal} onChange={e=>setLinkWithdrawal(e.target.checked)} className="w-4 h-4"/>
                  <Label htmlFor="linkAcc" className="cursor-pointer">Link with bank account (deduct balance)</Label>
                </div>
                {linkWithdrawal && (
                  <Select value={form.fromAccountId} onValueChange={v=>setForm(f=>({...f,fromAccountId:v}))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select bank account…"/></SelectTrigger>
                    <SelectContent>{accounts.filter(a=>a.type!=="cash").map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.description||!form.amount}>{editEntry?"Save Changes":"Add Entry"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Cash Tracker Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Opening Balance (AED)</Label>
              <Input type="number" value={newBalance} onChange={e=>setNewBalance(e.target.value)} className="bg-background border-border"/>
              <p className="text-xs text-muted-foreground">Set the starting balance for your cash wallet.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={()=>{setCashOpeningBalance(parseFloat(newBalance)||0);setSettingsOpen(false);}}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Plus, Trash2, Edit2, Globe, Home, Settings, CreditCard, Pencil } from "lucide-react";
import { useDB, Transfer } from "@/lib/database";

const EMPTY_FORM = { fromAccountId:"", toAccountId:"", toCreditCardId:"", destType:"account" as "account"|"creditcard", amountSent:"", amountReceived:"", fxRate:"", fee:"0", date: new Date().toISOString().slice(0,10), notes:"", transferMode:"" };

export default function Transfers() {
  const { transfers, addTransfer, updateTransfer, deleteTransfer, accounts, creditCards, transferModes, addTransferMode, updateTransferMode, deleteTransferMode } = useDB();
  const [open, setOpen] = useState(false);
  const [editTransfer, setEditTransfer] = useState<Transfer|null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modesOpen, setModesOpen] = useState(false);
  const [newMode, setNewMode] = useState("");
  const [editMode, setEditMode] = useState<{old:string,val:string}|null>(null);
  const [filterMode, setFilterMode] = useState("all");

  const openAdd = () => { setEditTransfer(null); setForm({ ...EMPTY_FORM, fromAccountId:accounts[0]?.id||"", toAccountId:accounts[1]?.id||"" }); setOpen(true); };
  const openEdit = (t: Transfer) => {
    const isCC = !!t.toCreditCardId;
    setEditTransfer(t);
    setForm({ fromAccountId:t.fromAccountId, toAccountId:t.toAccountId||"", toCreditCardId:t.toCreditCardId||"", destType:isCC?"creditcard":"account", amountSent:String(t.amountSent), amountReceived:String(t.amountReceived), fxRate:String(t.fxRate||""), fee:String(t.fee), date:t.date, notes:t.notes||"", transferMode:t.transferMode||"" });
    setOpen(true);
  };

  const fromAcc = (id: string) => accounts.find(a=>a.id===id);

  const handleSave = () => {
    const sent = parseFloat(form.amountSent);
    if (!form.fromAccountId || !sent) return;
    if (form.destType==="account" && !form.toAccountId) return;
    if (form.destType==="creditcard" && !form.toCreditCardId) return;
    const from = fromAcc(form.fromAccountId);
    const to = form.destType==="account" ? fromAcc(form.toAccountId) : null;
    const data: Omit<Transfer,"id"> = {
      fromAccountId: form.fromAccountId,
      toAccountId: form.destType==="account" ? form.toAccountId : form.fromAccountId, // for CC keep same
      toCreditCardId: form.destType==="creditcard" ? form.toCreditCardId : undefined,
      amountSent: sent, amountReceived: parseFloat(form.amountReceived)||sent,
      currencyFrom: from?.currency||"AED", currencyTo: to?.currency||from?.currency||"AED",
      fxRate: parseFloat(form.fxRate)||undefined, fee: parseFloat(form.fee)||0,
      date: form.date, notes: form.notes||undefined, transferMode: form.transferMode||undefined,
    };
    if (editTransfer) updateTransfer(editTransfer.id, data);
    else addTransfer(data);
    setOpen(false);
  };

  const filtered = filterMode==="all" ? transfers : transfers.filter(t=>t.transferMode===filterMode);
  const totalTransferred = filtered.reduce((s,t)=>s+t.amountSent,0);
  const totalFees = filtered.reduce((s,t)=>s+t.fee,0);
  const intlCount = filtered.filter(t=>{const f=fromAcc(t.fromAccountId),to=fromAcc(t.toAccountId);return f&&to&&f.currency!==to.currency;}).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Transfers" subtitle={`${transfers.length} transfers`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 h-9" onClick={()=>setModesOpen(true)}><Settings className="w-3.5 h-3.5"/>Modes</Button>
            <Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>New Transfer</Button>
          </div>
        }/>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <button onClick={()=>setFilterMode("all")} className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterMode==="all"?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:text-foreground"}`}>All</button>
        {transferModes.map(m=>(
          <button key={m} onClick={()=>setFilterMode(m)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterMode===m?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:text-foreground"}`}>{m}</button>
        ))}
        <button onClick={()=>setFilterMode("_cc")} className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterMode==="_cc"?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:text-foreground"}`}>→ Credit Card</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard title="Total Transferred" value={`AED ${totalTransferred.toLocaleString()}`} icon={ArrowRightLeft}/>
        <StatCard title="Total Fees" value={`AED ${totalFees.toLocaleString()}`} icon={ArrowRightLeft} changeType="down"/>
        <StatCard title="International" value={`${intlCount} transfers`} icon={Globe}/>
      </div>

      <div className="space-y-3">
        {filtered.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No transfers found.</div>}
        <AnimatePresence>
          {(filterMode==="_cc" ? transfers.filter(t=>t.toCreditCardId) : filtered).map((t,i) => {
            const from = fromAcc(t.fromAccountId);
            const to = fromAcc(t.toAccountId);
            const isCC = !!t.toCreditCardId;
            const toCard = isCC ? creditCards.find(c=>c.id===t.toCreditCardId) : null;
            const intl = !isCC && from && to && from.currency !== to.currency;
            return (
              <motion.div key={t.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:i*0.04}} className="glass-card p-4 group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCC?"bg-purple-500/10":intl?"bg-primary/10":"bg-secondary"}`}>
                    {isCC?<CreditCard className="w-5 h-5 text-purple-400"/>:intl?<Globe className="w-5 h-5 text-primary"/>:<Home className="w-5 h-5 text-muted-foreground"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{from?.name||"Unknown"}</span>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground"/>
                      <span className="text-sm font-medium">{isCC?toCard?.name||"Card":to?.name||"Unknown"}</span>
                      {isCC && <Badge className="text-[10px] py-0 bg-purple-500/10 text-purple-400">CC Payment</Badge>}
                      {t.transferMode && <Badge variant="outline" className="text-[10px] py-0">{t.transferMode}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.date}{t.notes?` · ${t.notes}`:""}</p>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-sm font-semibold">{from?.currency||"AED"} {t.amountSent.toLocaleString()}</p>
                    {!isCC && t.amountSent !== t.amountReceived && <p className="text-xs text-muted-foreground">{to?.currency||"AED"} {t.amountReceived.toLocaleString()}</p>}
                    {t.fee>0 && <p className="text-[10px] text-destructive/70">Fee: {t.fee}</p>}
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>openEdit(t)} className="text-muted-foreground hover:text-foreground p-1.5"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>deleteTransfer(t.id)} className="text-muted-foreground hover:text-destructive p-1.5"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add/Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editTransfer?"Edit":"New"} Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>From Account</Label>
              <Select value={form.fromAccountId} onValueChange={v=>setForm(f=>({...f,fromAccountId:v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Destination Type</Label>
              <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                <button onClick={()=>setForm(f=>({...f,destType:"account"}))} className={`flex-1 py-2 flex items-center justify-center gap-1.5 ${form.destType==="account"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}><Home className="w-3 h-3"/>Bank Account</button>
                <button onClick={()=>setForm(f=>({...f,destType:"creditcard"}))} className={`flex-1 py-2 flex items-center justify-center gap-1.5 ${form.destType==="creditcard"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}><CreditCard className="w-3 h-3"/>Credit Card</button>
              </div>
            </div>
            {form.destType==="account" ? (
              <div className="space-y-1.5">
                <Label>To Account</Label>
                <Select value={form.toAccountId} onValueChange={v=>setForm(f=>({...f,toAccountId:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                  <SelectContent>{accounts.filter(a=>a.id!==form.fromAccountId).map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>To Credit Card (CC Repayment)</Label>
                <Select value={form.toCreditCardId} onValueChange={v=>setForm(f=>({...f,toCreditCardId:v}))}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select card"/></SelectTrigger>
                  <SelectContent>{creditCards.map(c=><SelectItem key={c.id} value={c.id}>{c.name} ···{c.last4}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount Sent</Label><Input type="number" value={form.amountSent} onChange={e=>setForm(f=>({...f,amountSent:e.target.value,amountReceived:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Amount Received</Label><Input type="number" value={form.amountReceived} onChange={e=>setForm(f=>({...f,amountReceived:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">FX Rate</Label><Input type="number" value={form.fxRate} onChange={e=>setForm(f=>({...f,fxRate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label className="text-xs">Fee (AED)</Label><Input type="number" value={form.fee} onChange={e=>setForm(f=>({...f,fee:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5">
              <Label>Transfer Mode</Label>
              <Select value={form.transferMode||"_none"} onValueChange={v=>setForm(f=>({...f,transferMode:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select mode (optional)"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">None</SelectItem>{transferModes.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="bg-background border-border"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editTransfer?"Save":"Add Transfer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Modes Manager */}
      <Dialog open={modesOpen} onOpenChange={setModesOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Manage Transfer Modes</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={newMode} onChange={e=>setNewMode(e.target.value)} placeholder="e.g. Wise, SWIFT" className="bg-background border-border flex-1"/>
              <Button size="sm" onClick={()=>{if(newMode.trim()){addTransferMode(newMode.trim());setNewMode("");}}}><Plus className="w-4 h-4"/></Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {transferModes.map(m=>(
                <div key={m} className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 group">
                  {editMode?.old===m ? (
                    <>
                      <Input value={editMode.val} onChange={e=>setEditMode({old:m,val:e.target.value})} className="bg-background border-border h-7 text-xs flex-1"/>
                      <button onClick={()=>{updateTransferMode(m,editMode.val);setEditMode(null);}} className="text-primary text-xs font-medium">Save</button>
                      <button onClick={()=>setEditMode(null)} className="text-muted-foreground text-xs">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{m}</span>
                      <button onClick={()=>setEditMode({old:m,val:m})} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>deleteTransferMode(m)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={()=>setModesOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

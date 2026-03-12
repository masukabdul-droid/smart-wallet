import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, AlertCircle, Upload, FileSpreadsheet, Import, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useDB } from "@/lib/database";
import { autoDetectAndParse, type ParsedTransaction } from "@/lib/xlsx-parsers";
import { useToast } from "@/hooks/use-toast";

const CAT_COLORS: Record<string, string> = {
  "Income":"bg-primary/20 text-primary","Groceries":"bg-green-500/20 text-green-400",
  "Food & Dining":"bg-orange-500/20 text-orange-400","Utilities":"bg-yellow-500/20 text-yellow-400",
  "Telecom":"bg-blue-500/20 text-blue-400","Transport":"bg-purple-500/20 text-purple-400",
  "Shopping":"bg-pink-500/20 text-pink-400","Health":"bg-red-500/20 text-red-400",
  "Government":"bg-gray-500/20 text-gray-400","Education":"bg-cyan-500/20 text-cyan-400",
  "Housing":"bg-emerald-500/20 text-emerald-400","Transfers":"bg-indigo-500/20 text-indigo-400",
  "Cash":"bg-amber-500/20 text-amber-400","Credit Card Payment":"bg-rose-500/20 text-rose-400",
  "Interest/Returns":"bg-teal-500/20 text-teal-400","Other":"bg-secondary text-muted-foreground",
};
const ALL_CATS = Object.keys(CAT_COLORS);

async function readXlsxRows(file: File): Promise<unknown[][]> {
  // Dynamic import to avoid build issues - use CDN fallback
  try {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type:"array", cellDates:true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    const rows: unknown[][] = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row: unknown[] = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({r:R,c:C});
        const cell = ws[addr];
        if (!cell) { row.push(null); continue; }
        if (cell.t==="d" && cell.v instanceof Date) { row.push(cell.v); continue; }
        if (cell.t==="n") { row.push(cell.v); continue; }
        row.push(cell.v ?? null);
      }
      rows.push(row);
    }
    return rows;
  } catch {
    throw new Error("Could not read XLSX file. Make sure you ran npm install after updating package.json.");
  }
}

export default function StatementImport() {
  const { addTransaction, batchAddTransactions, accounts } = useDB();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState<{name:string;size:string}|null>(null);
  const [parseResult, setParseResult] = useState<{transactions:ParsedTransaction[];bankName:string;accountType:string;currency:string;error?:string}|null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [targetAccountId, setTargetAccountId] = useState(accounts[0]?.id??"");
  const [imported, setImported] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editCats, setEditCats] = useState<Record<number,string>>({});

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title:"Invalid file type", description:"Please upload an .xlsx file", variant:"destructive" }); return;
    }
    setLoading(true); setImported(false); setParseResult(null);
    setFileInfo({ name:file.name, size:`${(file.size/1024).toFixed(1)} KB` });
    try {
      const rows = await readXlsxRows(file);
      const result = autoDetectAndParse(rows);
      setParseResult(result);
      setSelectedIds(new Set(result.transactions.map((_,i)=>i)));
      setEditCats({});
      toast({ title:`✓ ${result.bankName}`, description:`${result.transactions.length} transactions parsed` });
    } catch(e:any) {
      setParseResult({ transactions:[], bankName:"Error", accountType:"", currency:"AED", error:e.message });
      toast({ title:"Parse error", description:e.message, variant:"destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if(e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if(e.target.files?.[0]) processFile(e.target.files[0]); };
  const toggleSelect = (i:number) => { const s=new Set(selectedIds); s.has(i)?s.delete(i):s.add(i); setSelectedIds(s); };
  const toggleAll = () => selectedIds.size===txns.length?setSelectedIds(new Set()):setSelectedIds(new Set(txns.map((_,i)=>i)));

  const handleImport = () => {
    if (!targetAccountId) { toast({ title:"Select an account first", variant:"destructive" }); return; }
    const toImport = txns
      .filter((_,i) => selectedIds.has(i))
      .map((tx,idx) => ({
        name: tx.description.slice(0,80),
        amount: tx.amount,
        type: tx.type as "income"|"expense",
        category: editCats[txns.indexOf(tx)] || editCats[idx] || tx.category || "Other",
        accountId: targetAccountId,
        date: tx.date,
        notes: tx.extra || "",
      }));
    // Build proper list with correct index-based categories
    const finalList = txns
      .map((tx,i) => ({ tx, i }))
      .filter(({i}) => selectedIds.has(i))
      .map(({tx,i}) => ({
        name: tx.description.slice(0,80),
        amount: tx.amount,
        type: tx.type as "income"|"expense",
        category: editCats[i] || tx.category || "Other",
        accountId: targetAccountId,
        date: tx.date,
        notes: tx.extra || "",
      }));
    batchAddTransactions(finalList);
    const acct = accounts.find(a=>a.id===targetAccountId);
    const totalIn = finalList.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const totalOut = finalList.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    setImported(true);
    toast({ title:`✓ Imported ${finalList.length} transactions to ${acct?.name}`, description:`+${acct?.currency} ${totalIn.toFixed(0)} in / -${acct?.currency} ${totalOut.toFixed(0)} out` });
    setParseResult(null); setFileInfo(null); setSelectedIds(new Set());
  };

  const txns = parseResult?.transactions??[];
  const displayed = showAll ? txns : txns.slice(0,30);

  return (
    <div className="space-y-6">
      <PageHeader title="Statement Import" subtitle="Drag & drop your bank XLSX statements for automatic parsing" />

      {/* Supported banks */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{bank:"Sonali Bank",icon:"🇧🇩",col:"border-green-500/30 bg-green-500/5"},{bank:"LIV / Emirates NBD",icon:"🇦🇪",col:"border-blue-500/30 bg-blue-500/5"},{bank:"LIV Credit Card",icon:"💳",col:"border-violet-500/30 bg-violet-500/5"},{bank:"TapTap Send",icon:"💸",col:"border-orange-500/30 bg-orange-500/5"},{bank:"Islami Bank BD",icon:"🇧🇩",col:"border-teal-500/30 bg-teal-500/5"}].map(f=>(
          <div key={f.bank} className={`glass-card p-3 border ${f.col} text-center`}>
            <div className="text-2xl mb-1">{f.icon}</div>
            <p className="text-xs font-medium text-foreground">{f.bank}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Auto-detected</p>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
        onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={onDrop}
        onClick={()=>fileRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 text-center ${dragging?"border-primary bg-primary/5 scale-[1.01]":"border-border hover:border-primary/50 hover:bg-secondary/30"}`}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange}/>
        {loading?<div className="flex flex-col items-center gap-3"><Loader2 className="w-10 h-10 text-primary animate-spin"/><p className="text-sm text-muted-foreground">Parsing…</p></div>
        :fileInfo?<div className="flex flex-col items-center gap-2"><FileSpreadsheet className="w-10 h-10 text-primary"/><p className="text-sm font-medium">{fileInfo.name}</p><p className="text-xs text-muted-foreground">{fileInfo.size}</p></div>
        :<div className="flex flex-col items-center gap-3"><Upload className="w-10 h-10 text-muted-foreground"/><div><p className="text-base font-medium text-foreground">Drop your bank statement here</p><p className="text-sm text-muted-foreground mt-1">or click to browse — .xlsx only</p></div></div>}
      </motion.div>

      {/* Parse info bar */}
      {parseResult&&!parseResult.error&&(
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="glass-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 flex-wrap text-xs">
              <div><p className="text-muted-foreground">Bank</p><p className="font-semibold text-foreground">{parseResult.bankName}</p></div>
              <div><p className="text-muted-foreground">Type</p><p className="font-semibold text-foreground">{parseResult.accountType}</p></div>
              <div><p className="text-muted-foreground">Currency</p><Badge variant="secondary">{parseResult.currency}</Badge></div>
              <div><p className="text-muted-foreground">Found</p><p className="font-semibold text-primary">{txns.length} transactions</p></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Import to Account</Label>
              <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                <SelectTrigger className="w-[200px] bg-background border-border h-8 text-xs"><SelectValue placeholder="Select account"/></SelectTrigger>
                <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>
      )}

      {/* Transaction review */}
      {parseResult&&!parseResult.error&&txns.length>0&&(
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <button onClick={toggleAll} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.size===txns.length?"bg-primary border-primary":"border-border"}`}>
                {selectedIds.size===txns.length&&<Check className="w-3 h-3 text-white"/>}
              </button>
              <span className="text-sm font-medium">{selectedIds.size} / {txns.length} selected</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={toggleAll}>{selectedIds.size===txns.length?"Deselect All":"Select All"}</Button>
              <Button size="sm" className="gap-2" onClick={handleImport} disabled={selectedIds.size===0}><Import className="w-3.5 h-3.5"/>Import {selectedIds.size}</Button>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground bg-secondary/20">
            <span className="col-span-1"/><span className="col-span-2">Date</span><span className="col-span-4">Description</span><span className="col-span-2">Category</span><span className="col-span-2 text-right">Amount</span><span className="col-span-1 text-right">Type</span>
          </div>
          <div className="divide-y divide-border">
            {displayed.map((tx,i)=>{
              const sel=selectedIds.has(i); const cat=editCats[i]||tx.category||"Other";
              return (
                <div key={i} onClick={()=>toggleSelect(i)} className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center cursor-pointer transition-colors hover:bg-secondary/20 ${sel?"":"opacity-40"}`}>
                  <span className="col-span-1"><div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${sel?"bg-primary border-primary":"border-border"}`}>{sel&&<Check className="w-2.5 h-2.5 text-white"/>}</div></span>
                  <span className="col-span-2 text-xs text-muted-foreground">{tx.date}</span>
                  <span className="col-span-4 text-xs text-foreground truncate" title={tx.description}>{tx.description}</span>
                  <span className="col-span-2" onClick={e=>e.stopPropagation()}>
                    <select value={cat} onChange={e=>setEditCats(p=>({...p,[i]:e.target.value}))} className="w-full text-[10px] bg-secondary border-0 rounded px-1 py-0.5 text-foreground cursor-pointer">
                      {ALL_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </span>
                  <span className={`col-span-2 text-xs font-semibold text-right ${tx.amount>=0?"text-primary":"text-foreground"}`}>{tx.amount>=0?"+":""}{tx.currency} {Math.abs(tx.amount).toFixed(2)}</span>
                  <span className="col-span-1 flex justify-end"><Badge className={`text-[9px] px-1 py-0 ${CAT_COLORS[cat]||CAT_COLORS.Other}`}>{tx.type}</Badge></span>
                </div>
              );
            })}
          </div>
          {txns.length>30&&(
            <div className="p-3 text-center border-t border-border">
              <button onClick={()=>setShowAll(!showAll)} className="flex items-center gap-1 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showAll?<><ChevronUp className="w-4 h-4"/>Show less</>:<><ChevronDown className="w-4 h-4"/>Show all {txns.length} transactions</>}
              </button>
            </div>
          )}
          <div className="p-4 border-t border-border flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              Income: <span className="text-primary font-medium">{parseResult.currency} {txns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0).toFixed(2)}</span>
              {" · "}Expenses: <span className="text-foreground font-medium">{parseResult.currency} {Math.abs(txns.filter(t=>t.amount<0).reduce((s,t)=>s+t.amount,0)).toFixed(2)}</span>
            </div>
            <Button className="gap-2" onClick={handleImport} disabled={selectedIds.size===0}><Import className="w-4 h-4"/>Import {selectedIds.size} Transactions</Button>
          </div>
        </motion.div>
      )}

      {parseResult?.error&&<div className="glass-card p-5 flex items-center gap-3 border border-destructive/30"><AlertCircle className="w-5 h-5 text-destructive"/><p className="text-sm text-destructive">{parseResult.error}</p></div>}

      {imported&&(
        <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"><Check className="w-8 h-8 text-primary"/></div>
          <p className="text-lg font-display font-bold text-foreground">Import Complete!</p>
          <p className="text-sm text-muted-foreground mt-1">Transactions added to your account. Drop another file to continue.</p>
          <Button variant="outline" className="mt-4" onClick={()=>setImported(false)}>Import Another File</Button>
        </motion.div>
      )}
    </div>
  );
}

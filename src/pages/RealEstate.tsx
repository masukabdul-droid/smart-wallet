import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, TrendingUp, DollarSign, Percent, MapPin, Trash2, Edit2, Wrench, ArrowRight, ChevronDown, ChevronUp, Settings, Pencil } from "lucide-react";
import { useDB, Property, saveToTrash } from "@/lib/database";


const PROP_TYPES = ["Residential","Commercial","Industrial","Land","Mixed Use"];
const PROP_STATUS = [
  { value:"owned",      label:"Owned (Vacant)",  icon:"🏠" },
  { value:"rented_out", label:"Rented Out",       icon:"🔑" },
  { value:"leased",     label:"Leased",           icon:"📄" },
  { value:"sold",       label:"Sold",             icon:"💰" },
  { value:"vacant",     label:"Vacant / For Sale",icon:"🏗️" },
  { value:"closed",     label:"Closed / Sold",       icon:"✅" },
];
const COST_CATS = ["maintenance","government","transaction","insurance","other"];
const COLORS = ["hsl(160,84%,39%)","hsl(200,80%,50%)","hsl(280,70%,60%)","hsl(40,90%,55%)","hsl(330,70%,55%)"];
const CURRENCIES = ["AED","BDT","USD","EUR","GBP"];

const EMPTY_FORM: any = { platform:"_none", name:"", location:"", invested:"", currentValue:"", roi:"", monthlyRental:"", occupancy:"95", type:"Residential", color:COLORS[0], currency:"AED", purchaseDate:"", status:"owned", rentalStartDate:"", saleDate:"", salePrice:"", govFees:"", transactionFees:"", notes:"", rentalAccountId:"" };

export default function RealEstate() {
  const { properties, accounts, creditCards, addProperty, updateProperty, deleteProperty, addRentalEntry, addPropertyCost, transferRentalToAccount, getAccountBalance, realEstatePlatforms, addRealEstatePlatform, updateRealEstatePlatform, deleteRealEstatePlatform } = useDB();
  const [platMgrOpen, setPlatMgrOpen] = useState(false);
  const [newPlat, setNewPlat] = useState("");
  const [editPlat, setEditPlat] = useState<{old:string,val:string}|null>(null);
  const [propTabs, setPropTabs] = useState<Record<string,"rental"|"costs">>({});
  const [expanded, setExpanded] = useState<string|null>(null);

  // Add/Edit property
  const [propOpen, setPropOpen] = useState(false);
  const [editProp, setEditProp] = useState<Property|null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  // Rental income
  const [rentalPropId, setRentalPropId] = useState<string|null>(null);
  const [rentalForm, setRentalForm] = useState({ date:new Date().toISOString().slice(0,10), amount:"", note:"Monthly rental income", transferToAccountId:"" });

  // Cost
  const [costPropId, setCostPropId] = useState<string|null>(null);
  const [costForm, setCostForm] = useState({ date:new Date().toISOString().slice(0,10), amount:"", category:"maintenance" as any, description:"" });

  // Transfer balance
  const [transferPropId, setTransferPropId] = useState<string|null>(null);
  const [transferForm, setTransferForm] = useState({ accountId:"", amount:"", date:new Date().toISOString().slice(0,10) });

  const totalInvested = properties.reduce((s,p)=>s+p.invested,0);
  const totalValue = properties.reduce((s,p)=>s+p.currentValue,0);
  const totalMonthlyRent = properties.filter(p=>["rented_out","leased"].includes(p.status||"")).reduce((s,p)=>s+p.monthlyRental,0);
  const avgROI = properties.length>0 ? (properties.reduce((s,p)=>s+p.roi,0)/properties.length).toFixed(1) : "0";

  const getTab = (id:string) => propTabs[id]||"rental";
  const setTab = (id:string, tab:"rental"|"costs") => setPropTabs(p=>({...p,[id]:tab}));

  const openAdd = () => { setEditProp(null); setForm(EMPTY_FORM); setPropOpen(true); };
  const openEdit = (p: Property) => {
    setEditProp(p);
    setForm({ platform:p.platform||"_none", name:p.name, location:p.location, invested:String(p.invested), currentValue:String(p.currentValue), roi:String(p.roi), monthlyRental:String(p.monthlyRental), occupancy:String(p.occupancy), type:p.type, color:p.color, currency:p.currency, purchaseDate:p.purchaseDate||"", status:(p.status||"owned") as any, rentalStartDate:p.rentalStartDate||"", saleDate:p.saleDate||"", salePrice:String(p.salePrice||""), govFees:String(p.govFees||""), transactionFees:String(p.transactionFees||""), notes:p.notes||"", rentalAccountId:p.rentalAccountId||"" });
    setPropOpen(true);
  };
  const handleSubmit = () => {
    if (!form.name) return;
    const data: Omit<Property,"id"|"rentalHistory"|"maintenanceCosts"> = { platform:form.platform==="_none"?"":form.platform, name:form.name, location:form.location, invested:parseFloat(form.invested)||0, currentValue:parseFloat(form.currentValue)||0, roi:parseFloat(form.roi)||0, monthlyRental:parseFloat(form.monthlyRental)||0, occupancy:parseFloat(form.occupancy)||0, type:form.type, color:form.color, currency:form.currency, purchaseDate:form.purchaseDate, status:form.status, rentalStartDate:form.rentalStartDate||undefined, saleDate:form.saleDate||undefined, salePrice:form.salePrice?parseFloat(form.salePrice):undefined, govFees:form.govFees?parseFloat(form.govFees):undefined, transactionFees:form.transactionFees?parseFloat(form.transactionFees):undefined, notes:form.notes, rentalAccountId:form.rentalAccountId||undefined, rentalPendingBalance:editProp?.rentalPendingBalance||0 };
    if (editProp) updateProperty(editProp.id, data);
    else addProperty(data);
    setPropOpen(false); setEditProp(null);
  };

  const openRental = (propId: string) => {
    const prop = properties.find(p=>p.id===propId);
    setRentalPropId(propId);
    setRentalForm({ date:new Date().toISOString().slice(0,10), amount:String(prop?.monthlyRental||""), note:"Monthly rental income", transferToAccountId:prop?.rentalAccountId||"" });
  };
  const handleAddRental = () => {
    if (!rentalPropId||!rentalForm.amount) return;
    addRentalEntry(rentalPropId, { date:rentalForm.date, amount:parseFloat(rentalForm.amount), note:rentalForm.note, transferredToAccountId:rentalForm.transferToAccountId||undefined });
    // If auto-transfer to account, do it now
    if (rentalForm.transferToAccountId) {
      transferRentalToAccount(rentalPropId, rentalForm.transferToAccountId, parseFloat(rentalForm.amount), rentalForm.date);
    }
    setRentalPropId(null);
  };

  const openCost = (propId: string) => { setCostPropId(propId); setCostForm({ date:new Date().toISOString().slice(0,10), amount:"", category:"maintenance", description:"" }); };
  const handleAddCost = () => {
    if (!costPropId||!costForm.amount) return;
    addPropertyCost(costPropId, { date:costForm.date, amount:parseFloat(costForm.amount), category:costForm.category, description:costForm.description });
    setCostPropId(null);
  };

  const openTransfer = (propId: string) => {
    const prop = properties.find(p=>p.id===propId);
    setTransferPropId(propId);
    setTransferForm({ accountId:prop?.rentalAccountId||"", amount:String(prop?.rentalPendingBalance||""), date:new Date().toISOString().slice(0,10) });
  };
  const handleTransfer = () => {
    const amt = parseFloat(transferForm.amount);
    if (!transferPropId||!amt||!transferForm.accountId) return;
    transferRentalToAccount(transferPropId, transferForm.accountId, amt, transferForm.date);
    setTransferPropId(null);
  };

  const handleDelete = (p: Property) => {
    saveToTrash({ id:`trash_${Date.now()}`, type:"property", label:p.name, detail:`${p.platform} · ${p.location} · ${p.currency} ${p.invested.toLocaleString()}`, deletedAt:new Date().toISOString(), data:p });
    deleteProperty(p.id);
  };

  const yearsOwned = (d: string) => {
    if (!d) return "";
    const diff = (Date.now()-new Date(d).getTime())/(1000*60*60*24*365);
    return diff<1?`${Math.floor(diff*12)}mo`:`${diff.toFixed(1)}yr`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Real Estate" subtitle="Properties & rental income"
        action={<div className="flex gap-2"><Button variant="outline" className="gap-2 h-9" onClick={()=>setPlatMgrOpen(true)}><Settings className="w-3.5 h-3.5"/>Platforms</Button><Button className="gap-2" onClick={openAdd}><Plus className="w-4 h-4"/>Add Property</Button></div>}/>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Invested" value={`AED ${totalInvested.toLocaleString()}`} icon={Building2}/>
        <StatCard title="Current Value" value={`AED ${totalValue.toLocaleString()}`} icon={TrendingUp} change={totalInvested>0?`+${((totalValue-totalInvested)/totalInvested*100).toFixed(1)}%`:"0%"} changeType="up"/>
        <StatCard title="Monthly Rental" value={`AED ${totalMonthlyRent}`} icon={DollarSign}/>
        <StatCard title="Avg ROI" value={`${avgROI}%`} icon={Percent} changeType="up"/>
      </div>

      {properties.length===0 && <div className="p-8 text-center text-muted-foreground glass-card text-sm">No properties added.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {properties.map((prop,i)=>{
          const statusInfo = PROP_STATUS.find(s=>s.value===(prop.status||"owned"));
          const totalCosts = (prop.maintenanceCosts||[]).reduce((s,c)=>s+c.amount,0);
          const totalRent = prop.rentalHistory.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0);
          const pending = prop.rentalPendingBalance||0;
          const tab = getTab(prop.id);
          const isExp = expanded===prop.id;

          return (
            <motion.div key={prop.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}} className="glass-card overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">{prop.platform}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">{statusInfo?.icon} {statusInfo?.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pending>0 && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openTransfer(prop.id)}><ArrowRight className="w-3 h-3"/>AED {pending.toLocaleString()}</Button>}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openCost(prop.id)}><Wrench className="w-3 h-3"/>Cost</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={()=>openRental(prop.id)}><Plus className="w-3 h-3"/>Rent</Button>
                    <button onClick={()=>openEdit(prop)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>handleDelete(prop)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                <h3 className="font-display font-semibold text-foreground">{prop.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{prop.location}</span>
                  {prop.purchaseDate && <span>Owned {yearsOwned(prop.purchaseDate)}</span>}
                </div>
              </div>

              {/* Stats grid */}
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-border">
                <div><p className="text-[10px] text-muted-foreground">Invested</p><p className="text-sm font-semibold">{prop.currency} {prop.invested.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Value</p><p className="text-sm font-semibold text-primary">{prop.currency} {prop.currentValue.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-muted-foreground">ROI</p><p className="text-sm font-semibold stat-up">{prop.roi}%</p></div>
                <div><p className="text-[10px] text-muted-foreground">Monthly Rent</p><p className="text-sm font-semibold">{prop.currency} {prop.monthlyRental}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Total Received</p><p className="text-sm font-semibold stat-up">{prop.currency} {totalRent.toLocaleString()}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Total Costs</p><p className="text-sm font-semibold stat-down">{prop.currency} {totalCosts.toLocaleString()}</p></div>
              </div>

              {/* Extra info */}
              {(prop.rentalStartDate||prop.govFees||prop.transactionFees||prop.notes) && (
                <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground flex flex-wrap gap-3">
                  {prop.rentalStartDate && <span>🗓️ Rent from {prop.rentalStartDate}</span>}
                  {prop.govFees && <span>🏛️ Govt fees: {prop.currency} {prop.govFees.toLocaleString()}</span>}
                  {prop.transactionFees && <span>📄 Tx fees: {prop.currency} {prop.transactionFees.toLocaleString()}</span>}
                  {prop.status==="sold" && prop.salePrice && <span>💰 Sold: {prop.currency} {prop.salePrice.toLocaleString()}</span>}
                </div>
              )}

              {/* Occupancy */}
              <div className="px-4 py-2 border-b border-border">
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Occupancy</span><span>{prop.occupancy}%</span></div>
                <div className="w-full bg-secondary rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${prop.occupancy}%`,backgroundColor:prop.color}}/></div>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 px-4 pt-3">
                {(["rental","costs"] as const).map(t=>(
                  <button key={t} onClick={()=>setTab(prop.id,t)} className={`px-3 py-1 rounded-md text-xs transition-colors capitalize ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>
                    {t==="rental"?`Rental (${prop.rentalHistory.filter(r=>r.amount>0).length})`:`Costs (${(prop.maintenanceCosts||[]).length})`}
                  </button>
                ))}
              </div>

              {/* Expand toggle */}
              <button onClick={()=>setExpanded(isExp?null:prop.id)} className="w-full flex items-center justify-center py-2 text-xs text-muted-foreground hover:text-foreground">
                {isExp?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
              </button>

              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                    <div className="px-4 pb-4">
                      {tab==="rental" && (
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {prop.rentalHistory.filter(r=>r.amount>0).length===0 && <p className="text-xs text-center text-muted-foreground py-2">No rental income recorded.</p>}
                          {prop.rentalHistory.filter(r=>r.amount>0).slice().reverse().map(r=>(
                            <div key={r.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                              <div><p className="font-medium text-foreground">{r.note||"Rental income"}</p>{r.transferredToAccountId&&<p className="text-[10px] text-primary">→ {accounts.find(a=>a.id===r.transferredToAccountId)?.name}</p>}</div>
                              <div className="text-right"><p className="font-semibold stat-up">+{prop.currency} {r.amount.toLocaleString()}</p><p className="text-muted-foreground">{r.date}</p></div>
                            </div>
                          ))}
                        </div>
                      )}
                      {tab==="costs" && (
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {(prop.maintenanceCosts||[]).length===0 && <p className="text-xs text-center text-muted-foreground py-2">No costs recorded.</p>}
                          {(prop.maintenanceCosts||[]).slice().reverse().map(c=>(
                            <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                              <div><p className="font-medium text-foreground">{c.description}</p><p className="text-muted-foreground capitalize">{c.category}</p></div>
                              <div className="text-right"><p className="font-semibold stat-down">-{prop.currency} {c.amount.toLocaleString()}</p><p className="text-muted-foreground">{c.date}</p></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Add/Edit Property */}
      <Dialog open={propOpen} onOpenChange={setPropOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editProp?"Edit":"Add"} Property</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Property Name</Label><Input placeholder="e.g. Al Warqa Villa" value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Location</Label><Input placeholder="e.g. Dubai, UAE" value={form.location} onChange={e=>setForm((f:any)=>({...f,location:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Platform</Label>
                <Select value={form.platform||"_none"} onValueChange={v=>setForm((f:any)=>({...f,platform:v==="_none"?"":v}))}><SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select platform"/></SelectTrigger><SelectContent><SelectItem value="_none">None</SelectItem>{realEstatePlatforms.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={form.type} onValueChange={v=>setForm((f:any)=>({...f,type:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{PROP_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Currency</Label>
                <Select value={form.currency} onValueChange={v=>setForm((f:any)=>({...f,currency:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={v=>setForm((f:any)=>({...f,status:v}))}><SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger><SelectContent>{PROP_STATUS.map(s=><SelectItem key={s.value} value={s.value}>{s.icon} {s.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount Invested</Label><Input type="number" value={form.invested} onChange={e=>setForm((f:any)=>({...f,invested:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Current Value</Label><Input type="number" value={form.currentValue} onChange={e=>setForm((f:any)=>({...f,currentValue:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Monthly Rental</Label><Input type="number" value={form.monthlyRental} onChange={e=>setForm((f:any)=>({...f,monthlyRental:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>ROI %</Label><Input type="number" value={form.roi} onChange={e=>setForm((f:any)=>({...f,roi:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Occupancy %</Label><Input type="number" value={form.occupancy} onChange={e=>setForm((f:any)=>({...f,occupancy:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Purchase Date</Label><Input type="date" value={form.purchaseDate} onChange={e=>setForm((f:any)=>({...f,purchaseDate:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Rent Start Date</Label><Input type="date" value={form.rentalStartDate} onChange={e=>setForm((f:any)=>({...f,rentalStartDate:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            {form.status==="sold" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Sale Date</Label><Input type="date" value={form.saleDate} onChange={e=>setForm((f:any)=>({...f,saleDate:e.target.value}))} className="bg-background border-border"/></div>
                <div className="space-y-1.5"><Label>Sale Price</Label><Input type="number" value={form.salePrice} onChange={e=>setForm((f:any)=>({...f,salePrice:e.target.value}))} className="bg-background border-border"/></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Govt Fees</Label><Input type="number" value={form.govFees} onChange={e=>setForm((f:any)=>({...f,govFees:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Transaction Fees</Label><Input type="number" value={form.transactionFees} onChange={e=>setForm((f:any)=>({...f,transactionFees:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Auto-receive rent to account</Label>
              <Select value={form.rentalAccountId||"_none"} onValueChange={v=>setForm((f:any)=>({...f,rentalAccountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Hold balance in property"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Hold balance in property</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Color</Label>
              <div className="flex gap-2">{COLORS.map(c=><button key={c} onClick={()=>setForm((f:any)=>({...f,color:c}))} className="w-7 h-7 rounded-full border-2" style={{backgroundColor:c,borderColor:form.color===c?"white":"transparent"}}/>)}</div>
            </div>
            {form.notes!==undefined && <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm((f:any)=>({...f,notes:e.target.value}))} rows={2} className="bg-background border-border"/></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setPropOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name}>{editProp?"Save Changes":"Add Property"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Rental Income */}
      <Dialog open={!!rentalPropId} onOpenChange={()=>setRentalPropId(null)}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Record Rental Income</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount ({properties.find(p=>p.id===rentalPropId)?.currency||"AED"})</Label><Input type="number" value={rentalForm.amount} onChange={e=>setRentalForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={rentalForm.date} onChange={e=>setRentalForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>Note</Label><Input value={rentalForm.note} onChange={e=>setRentalForm(f=>({...f,note:e.target.value}))} className="bg-background border-border"/></div>
            <div className="space-y-1.5"><Label>Transfer to Account (optional)</Label>
              <Select value={rentalForm.transferToAccountId||"_none"} onValueChange={v=>setRentalForm(f=>({...f,transferToAccountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Hold in property"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Hold in property</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {rentalForm.transferToAccountId && <div className="p-2 bg-primary/10 rounded-lg text-xs text-primary">Rental income will be credited to {accounts.find(a=>a.id===rentalForm.transferToAccountId)?.name}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setRentalPropId(null)}>Cancel</Button>
            <Button onClick={handleAddRental} disabled={!rentalForm.amount}>Record Income</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Cost */}
      <Dialog open={!!costPropId} onOpenChange={()=>setCostPropId(null)}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Record Property Cost</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={costForm.category} onValueChange={v=>setCostForm(f=>({...f,category:v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue/></SelectTrigger>
                <SelectContent>{COST_CATS.map(c=><SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={costForm.description} onChange={e=>setCostForm(f=>({...f,description:e.target.value}))} placeholder="e.g. AC repair" className="bg-background border-border"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={costForm.amount} onChange={e=>setCostForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={costForm.date} onChange={e=>setCostForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setCostPropId(null)}>Cancel</Button>
            <Button onClick={handleAddCost} disabled={!costForm.amount}>Record Cost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Balance */}
      <Dialog open={!!transferPropId} onOpenChange={()=>setTransferPropId(null)}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Transfer Rental Balance to Account</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-2 bg-secondary/50 rounded-lg text-xs text-muted-foreground">
              Available balance: {properties.find(p=>p.id===transferPropId)?.currency||"AED"} {(properties.find(p=>p.id===transferPropId)?.rentalPendingBalance||0).toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={transferForm.amount} onChange={e=>setTransferForm(f=>({...f,amount:e.target.value}))} className="bg-background border-border"/></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={transferForm.date} onChange={e=>setTransferForm(f=>({...f,date:e.target.value}))} className="bg-background border-border"/></div>
            </div>
            <div className="space-y-1.5"><Label>To Account</Label>
              <Select value={transferForm.accountId||"_none"} onValueChange={v=>setTransferForm(f=>({...f,accountId:v==="_none"?"":v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select account"/></SelectTrigger>
                <SelectContent><SelectItem value="_none">Select account</SelectItem>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} — {a.currency} {getAccountBalance(a.id).toLocaleString()} avail.</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setTransferPropId(null)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferForm.amount||!transferForm.accountId}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Platform Manager */}
      <Dialog open={platMgrOpen} onOpenChange={setPlatMgrOpen}>
        <DialogContent className="w-full sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Manage Platforms</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={newPlat} onChange={e=>setNewPlat(e.target.value)} placeholder="Platform name" className="bg-background border-border flex-1"/>
              <Button size="sm" onClick={()=>{if(newPlat.trim()){addRealEstatePlatform(newPlat.trim());setNewPlat("");}}}><Plus className="w-4 h-4"/></Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {realEstatePlatforms.map(p=>(
                <div key={p} className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 group">
                  {editPlat?.old===p ? (
                    <>
                      <Input value={editPlat.val} onChange={e=>setEditPlat({old:p,val:e.target.value})} className="bg-background border-border h-7 text-xs flex-1"/>
                      <button onClick={()=>{updateRealEstatePlatform(p,editPlat.val);setEditPlat(null);}} className="text-primary text-xs font-medium">Save</button>
                      <button onClick={()=>setEditPlat(null)} className="text-muted-foreground text-xs">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{p}</span>
                      <button onClick={()=>setEditPlat({old:p,val:p})} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>deleteRealEstatePlatform(p)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={()=>setPlatMgrOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
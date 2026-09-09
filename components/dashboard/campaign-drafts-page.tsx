"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Edit3, MessageCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ActionDialog } from "@/components/ui/action-feedback";

type Draft = { id: string; title: string; body: string; audience: string; updatedAt: string };

async function readDrafts(signal?: AbortSignal): Promise<{ drafts: Draft[]; eligibleCustomers: number }> {
  const response = await fetch("/api/dashboard/campaigns", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Could not load campaign drafts. Please try again.");
  return response.json();
}

export function CampaignDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [eligible, setEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [removing, setRemoving] = useState<Draft | null>(null);

  async function load(signal?: AbortSignal) {
    try {
      const payload = await readDrafts(signal);
      setDrafts(payload.drafts); setEligible(payload.eligibleCustomers);
    } catch (error) {
      if (!signal?.aborted) setMessage(error instanceof Error ? error.message : "Could not load drafts.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    readDrafts(controller.signal).then(payload => {
      if (!controller.signal.aborted) { setDrafts(payload.drafts); setEligible(payload.eligibleCustomers); setLoading(false); }
    }).catch(error => {
      if (!controller.signal.aborted) { setMessage(error instanceof Error ? error.message : "Could not load drafts."); setLoading(false); }
    });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(editing ? `/api/dashboard/campaigns/${editing.id}` : "/api/dashboard/campaigns", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body })
      });
      if (!response.ok) throw new Error("Could not save the draft. Check the fields and try again.");
      await load(); setEditing(null); setTitle(""); setBody(""); setMessage("Draft saved to your business. No messages were sent.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the draft."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/dashboard/campaigns/${removing.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this draft.");
      if (editing?.id === removing.id) { setEditing(null); setTitle(""); setBody(""); }
      setRemoving(null); await load(); setMessage("Draft deleted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete this draft."); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeader title="Campaign drafts" body="Prepare and save messages for customers who have opted in to offers." action={<Button variant="secondary" icon={<RefreshCw className="size-4" />} disabled={busy} onClick={() => void load()}>Refresh</Button>} />
    <Card className="mb-5 border-amber-200 bg-amber-50"><p className="font-bold text-ink">Draft preparation is available. Campaign delivery is not enabled.</p><p className="mt-2 text-sm leading-6 text-slate-700">Saved drafts stay with this business after refresh. No messages are sent or scheduled here. {eligible} customers currently have both WhatsApp updates and marketing consent enabled; eligibility must be checked again before any future send.</p></Card>
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <Card><h2 className="text-xl font-bold">{editing ? "Edit draft" : "Prepare a draft"}</h2><form onSubmit={save} className="mt-5 grid gap-4">
        <div className="grid gap-2"><Label htmlFor="campaign-title">Campaign name</Label><Input id="campaign-title" value={title} onChange={event => setTitle(event.target.value)} minLength={2} maxLength={120} required /></div>
        <div className="grid gap-2"><Label htmlFor="campaign-body">Message</Label><Textarea id="campaign-body" value={body} onChange={event => setBody(event.target.value)} minLength={2} maxLength={1200} rows={6} required /><p className="text-xs text-slate-500">{body.length}/1200 characters. Avoid private order or payment details.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="submit" variant="emerald" disabled={busy} icon={<Plus className="size-4" />}>{busy ? "Saving…" : "Save draft"}</Button>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setTitle(""); setBody(""); }}>Cancel edit</Button>}</div>
      </form><p role="status" className="mt-4 text-sm text-slate-700">{message}</p></Card>
      <Card><h2 className="text-xl font-bold">Saved drafts</h2>{loading ? <p className="mt-4 text-sm">Loading drafts…</p> : drafts.length === 0 ? <p className="mt-4 text-sm text-slate-600">No drafts yet. Prepare your first message using the form.</p> : <div className="mt-4 grid gap-4">{drafts.map(draft => <article key={draft.id} className="min-w-0 rounded-lg border border-line p-4"><div className="flex items-start gap-2"><MessageCircle className="mt-1 size-4 shrink-0 text-emerald" /><h3 className="break-words font-bold">{draft.title}</h3></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{draft.body}</p><p className="mt-3 text-xs text-slate-500">Draft · Saved {new Date(draft.updatedAt).toLocaleDateString("en-IN")}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" icon={<Edit3 className="size-4" />} disabled={busy} onClick={() => { setEditing(draft); setTitle(draft.title); setBody(draft.body); }}>Edit</Button><Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} disabled={busy} onClick={() => setRemoving(draft)}>Delete draft</Button></div></article>)}</div>}{drafts.length === 100 && <p className="mt-4 text-xs text-slate-500">Showing the 100 most recent drafts.</p>}</Card>
    </div>
    {removing && <ActionDialog title="Delete draft" body={`Remove “${removing.title}” from this business?`} onClose={() => setRemoving(null)}><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={() => void remove()}>Delete draft</Button></div></ActionDialog>}
  </>;
}

"use client";
import { useState } from "react";
import { useJson, api, useToast, Pager, PageHead, Badge, DateTime, ConfirmButton, Select, qs, Empty } from "./shared";

interface Room {
  id: string; code: string; status: string; version: number; createdAt: string; updatedAt: string;
  host: { id: string; name: string; email: string }; guest: { id: string; name: string; email: string } | null;
  turn: number | null; phase: string | null;
}

export default function Games() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useJson<{ rows: Room[]; total: number; pages: number }>(`/api/admin/games?${qs({ status, page })}`);
  const toast = useToast();

  async function act(id: string, action: "end" | "delete") {
    try { await api(`/api/admin/games/${id}`, { method: "POST", json: { action } }); toast.ok(action === "end" ? "Room ended" : "Room deleted"); list.reload(); }
    catch (e) { toast.err(e); }
  }

  return (
    <>
      {toast.node}
      <PageHead title="Games" sub="Live and past online-play rooms. Ending a room stops the night for both players; deleting removes it entirely.">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "", label: "All statuses" }, "waiting", "playing", "ended"]} />
        <button className="admBtn" onClick={() => list.reload()}>Refresh</button>
      </PageHead>
      {list.error && <div className="admNote admNote--err">{list.error}</div>}
      <div className="admCard">
        <div className="admTableWrap">
          <table className="admTable">
            <thead><tr><th>Code</th><th>Status</th><th>Host</th><th>Guest</th><th>Turn</th><th>Phase</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {list.data?.rows.map((r) => (
                <tr key={r.id}>
                  <td className="admMono">{r.code}</td>
                  <td><Badge>{r.status}</Badge></td>
                  <td>{r.host.name}<div className="admMuted admMono">{r.host.email}</div></td>
                  <td>{r.guest ? <>{r.guest.name}<div className="admMuted admMono">{r.guest.email}</div></> : <span className="admMuted">—</span>}</td>
                  <td className="admMono">{r.turn ?? "—"}</td>
                  <td className="admMono">{r.phase ?? "—"}</td>
                  <td><DateTime value={r.updatedAt} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.status !== "ended" && <ConfirmButton className="admBtn admBtn--sm" message="End this room for both players?" onConfirm={() => act(r.id, "end")}>End</ConfirmButton>}{" "}
                    <ConfirmButton className="admBtn admBtn--sm admBtn--danger" message="Delete this room permanently?" onConfirm={() => act(r.id, "delete")}>Delete</ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && list.data.rows.length === 0 && <Empty>{list.loading ? "Loading…" : "No rooms yet."}</Empty>}
        {list.data && <Pager page={page} pages={list.data.pages} total={list.data.total} onPage={setPage} />}
      </div>
    </>
  );
}

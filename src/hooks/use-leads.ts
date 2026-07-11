"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadRecord, LeadType } from "@/types";

const PAGE_SIZE = 20;

export function useLeads(leadType: LeadType) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loadedPage, setLoadedPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads?status=new&leadType=${leadType}&page=1&pageSize=${PAGE_SIZE}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLeads(data.leads); setLoadedPage(1); setTotal(data.total); setError(""); setWarning(data.warning ?? "");
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Adaylar yüklenemedi.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [leadType]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || leads.length >= total) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    try {
      const nextPage = loadedPage + 1;
      const response = await fetch(`/api/leads?status=new&leadType=${leadType}&page=${nextPage}&pageSize=${PAGE_SIZE}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLeads((current) => mergeUnique(current, data.leads));
      setLoadedPage(nextPage); setTotal(data.total); setWarning(data.warning ?? ""); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Diğer adaylar yüklenemedi."); }
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }, [leadType, leads.length, loadedPage, total]);

  return { leads, setLeads, total, setTotal, loading, loadingMore, hasMore: leads.length < total, loadMore, error, setError, warning };
}

function mergeUnique(current: LeadRecord[], incoming: LeadRecord[]) {
  const seen = new Set(current.map((lead) => lead.place_id));
  return [...current, ...incoming.filter((lead) => !seen.has(lead.place_id))];
}

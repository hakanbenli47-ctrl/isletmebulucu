"use client";

import { useEffect, useState } from "react";
import type { LeadRecord, LeadType } from "@/types";

export function useLeads(leadType: LeadType) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads?status=new&leadType=${leadType}&page=${page}&pageSize=10`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLeads(data.leads); setTotal(data.total); setError("");
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Adaylar yüklenemedi.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [leadType, page]);
  return { leads, setLeads, page, setPage, total, setTotal, loading, error, setError };
}

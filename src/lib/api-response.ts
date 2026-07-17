import { AuthError } from "@/lib/auth";
import { OpenDataPlacesError } from "@/lib/openstreetmap/client";
import { kullaniciyaUygunSupabaseHatasi } from "@/lib/supabase/errors";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: "Geçersiz istek.", details: error.issues }, { status: 400 });
  }
  if (error instanceof OpenDataPlacesError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const supabaseMesaji = kullaniciyaUygunSupabaseHatasi(error);
  if (supabaseMesaji) {
    console.error("Supabase API hatası:", error);
    return Response.json({ error: supabaseMesaji }, { status: 500 });
  }
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  return Response.json({ error: message }, { status: 500 });
}

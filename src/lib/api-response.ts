import { AuthError } from "@/lib/auth";
import { GooglePlacesError } from "@/lib/google-places/client";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: "Geçersiz istek.", details: error.issues }, { status: 400 });
  }
  if (error instanceof GooglePlacesError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  return Response.json({ error: message }, { status: 500 });
}

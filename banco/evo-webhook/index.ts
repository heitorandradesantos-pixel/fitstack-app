// FitStack · evo-webhook — recebe os avisos do EVO na hora (cartão recusado, boleto vencido, etc.)
// Endereço: https://<projeto>.supabase.co/functions/v1/evo-webhook?k=<chave da academia>
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const chaveDe = (json: string | undefined) => { try { const o = JSON.parse(json || "{}"); return o.default || Object.values(o)[0]; } catch { return undefined; } };
const SR = (Deno.env.get("SUPABASE_SECRET_KEYS") && chaveDe(Deno.env.get("SUPABASE_SECRET_KEYS"))) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SB_URL, SR, { auth: { persistSession: false } });
const EVO = "https://evo-integracao-api.w12app.com.br";

const ok = (x: unknown = { ok: true }, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });

// Procura um campo pelo nome em qualquer nível do JSON (o EVO varia maiúsculas/minúsculas)
function achar(o: any, nomes: string[], prof = 0): any {
  if (!o || typeof o !== "object" || prof > 4) return undefined;
  for (const [k, v] of Object.entries(o)) if (nomes.includes(k.toLowerCase()) && v !== null && v !== "" && typeof v !== "object") return v;
  for (const v of Object.values(o)) { const r = achar(v, nomes, prof + 1); if (r !== undefined) return r; }
  return undefined;
}
function telDe(m: any): string | null {
  for (const c of (m?.contacts || [])) {
    if (/mail/i.test(c.contactType || "")) continue;
    let d = String(c.description || "").replace(/\D/g, "").replace(/^0+/, "");
    if (d.length < 10) continue;
    if (!d.startsWith("55") || d.length <= 11) d = "55" + d;
    if (d.length >= 12 && d.length <= 13) return d;
  }
  return null;
}

Deno.serve(async (req) => {
  // O EVO pode testar o endereço com GET antes de salvar
  if (req.method !== "POST") return ok({ ok: true, servico: "FitStack" });
  const k = new URL(req.url).searchParams.get("k") || "";
  if (!/^[0-9a-f]{32}$/.test(k)) return ok({ erro: "chave inválida" }, 401);
  const { data: integ } = await db.from("integracoes_evo").select("academia_id, dns, token").eq("webhook_key", k).maybeSingle();
  if (!integ) return ok({ erro: "chave inválida" }, 401);

  let corpo: any = null;
  const txt = await req.text();
  try { corpo = JSON.parse(txt); } catch { corpo = { texto: txt.slice(0, 4000) }; }
  const lista = Array.isArray(corpo) ? corpo.slice(0, 50) : [corpo];

  for (const ev of lista) {
    const tipo = String(achar(ev, ["eventtype", "event_type", "event", "tipo", "type"]) || "evento").slice(0, 80);
    const idAluno = achar(ev, ["idmember", "id_member", "memberid", "idmemberpayer", "idcliente"]);
    const valor = Number(achar(ev, ["ammount", "amount", "value", "valor"])) || null;
    let nome: string | null = String(achar(ev, ["membername", "name", "nome", "payername"]) || "") || null;
    let tel: string | null = null;
    if (idAluno) {
      try {
        const r = await fetch(`${EVO}/api/v2/members?idsMembers=${encodeURIComponent(String(idAluno))}&take=1`, {
          headers: { Authorization: "Basic " + btoa(integ.dns + ":" + integ.token), Accept: "application/json" },
        });
        if (r.ok) {
          const j = await r.json(); const m = Array.isArray(j) ? j[0] : null;
          if (m) { nome = [m.firstName, m.lastName].filter(Boolean).join(" ") || nome; tel = telDe(m); }
        }
      } catch (_e) { /* segue sem telefone */ }
    }
    await db.from("evo_eventos").insert({ academia_id: integ.academia_id, tipo, id_aluno: idAluno ? String(idAluno) : null, nome, tel, valor, dados: ev });
  }
  return ok();
});

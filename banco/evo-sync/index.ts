// FitStack · evo-sync — busca os dados do EVO (só leitura) e guarda prontos no FitStack.
// Chamado 1x por dia pelo agendamento do banco (cabeçalho x-cron) ou pelo dono/sócio no botão "Atualizar agora".
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const chaveDe = (json: string | undefined) => { try { const o = JSON.parse(json || "{}"); return o.default || Object.values(o)[0]; } catch { return undefined; } };
const SR = (Deno.env.get("SUPABASE_SECRET_KEYS") && chaveDe(Deno.env.get("SUPABASE_SECRET_KEYS"))) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = (Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") && chaveDe(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"))) || Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_4pSkdBQF_-Q16yeAVQoFHA_SjhoaXjf";
const EVO = "https://evo-integracao-api.w12app.com.br";
const db = createClient(SB_URL, SR, { auth: { persistSession: false } });

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- datas (horário de Brasília) ----------
const DIA = 86400000;
const agoraBR = () => new Date(Date.now() - 3 * 3600000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const soData = (v: unknown): string | null => {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const b = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return b ? `${b[3]}-${b[2]}-${b[1]}` : null;
};
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA);

// ---------- EVO ----------
type Cfg = { academia_id: string; dns: string; token: string; calls: number };
async function evo(cfg: Cfg, path: string, params: Record<string, unknown> = {}) {
  const u = new URL(EVO + path);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") u.searchParams.set(k, String(v));
  cfg.calls++;
  const r = await fetch(u, {
    headers: { Authorization: "Basic " + btoa(cfg.dns + ":" + cfg.token), Accept: "application/json" },
  });
  const txt = await r.text();
  if (r.status === 401 || r.status === 403) throw new Error("O EVO recusou a chave. Confira o DNS e o token em Integrações.");
  if (r.status === 429) throw new Error("O EVO pediu para esperar (limite de consultas). Tente mais tarde.");
  if (!r.ok) throw new Error(`O EVO respondeu com erro ${r.status} em ${path}.`);
  let j: any;
  try { j = JSON.parse(txt); } catch { throw new Error(`Resposta inesperada do EVO em ${path}.`); }
  return Array.isArray(j) ? j : (j?.list ?? j?.data ?? j?.items ?? j?.result ?? j);
}
async function todas(cfg: Cfg, path: string, params: Record<string, unknown>, maxPag: number) {
  const out: any[] = [];
  let truncado = false;
  for (let p = 0; p < maxPag; p++) {
    const pag = await evo(cfg, path, { ...params, take: 50, skip: p * 50 });
    if (!Array.isArray(pag)) break;
    out.push(...pag);
    if (pag.length < 50) return { itens: out, truncado };
    if (p === maxPag - 1) truncado = true;
  }
  return { itens: out, truncado };
}

// ---------- utilidades de aluno ----------
const nomeDe = (m: any) => [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || m.name || "Sem nome";
function telDe(m: any): string | null {
  const cs: any[] = m.contacts || [];
  const ord = [...cs].sort((a, b) => {
    const pa = /cel|whats|móvel|movel/i.test(a.contactType || "") ? 0 : 1;
    const pb = /cel|whats|móvel|movel/i.test(b.contactType || "") ? 0 : 1;
    return pa - pb;
  });
  for (const c of ord) {
    if (/mail/i.test(c.contactType || "")) continue;
    let d = String(c.description || "").replace(/\D/g, "");
    if (d.length < 10) continue;
    if (d.startsWith("0")) d = d.replace(/^0+/, "");
    if (!d.startsWith("55") || d.length <= 11) d = "55" + d;
    if (d.length >= 12 && d.length <= 13) return d;
  }
  return null;
}
const primeiro = (n: string) => n.split(" ")[0];

// ---------- a busca ----------
async function sincronizar(cfg: Cfg) {
  const hoje = ymd(agoraBR());
  const ontem = ymd(new Date(Date.parse(hoje) - DIA));
  const iniMes = hoje.slice(0, 8) + "01";
  const md = (d: string) => d.slice(5, 10);
  const avisos: string[] = [];

  // 1) Todos os alunos ativos (aniversário, última presença, telefone, contrato)
  const at = await todas(cfg, "/api/v2/members", { status: 1, showMemberships: true }, 80);
  if (at.truncado) avisos.push("Mais de 4.000 alunos ativos: lista cortada.");
  const ativos = at.itens;
  const porId = new Map<number, any>();
  for (const m of ativos) porId.set(m.idMember, m);

  const proximos7 = Array.from({ length: 8 }, (_, i) => md(ymd(new Date(Date.parse(hoje) + i * DIA))));
  const aniversariantes: any[] = [];
  const sumidos: any[] = [];
  const vencendo: any[] = [];
  let bloqueados = 0, nuncaVieram = 0;

  for (const m of ativos) {
    const nome = nomeDe(m), tel = telDe(m);
    if (m.accessBlocked) bloqueados++;
    const nasc = soData(m.birthDate);
    if (nasc) {
      const i = proximos7.indexOf(md(nasc));
      if (i >= 0) aniversariantes.push({ id: m.idMember, nome, tel, em: i, idade: Number(hoje.slice(0, 4)) - Number(nasc.slice(0, 4)) });
    }
    const ult = soData(m.lastAccessDate);
    const desde = soData(m.registerDate);
    if (ult) {
      const d = diasEntre(ult, hoje);
      if (d >= 7) sumidos.push({ id: m.idMember, nome, tel, dias: d, ultima: ult });
    } else if (desde && diasEntre(desde, hoje) >= 7) {
      nuncaVieram++;
      sumidos.push({ id: m.idMember, nome, tel, dias: null, nunca: true, desde });
    }
    const ms: any[] = (m.memberships || []).filter((x: any) => !x.cancelDate && !/cancel/i.test(x.membershipStatus || ""));
    const fimMax = ms.map((x) => soData(x.endDate)).filter(Boolean).sort().pop() as string | undefined;
    const atual = ms.find((x) => soData(x.endDate) === fimMax);
    if (fimMax && !atual?.idMemberMembershipRenewed && !atual?.flRenewed) {
      const d = diasEntre(hoje, fimMax);
      if (d >= 0 && d <= 15) vencendo.push({ id: m.idMember, nome, tel, dias: d, fim: fimMax, plano: atual?.name || "" });
    }
  }
  aniversariantes.sort((a, b) => a.em - b.em || a.nome.localeCompare(b.nome));
  sumidos.sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999));
  vencendo.sort((a, b) => a.dias - b.dias);

  // 2) Mensalidades vencidas e não pagas (últimos 120 dias)
  const rc = await todas(cfg, "/api/v1/receivables", {
    dueDateStart: ymd(new Date(Date.parse(hoje) - 120 * DIA)), dueDateEnd: ontem, accountStatus: "4",
  }, 30);
  if (rc.truncado) avisos.push("Muitas contas em aberto: lista de inadimplentes cortada em 1.500.");
  const porDevedor = new Map<string, any>();
  for (const r of rc.itens) {
    const st = String(r.status?.name ?? r.status?.description ?? r.status ?? "");
    if (r.receivingDate || r.cancellationDate || /cancel|receb|pago|paid/i.test(st)) continue;
    const falta = (Number(r.ammount) || 0) - (Number(r.ammountPaid) || 0);
    if (falta <= 0.009) continue;
    const id = r.idMemberPayer ?? r.idProspectPayer ?? r.payerName;
    const venc = soData(r.dueDate)!;
    const m = porId.get(r.idMemberPayer);
    const x = porDevedor.get(String(id)) || { id: r.idMemberPayer ?? null, nome: m ? nomeDe(m) : (r.payerName || "Sem nome"), tel: m ? telDe(m) : null, valor: 0, parcelas: 0, desde: venc, ativo: !!m };
    x.valor += falta; x.parcelas++; if (venc < x.desde) x.desde = venc;
    porDevedor.set(String(id), x);
  }
  const inadimplentes = [...porDevedor.values()].map((x) => ({ ...x, valor: Math.round(x.valor * 100) / 100, dias: diasEntre(x.desde, hoje) }))
    .sort((a, b) => a.dias - b.dias);

  // 3) Movimento do mês: matrículas (convertidos) e cancelamentos
  const novos = await todas(cfg, "/api/v2/members", { conversionDateStart: iniMes, conversionDateEnd: hoje }, 10);
  const canc: any[] = [];
  for (let p = 0; p < 12; p++) {
    const pag = await evo(cfg, "/api/v2/membermembership", { cancelDateStart: iniMes, cancelDateEnd: hoje, take: 25, skip: p * 25 });
    if (!Array.isArray(pag)) break;
    canc.push(...pag);
    if (pag.length < 25) break;
  }
  const cancelados = canc.map((c) => {
    const m = porId.get(c.idMember);
    return { id: c.idMember, nome: c.name || (m ? nomeDe(m) : "Sem nome"), tel: m ? telDe(m) : null, dia: soData(c.cancelDate),
      plano: c.nameMembership || "", motivo: c.reasonCancellation || "", valor: Number(c.saleValue) || 0, ativo: !!m };
  }).sort((a, b) => String(b.dia).localeCompare(String(a.dia)));

  // 4) Leads / visitas do mês
  let leads: any[] = [];
  try {
    const pr = await todas(cfg, "/api/v1/prospects", { registerDateStart: iniMes, registerDateEnd: hoje }, 20);
    leads = pr.itens.map((p) => ({
      id: p.idProspect, nome: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Sem nome",
      tel: telDe({ contacts: [{ contactType: "Celular", description: p.cellphone || "" }] }),
      dia: soData(p.registerDate), convertido: !!(p.conversionDate || p.idMember),
      canal: p.mktChannel || "", temperatura: p.temperature || "", etapa: p.currentStep || "", por: p.employeeRegisterName || "",
    })).sort((a, b) => String(b.dia).localeCompare(String(a.dia)));
  } catch (_e) { avisos.push("Não deu para ler os leads do EVO."); }

  const resumo = {
    dia: hoje, ativos: ativos.length, bloqueados, nuncaVieram,
    aniversariantesHoje: aniversariantes.filter((a) => a.em === 0).length,
    sumidos7: sumidos.filter((s) => s.dias !== null && s.dias >= 7 && s.dias < 15).length,
    sumidos15: sumidos.filter((s) => s.dias !== null && s.dias >= 15 && s.dias < 30).length,
    sumidos30: sumidos.filter((s) => s.dias !== null && s.dias >= 30).length,
    inadimplentes: inadimplentes.length,
    inadValor: Math.round(inadimplentes.reduce((s, x) => s + x.valor, 0) * 100) / 100,
    vencendo15: vencendo.length,
    matriculasMes: novos.itens.length,
    canceladosMes: cancelados.length,
    canceladosValor: Math.round(cancelados.reduce((s, x) => s + x.valor, 0) * 100) / 100,
    motivos: Object.entries(cancelados.reduce((o: Record<string, number>, c) => { const k = c.motivo || "Sem motivo"; o[k] = (o[k] || 0) + 1; return o; }, {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 8),
    canais: Object.entries(leads.reduce((o: Record<string, number>, l) => { const k = l.canal || "Não informado"; o[k] = (o[k] || 0) + 1; return o; }, {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 8),
    leadsMes: leads.length,
    leadsConvertidos: leads.filter((l) => l.convertido).length,
  };
  return { hoje, resumo, aniversariantes, sumidos, vencendo, inadimplentes, cancelados, leads, avisos };
}

async function gravar(cfg: Cfg, r: Awaited<ReturnType<typeof sincronizar>>) {
  const a = cfg.academia_id, agora = new Date().toISOString();
  const { data: ant } = await db.from("evo_dados").select("dados").eq("academia_id", a).eq("chave", "resumo").maybeSingle();
  const hist: any[] = ((ant?.dados as any)?.historico || []).filter((h: any) => h.dia !== r.hoje);
  hist.push(r.resumo);
  const linhas = [
    { chave: "resumo", dados: { ...r.resumo, historico: hist.slice(-120), avisos: r.avisos, consultas: cfg.calls } },
    { chave: "aniversariantes", dados: { dia: r.hoje, itens: r.aniversariantes } },
    { chave: "sumidos", dados: { dia: r.hoje, itens: r.sumidos } },
    { chave: "vencendo", dados: { dia: r.hoje, itens: r.vencendo } },
    { chave: "inadimplentes", dados: { dia: r.hoje, itens: r.inadimplentes } },
    { chave: "cancelados", dados: { dia: r.hoje, itens: r.cancelados } },
    { chave: "leads", dados: { dia: r.hoje, itens: r.leads } },
  ].map((l) => ({ academia_id: a, chave: l.chave, dados: l.dados, atualizado_em: agora }));
  const { error } = await db.from("evo_dados").upsert(linhas);
  if (error) throw new Error("Não deu para gravar no FitStack: " + error.message);
  await db.from("integracoes_evo").update({ ultima_sync: agora, ultimo_erro: null, ultimas_consultas: cfg.calls }).eq("academia_id", a);
}

// Diagnóstico: mostra só o formato das respostas (nomes dos campos e status), sem dados pessoais.
async function diagnostico(cfg: Cfg) {
  const chaves = (x: any) => (x && typeof x === "object" ? Object.keys(x) : []);
  const hoje = ymd(agoraBR()), d60 = ymd(new Date(Date.parse(hoje) - 60 * DIA)), ontem = ymd(new Date(Date.parse(hoje) - DIA));
  const out: any = {};
  for (const extra of [{ showMemberships: true }, { showActivityData: true }]) {
    try {
      const m = await evo(cfg, "/api/v2/members", { status: 1, take: 5, ...extra });
      const l = Array.isArray(m) ? m : [];
      const ex = l.find((x: any) => (x.memberships || []).length);
      out["membros_" + Object.keys(extra)[0]] = { comPlano: l.filter((x: any) => (x.memberships || []).length).length, plano: chaves(ex?.memberships?.[0]), st: l.map((x: any) => x.membershipStatus) };
    } catch (e) { out["membros_" + Object.keys(extra)[0]] = (e as Error).message; }
  }
  for (const st of ["1", "4", "5"]) {
    try {
      const r = await evo(cfg, "/api/v1/receivables", { dueDateStart: d60, dueDateEnd: ontem, accountStatus: st, take: 50 });
      const l = Array.isArray(r) ? r : [];
      const c: Record<string, number> = {};
      for (const x of l) { const k = JSON.stringify(x.status) + (x.receivingDate ? " receb" : "") + (x.idMemberPayer ? " aluno" : ""); c[k] = (c[k] || 0) + 1; }
      out["contas_status_" + st] = { qtd: l.length, status: c, descr: [...new Set(l.map((x: any) => String(x.description || "").replace(/[0-9]/g, "#").slice(0, 30)))].slice(0, 6) };
    } catch (e) { out["contas_status_" + st] = (e as Error).message; }
  }
  try {
    const c = await evo(cfg, "/api/v2/membermembership", { cancelDateStart: hoje.slice(0, 8) + "01", cancelDateEnd: hoje, take: 25 });
    out.cancelamentos = { qtd: Array.isArray(c) ? c.length : typeof c, campos: chaves(Array.isArray(c) ? c[0] : c) };
  } catch (e) { out.cancelamentos = (e as Error).message; }
  try {
    const p = await evo(cfg, "/api/v1/prospects", { registerDateStart: hoje.slice(0, 8) + "01", registerDateEnd: hoje, take: 50 });
    out.leads = { qtd: Array.isArray(p) ? p.length : typeof p, campos: chaves(Array.isArray(p) ? p[0] : p) };
  } catch (e) { out.leads = (e as Error).message; }
  out.consultas = cfg.calls;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    let alvos: string[] = [];
    const cron = req.headers.get("x-cron");
    if (cron) {
      const { data } = await db.from("sistema_segredos").select("valor").eq("nome", "cron").maybeSingle();
      if (!data || data.valor !== cron) return resp({ erro: "Não autorizado." }, 401);
      const { data: todasAc } = await db.from("integracoes_evo").select("academia_id");
      alvos = (todasAc || []).map((x) => x.academia_id);
    } else {
      const auth = req.headers.get("Authorization") || "";
      if (!body.academia_id) return resp({ erro: "Academia não informada." }, 400);
      const usr = createClient(SB_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
      const { data: papel } = await usr.rpc("meu_papel", { a: body.academia_id });
      if (papel !== "admin") return resp({ erro: "Só o dono ou um sócio pode atualizar os dados do EVO." }, 403);
      alvos = [body.academia_id];
    }
    const saida: any[] = [];
    for (const a of alvos) {
      const { data: c } = await db.from("integracoes_evo").select("dns, token, ultima_sync").eq("academia_id", a).maybeSingle();
      if (!c) { saida.push({ academia_id: a, erro: "Chave do EVO não cadastrada." }); continue; }
      if (!cron && body.modo !== "diag" && c.ultima_sync && Date.now() - Date.parse(c.ultima_sync) < 10 * 60000) {
        saida.push({ academia_id: a, erro: "Os dados foram atualizados há menos de 10 minutos. Espere um pouco." }); continue;
      }
      const cfg: Cfg = { academia_id: a, dns: c.dns, token: c.token, calls: 0 };
      try {
        if (body.modo === "diag") { saida.push({ academia_id: a, diag: await diagnostico(cfg) }); continue; }
        const r = await sincronizar(cfg);
        await gravar(cfg, r);
        saida.push({ academia_id: a, ok: true, resumo: r.resumo, avisos: r.avisos, consultas: cfg.calls });
      } catch (e) {
        const msg = (e as Error).message || "Erro desconhecido.";
        await db.from("integracoes_evo").update({ ultimo_erro: msg }).eq("academia_id", a);
        saida.push({ academia_id: a, erro: msg, consultas: cfg.calls });
      }
    }
    return resp({ resultado: saida });
  } catch (e) {
    return resp({ erro: (e as Error).message || "Erro desconhecido." }, 500);
  }
});

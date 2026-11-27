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
type Cfg = { academia_id: string; dns: string; token: string; calls: number; esperas?: number };
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function evo(cfg: Cfg, path: string, params: Record<string, unknown> = {}) {
  const u = new URL(EVO + path);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") u.searchParams.set(k, String(v));
  let r: Response, txt = "";
  for (let tent = 0; ; tent++) {
    cfg.calls++;
    r = await fetch(u, { headers: { Authorization: "Basic " + btoa(cfg.dns + ":" + cfg.token), Accept: "application/json" } });
    txt = await r.text();
    // Limite de consultas: espera o que o EVO pedir (até 25 s) e tenta de novo, no máximo 3 esperas por busca
    // Erro passageiro do EVO (500/502/503): tenta mais uma vez depois de 3 s
    if (r.status >= 500 && tent < 1) { await dormir(3000); continue; }
    if (r.status === 429 && tent < 2 && (cfg.esperas || 0) < 3) {
      cfg.esperas = (cfg.esperas || 0) + 1;
      const ra = Number(r.headers.get("retry-after")) || 15;
      await dormir(Math.min(25, Math.max(5, ra)) * 1000);
      continue;
    }
    break;
  }
  if (r.status === 401 || r.status === 403) throw new Error("O EVO recusou a chave. Confira o DNS e o token em Integrações.");
  if (r.status === 429) throw new Error("O EVO pediu para esperar (limite de consultas). Tente mais tarde.");
  if (!r.ok) throw new Error(`O EVO respondeu com erro ${r.status} em ${path}${params.skip ? " (a partir do " + params.skip + "º)" : ""}.`);
  let j: any;
  try { j = JSON.parse(txt); } catch { throw new Error(`Resposta inesperada do EVO em ${path}.`); }
  return Array.isArray(j) ? j : (j?.list ?? j?.data ?? j?.items ?? j?.result ?? j);
}
async function todas(cfg: Cfg, path: string, params: Record<string, unknown>, maxPag: number, tam = 50) {
  const out: any[] = [];
  let truncado = false;
  for (let p = 0; p < maxPag; p++) {
    const pag = await evo(cfg, path, { ...params, take: tam, skip: p * tam });
    if (!Array.isArray(pag)) break;
    out.push(...pag);
    if (pag.length < tam) return { itens: out, truncado };
    if (p === maxPag - 1) truncado = true;
  }
  return { itens: out, truncado };
}

// ---------- alunos ativos em partes (academia grande não cabe no tempo de uma chamada) ----------
// Cada página é guardada em evo_cache. Se o tempo acabar, a busca para e a próxima chamada continua de onde parou.
class Parcial extends Error { constructor(public paginas: number) { super("parcial"); } }
const T0 = { v: 0 };
const decorrido = () => (Date.now() - T0.v) / 1000;
function enxuto(m: any, hoje: string) {
  const lim = ymd(new Date(Date.parse(hoje) - 400 * DIA));
  return {
    idMember: m.idMember, firstName: m.firstName, lastName: m.lastName, name: m.name,
    contacts: (m.contacts || []).map((c: any) => ({ contactType: c.contactType, description: c.description })),
    birthDate: m.birthDate, lastAccessDate: m.lastAccessDate, registerDate: m.registerDate, accessBlocked: m.accessBlocked,
    gympassId: m.gympassId || null, codeTotalpass: m.codeTotalpass || null, userIdGurupass: m.userIdGurupass || null,
    memberships: (m.memberships || []).filter((x: any) => !soData(x.endDate) || (soData(x.endDate) as string) >= lim).map((x: any) => ({
      name: x.name ?? x.nameMembership, endDate: x.endDate, cancelDate: x.cancelDate, membershipStatus: x.membershipStatus,
      idMemberMembershipRenewed: x.idMemberMembershipRenewed, flRenewed: x.flRenewed })),
  };
}
async function membrosAtivos(cfg: Cfg, hoje: string, limiteSeg: number) {
  const { data: cache } = await db.from("evo_cache").select("pagina, itens").eq("academia_id", cfg.academia_id).eq("dia", hoje).order("pagina");
  const pags: any[][] = (cache || []).map((x: any) => x.itens || []);
  const TAM = 100, MAX = 40;
  let fim = pags.length > 0 && pags[pags.length - 1].length < TAM;
  while (!fim && pags.length < MAX) {
    if (decorrido() > limiteSeg) throw new Parcial(pags.length);
    const pag = await evo(cfg, "/api/v2/members", { status: 1, showMemberships: true, take: TAM, skip: pags.length * TAM });
    const l = Array.isArray(pag) ? pag.map((m: any) => enxuto(m, hoje)) : [];
    await db.from("evo_cache").upsert({ academia_id: cfg.academia_id, dia: hoje, pagina: pags.length, itens: l });
    pags.push(l);
    if (l.length < TAM) fim = true;
  }
  return { itens: pags.flat(), truncado: !fim };
}
async function limparCache(a: string) { await db.from("evo_cache").delete().eq("academia_id", a); }

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
// De onde vem o aluno: plano pago direto na academia ou agregador (Wellhub/Gympass, TotalPass, GuruPass)
const AGREG = /wellhub|gympass|totalpass|total pass|gurupass|guru pass/i;
// Cortesia, VIP, free pass e transferência não são plano pago
const CORTESIA = /\bvip\b|free ?pass|cortesia|transfer[eê]ncia de dias|funcion[aá]ri|experimental|permuta|bols/i;
// Só contratos em vigor hoje (o EVO devolve também os antigos já vencidos)
const planosAtivos = (m: any) => { const h = ymd(agoraBR());
  return (m?.memberships || []).filter((x: any) => !x.cancelDate && !/cancel/i.test(x.membershipStatus || "") && (!soData(x.endDate) || (soData(x.endDate) as string) >= h)); };
function origemDe(m: any): "direto" | "wellhub" | "totalpass" | "gurupass" | "outro" {
  const ms = planosAtivos(m), nomes = ms.map((x: any) => String(x.name || x.nameMembership || ""));
  if (nomes.some((n: string) => n && !AGREG.test(n) && !CORTESIA.test(n))) return "direto";
  if (nomes.some((n: string) => /wellhub|gympass/i.test(n)) || m?.gympassId) return "wellhub";
  if (nomes.some((n: string) => /total ?pass/i.test(n)) || m?.codeTotalpass) return "totalpass";
  if (nomes.some((n: string) => /guru ?pass/i.test(n)) || m?.userIdGurupass) return "gurupass";
  return "outro";
}
const origemPlano = (nome: string) => /wellhub|gympass/i.test(nome) ? "wellhub" : /total ?pass/i.test(nome) ? "totalpass" : /guru ?pass/i.test(nome) ? "gurupass" : nome && !CORTESIA.test(nome) ? "direto" : "outro";
const conta = (l: string[]) => l.reduce((o: Record<string, number>, k) => { o[k] = (o[k] || 0) + 1; return o; }, {});

// ---------- a busca ----------
async function sincronizar(cfg: Cfg) {
  const hoje = ymd(agoraBR());
  const ontem = ymd(new Date(Date.parse(hoje) - DIA));
  const iniMes = hoje.slice(0, 8) + "01";
  const md = (d: string) => d.slice(5, 10);
  const avisos: string[] = [];

  // 1) Todos os alunos ativos (aniversário, última presença, telefone, contrato)
  const at = await membrosAtivos(cfg, hoje, 85);
  // O resto da busca leva perto de 1 minuto: se já passou muito tempo, termina na próxima chamada
  if (decorrido() > 80) throw new Parcial(-1);
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
    const nome = nomeDe(m), tel = telDe(m), org = origemDe(m);
    m._org = org;
    if (m.accessBlocked) bloqueados++;
    const nasc = soData(m.birthDate);
    if (nasc) {
      const i = proximos7.indexOf(md(nasc));
      if (i >= 0) aniversariantes.push({ id: m.idMember, nome, tel, em: i, idade: Number(hoje.slice(0, 4)) - Number(nasc.slice(0, 4)), org });
    }
    const ult = soData(m.lastAccessDate);
    const desde = soData(m.registerDate);
    if (ult) {
      const d = diasEntre(ult, hoje);
      if (d >= 7) sumidos.push({ id: m.idMember, nome, tel, dias: d, ultima: ult, org });
    } else if (desde && diasEntre(desde, hoje) >= 7) {
      nuncaVieram++;
      sumidos.push({ id: m.idMember, nome, tel, dias: null, nunca: true, desde, org });
    }
    const ms: any[] = (m.memberships || []).filter((x: any) => !x.cancelDate && !/cancel/i.test(x.membershipStatus || ""));
    const fimMax = ms.map((x) => soData(x.endDate)).filter(Boolean).sort().pop() as string | undefined;
    const atual = ms.find((x) => soData(x.endDate) === fimMax);
    if (fimMax && !atual?.idMemberMembershipRenewed && !atual?.flRenewed && !/wellhub|gympass|totalpass|gurupass|recorrente/i.test(atual?.name || "")) {
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
  // Ex-alunos com dívida: busca o telefone deles (50 por consulta)
  const faltam = [...porDevedor.values()].filter((x) => x.id && !x.ativo).map((x) => x.id);
  for (let i = 0; i < faltam.length && i < 500; i += 50) {
    try {
      const ex = await evo(cfg, "/api/v2/members", { idsMembers: faltam.slice(i, i + 50).join(","), take: 50 });
      for (const m of (Array.isArray(ex) ? ex : [])) { const x = porDevedor.get(String(m.idMember)); if (x) { x.tel = telDe(m); x.nome = nomeDe(m); } }
    } catch (_e) { avisos.push("Não deu para buscar o telefone de alguns ex-alunos."); break; }
  }
  const inadimplentes = [...porDevedor.values()].map((x) => ({ ...x, valor: Math.round(x.valor * 100) / 100, dias: diasEntre(x.desde, hoje) }))
    .sort((a, b) => a.dias - b.dias);

  // 3) Movimento do mês: matrículas (convertidos) e cancelamentos
  let novos: { itens: any[]; truncado: boolean } = { itens: [], truncado: false };
  try { novos = await todas(cfg, "/api/v2/members", { conversionDateStart: iniMes, conversionDateEnd: hoje }, 10); }
  catch (e) {
    // Limite de consultas do EVO: em vez de gravar "0 matrículas", para aqui e continua daqui a pouco
    // (os alunos já ficaram guardados no evo_cache, então a próxima rodada é rápida).
    if (/limite de consultas/i.test((e as Error).message)) throw new Parcial(-1);
    avisos.push("Não deu para contar as matrículas do mês: " + (e as Error).message);
  }
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
      plano: c.nameMembership || "", motivo: String(c.reasonCancellation || "").replace(/inadimpl\?ncia/i, "inadimplência").replace(/\uFFFD/g, ""), valor: Number(c.saleValue) || 0, ativo: !!m };
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
  // O EVO nem sempre marca o lead que virou aluno: cruza com os alunos ativos por telefone e por nome completo
  try {
    const soNum = (t: any) => String(t || "").replace(/\D/g, "").slice(-11);
    const nrm = (n: any) => String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const tels = new Set(ativos.map((m: any) => soNum(telDe(m))).filter((t: string) => t.length >= 10));
    const nomes = new Set(ativos.map((m: any) => nrm(nomeDe(m))).filter((n: string) => n.split(" ").length >= 2));
    leads = leads.map((l) => ({ ...l, convertido: l.convertido || (soNum(l.tel).length >= 10 && tels.has(soNum(l.tel))) || nomes.has(nrm(l.nome)) }));
  } catch (_e) { /* segue sem o cruzamento */ }

  // 5) Risco de cancelamento por aluno e resultado dos contatos já feitos
  const rr = await riscoEResultados(cfg, hoje, ativos, porId, inadimplentes, vencendo);

  const resumo = {
    dia: hoje, ativos: ativos.length, bloqueados, nuncaVieram,
    riscoAlto: rr.risco.filter((x: any) => x.score >= 60).length,
    resultados: rr.resultados,
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
    origem: {
      ativos: conta(ativos.map((m: any) => m._org)),
      sumidos: conta(sumidos.filter((x) => x.dias !== null).map((x) => x.org)),
      // Em dia: ativos sem nenhuma mensalidade vencida em aberto (é o número que paga as contas)
      adimplentes: conta(ativos.filter((m: any) => !inadimplentes.some((x) => x.id === m.idMember)).map((m: any) => m._org)),
      // Quem de fato veio treinar nos últimos 30 dias (Wellhub/TotalPass ficam "ativos" no EVO mesmo sem vir)
      frequentes: conta(ativos.filter((m: any) => { const d = soData(m.lastAccessDate); return !!d && d >= ymd(new Date(Date.parse(hoje) - 30 * DIA)); }).map((m: any) => m._org)),
      matriculas: conta(novos.itens.map((m: any) => porId.get(m.idMember)?._org || origemDe(m))),
      cancelados: conta(cancelados.map((c) => origemPlano(c.plano))),
      planos: Object.entries(conta(ativos.flatMap((m: any) => planosAtivos(m).map((x: any) => String(x.name || x.nameMembership || "Sem nome")))))
        .sort((a, b) => b[1] - a[1]).slice(0, 20),
    },
  };
  return { hoje, resumo, aniversariantes, sumidos, vencendo, inadimplentes, cancelados, leads, risco: rr.risco, avisos };
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
    { chave: "risco", dados: { dia: r.hoje, itens: r.risco } },
  ].map((l) => ({ academia_id: a, chave: l.chave, dados: l.dados, atualizado_em: agora }));
  const { error } = await db.from("evo_dados").upsert(linhas);
  if (error) throw new Error("Não deu para gravar no FitStack: " + error.message);
  await db.from("integracoes_evo").update({ ultima_sync: agora, ultimo_erro: null, ultimas_consultas: cfg.calls }).eq("academia_id", a);
}

// ---------- risco e resultados ----------
const brl = (v: number) => "R$ " + (Math.round(v * 100) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function fimDe(m: any): string | null {
  const ms: any[] = (m?.memberships || []).filter((x: any) => !x.cancelDate && !/cancel/i.test(x.membershipStatus || ""));
  return (ms.map((x) => soData(x.endDate)).filter(Boolean).sort().pop() as string) || null;
}
async function riscoEResultados(cfg: Cfg, hoje: string, ativos: any[], porId: Map<number, any>, inadimplentes: any[], vencendo: any[]) {
  const d35 = ymd(new Date(Date.parse(hoje) - 35 * DIA)), d30 = ymd(new Date(Date.parse(hoje) - 30 * DIA)), d7 = ymd(new Date(Date.parse(hoje) - 7 * DIA));
  const { data: cont } = await db.from("evo_contatos").select("id,dia,lista,id_aluno,info,resultado,resultado_valor,por_nome")
    .eq("academia_id", cfg.academia_id).gte("dia", d35).limit(5000);
  const contatos: any[] = cont || [];
  const membroDe = (c: any) => String(c.info?.membro ?? c.id_aluno);
  const recentes = new Set(contatos.filter((c) => c.dia >= d7).map(membroDe));
  const inadPorId = new Map<string, any>(); for (const x of inadimplentes) if (x.id) inadPorId.set(String(x.id), x);
  const vencPorId = new Map<string, any>(vencendo.map((v) => [String(v.id), v]));

  // Nota de risco (0 a 100) de cada aluno ativo
  const risco: any[] = [];
  for (const m of ativos) {
    const id = String(m.idMember), ult = soData(m.lastAccessDate), reg = soData(m.registerDate);
    const d = ult ? diasEntre(ult, hoje) : null;
    let pts = 0; const motivos: string[] = [];
    if (d === null) { if (reg && diasEntre(reg, hoje) >= 7) { pts += 45; motivos.push("Nunca treinou desde a matrícula"); } }
    else if (d >= 30) { pts += 45; motivos.push(`Não vem há ${d} dias`); }
    else if (d >= 15) { pts += 35; motivos.push(`Não vem há ${d} dias`); }
    else if (d >= 7) { pts += 25; motivos.push(`Não vem há ${d} dias`); }
    const inad = inadPorId.get(id);
    if (inad) { pts += inad.dias > 30 ? 35 : 25; motivos.push(`Deve ${brl(inad.valor)} há ${inad.dias} dia${inad.dias === 1 ? "" : "s"}`); }
    const v = vencPorId.get(id);
    if (v) { pts += 20; motivos.push(v.dias === 0 ? "Plano vence hoje" : `Plano vence em ${v.dias} dia${v.dias === 1 ? "" : "s"}`); }
    if (pts > 0 && reg && diasEntre(reg, hoje) <= 90) { pts += 10; motivos.push("Aluno novo (menos de 3 meses)"); }
    if (pts >= 40) risco.push({ id: m.idMember, nome: nomeDe(m), tel: telDe(m), score: Math.min(100, pts), motivos, dias: d,
      valor: inad ? inad.valor : 0, fim: v ? v.fim : null, chamadoRecente: recentes.has(id) });
  }
  risco.sort((a, b) => b.score - a.score || (b.dias ?? 999) - (a.dias ?? 999));

  // Resultado de cada contato ainda sem resultado
  let marcados = 0;
  for (const c of contatos) {
    if (c.resultado || marcados >= 400) continue;
    const id = membroDe(c), m = porId.get(Number(id)), info = c.info || {};
    let res: string | null = null, em: string | null = null, val: number | null = null;
    if (["inad", "risco", "alerta"].includes(c.lista) && Number(info.valor) > 0) {
      const agora = inadPorId.get(id), atual = agora ? Number(agora.valor) : 0;
      if (atual < Number(info.valor) - 0.01) { res = "pagou"; em = hoje; val = Math.round((Number(info.valor) - atual) * 100) / 100; }
    }
    if (!res && ["sumido", "risco", "alerta"].includes(c.lista)) {
      const ult = m && soData(m.lastAccessDate);
      if (ult && ult > c.dia) { res = "voltou"; em = ult; }
    }
    if (!res && (c.lista === "renovacao" || ((c.lista === "risco" || c.lista === "alerta") && info.fim))) {
      const f = fimDe(m);
      if (info.fim && f && f > info.fim) { res = "renovou"; em = hoje; }
    }
    if (!res && c.lista === "cancelado" && info.ativo === false && m) { res = "voltou"; em = hoje; }
    if (res) {
      const { error } = await db.from("evo_contatos").update({ resultado: res, resultado_em: em, resultado_valor: val }).eq("id", c.id);
      if (!error) { c.resultado = res; c.resultado_valor = val; marcados++; }
    }
  }

  // Resumo dos últimos 30 dias
  const ult30 = contatos.filter((c) => c.dia >= d30);
  const mediveis = ult30.filter((c) => c.lista !== "aniversario" && c.lista !== "lead");
  const porPessoa: Record<string, any> = {};
  for (const c of ult30) {
    const k = c.por_nome || "Sem nome";
    const p = porPessoa[k] || (porPessoa[k] = { nome: k, chamados: 0, resultados: 0, valor: 0 });
    p.chamados++; if (c.resultado) { p.resultados++; p.valor += Number(c.resultado_valor) || 0; }
  }
  const resultados = {
    chamados: ult30.length, mediveis: mediveis.length,
    voltou: ult30.filter((c) => c.resultado === "voltou").length,
    pagou: ult30.filter((c) => c.resultado === "pagou").length,
    pagouValor: Math.round(ult30.reduce((t, c) => t + (c.resultado === "pagou" ? Number(c.resultado_valor) || 0 : 0), 0) * 100) / 100,
    renovou: ult30.filter((c) => c.resultado === "renovou").length,
    porPessoa: Object.values(porPessoa).map((p: any) => ({ ...p, valor: Math.round(p.valor * 100) / 100 })).sort((a: any, b: any) => b.resultados - a.resultados || b.chamados - a.chamados),
  };
  return { risco: risco.slice(0, 300), resultados };
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


// ---------- Financeiro (DRE): recebido e pago no mês, pelo EVO ----------
const nomeObj = (x: any) => (x && typeof x === "object" ? (x.name ?? x.description ?? "") : (x ?? "")) as string;
const recebido = (x: any) => /receiv|receb|pago|paid/i.test(nomeObj(x?.status)) || Number(x?.status?.id) === 2;
async function financeiroMes(cfg: Cfg, mes: string, avisos: string[]) {
  const ini = mes + "-01";
  const fimD = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
  const fim = ymd(fimD) > ymd(agoraBR()) ? ymd(agoraBR()) : ymd(fimD);
  const dentro = (d: any) => { const x = soData(d); return !!x && x >= ini && x <= fim; };
  // Recebido no mês
  const rc = await todas(cfg, "/api/v1/receivables", { receivingDateStart: ini, receivingDateEnd: fim, accountStatus: "2" }, 40);
  if (rc.truncado) avisos.push(`Receita de ${mes}: muitas parcelas, a soma pode estar incompleta.`);
  let total = 0, taxas = 0, qtd = 0; const formas: Record<string, number> = {};
  for (const r of rc.itens) {
    if (r.cancellationDate || !dentro(r.receivingDate) || !recebido(r)) continue;
    const v = Number(r.ammountPaid ?? r.ammount) || 0; if (v <= 0) continue;
    total += v; qtd++;
    const f = nomeObj(r.paymentType) || "Outros";
    formas[f] = (formas[f] || 0) + v;
    const fe = typeof r.fees === "number" ? r.fees : Number(r.fees?.value ?? r.fees?.amount ?? 0);
    if (fe > 0) taxas += fe;
  }
  // Pago no mês (contas a pagar lançadas no EVO)
  const iniV = ymd(new Date(Date.parse(ini) - 120 * DIA)), fimV = ymd(new Date(fimD.getTime() + 45 * DIA));
  const pg = await todas(cfg, "/api/v1/payables", { dueDateStart: iniV, dueDateEnd: fimV }, 20);
  if (pg.truncado) avisos.push(`Despesas de ${mes}: muitas contas no EVO, a soma pode estar incompleta.`);
  const centros: Record<string, { v: number; n: number }> = {}; const itens: any[] = []; let pago = 0;
  for (const x of pg.itens) {
    if (x.cancellationDate || !dentro(x.paymentDate)) continue;
    const v = Number(x.ammountPaid ?? x.ammount) || 0; if (v <= 0) continue;
    const c = nomeObj(x.costCenter) || "Sem centro de custo";
    pago += v; (centros[c] = centros[c] || { v: 0, n: 0 }).v += v; centros[c].n++;
    if (itens.length < 400) itens.push({ d: soData(x.paymentDate), desc: String(x.description || "").trim().slice(0, 80), centro: c, v: Math.round(v * 100) / 100,
      forn: String(nomeObj(x.recipient) || nomeObj(x.beneficiary) || "").slice(0, 60) });
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    receita: { total: r2(total), taxas: r2(taxas), qtd, formas: Object.entries(formas).map(([k, v]) => [k, r2(v)]).sort((a: any, b: any) => b[1] - a[1]) },
    despesas: { total: r2(pago), centros: Object.entries(centros).map(([k, o]) => [k, r2(o.v), o.n]).sort((a: any, b: any) => b[1] - a[1]), itens },
    ate: fim,
  };
}
async function sincronizarFinanceiro(cfg: Cfg) {
  const a = cfg.academia_id, avisos: string[] = [];
  const { data: ant } = await db.from("evo_dados").select("dados").eq("academia_id", a).eq("chave", "financeiro").maybeSingle();
  const meses: Record<string, any> = { ...((ant?.dados as any)?.meses || {}) };
  const hoje = ymd(agoraBR()), atual = hoje.slice(0, 7);
  const anterior = ymd(new Date(Date.parse(atual + "-01") - DIA)).slice(0, 7);
  const fazer = [atual];
  if (Number(hoje.slice(8, 10)) <= 7 || !meses[anterior]) fazer.push(anterior);
  // Completa o histórico aos poucos (1 mês antigo por vez, para não estourar o limite do EVO)
  for (let i = 2; i <= 6; i++) {
    const m = ymd(new Date(Date.UTC(Number(atual.slice(0, 4)), Number(atual.slice(5, 7)) - 1 - i, 1))).slice(0, 7);
    if (!meses[m]) { fazer.push(m); break; }
  }
  let limite = false;
  for (const m of fazer) {
    if (limite) break;
    try { meses[m] = await financeiroMes(cfg, m, avisos); }
    catch (e) { const msg = (e as Error).message; if (/esperar|limite/i.test(msg)) limite = true; avisos.push(`Financeiro de ${m}: ${msg}`); }
  }
  let centros: string[] = ((ant?.dados as any)?.centros) || [];
  if (!limite) try {
    const cc = await todas(cfg, "/api/v1/costcenter", {}, 6);
    centros = cc.itens.filter((x: any) => x.active !== false).map((x: any) => String(x.description || "").trim()).filter(Boolean);
  } catch (_e) { /* sem lista de centros */ }
  const chaves = Object.keys(meses).sort().slice(-13);
  const dados = { meses: Object.fromEntries(chaves.map((k) => [k, meses[k]])), centros, avisos, atualizado: new Date().toISOString() };
  await db.from("evo_dados").upsert({ academia_id: a, chave: "financeiro", dados, atualizado_em: new Date().toISOString() });
  return { meses: fazer, avisos };
}

// Sondagem: quais endpoints financeiros o token consegue ler (só nomes de campos, contagens e somas).
async function sondar(cfg: Cfg, extra?: any) {
  const hoje = ymd(agoraBR()), ini = hoje.slice(0, 8) + "01";
  const iniAnt = ymd(new Date(Date.parse(ini) - 20 * DIA)).slice(0, 8) + "01";
  const testes: [string, string, Record<string, unknown>][] = [
    ["payables_venc", "/api/v1/payables", { dueDateStart: iniAnt, dueDateEnd: hoje, take: 50 }],
    ["payables_pag", "/api/v1/payables", { paymentDateStart: iniAnt, paymentDateEnd: hoje, take: 50 }],
    ["payables", "/api/v1/payables", { take: 50 }],
    ["costcenter", "/api/v1/costcenter", { take: 50 }],
    ["cost-center", "/api/v1/cost-center", { take: 50 }],
    ["receb_mes", "/api/v1/receivables", { receivingDateStart: ini, receivingDateEnd: hoje, take: 50 }],
    ["receb_status2", "/api/v1/receivables", { dueDateStart: ini, dueDateEnd: hoje, accountStatus: "2", take: 50 }],
    ["sales", "/api/v2/sales", { dateSaleStart: ini, dateSaleEnd: hoje, take: 25 }],
    ["sales_v1", "/api/v1/sales", { dateSaleStart: ini, dateSaleEnd: hoje, take: 25 }],
    ["bank", "/api/v1/bank-accounts", {}],
    ["entries", "/api/v1/entries", { take: 25 }],
  ];
  const out: any = {};
  const lista = Array.isArray(extra) ? extra.filter((x: any) => Array.isArray(x) && /^\/api\/v[12]\/(payables|receivables|costcenter|sales|bank-accounts|members|configuration\/api-usage)$/.test(String(x[1]))).slice(0, 12) : testes;
  for (const [nome, path, params] of lista) {
    const u = new URL(EVO + path);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    try {
      cfg.calls++;
      const r = await fetch(u, { headers: { Authorization: "Basic " + btoa(cfg.dns + ":" + cfg.token), Accept: "application/json" } });
      const txt = await r.text();
      let j: any = null; try { j = JSON.parse(txt); } catch { /* texto */ }
      const l = Array.isArray(j) ? j : (j?.list ?? j?.data ?? j?.items ?? null);
      const o: any = { st: r.status };
      if (Array.isArray(l)) {
        o.qtd = l.length; o.campos = l[0] ? Object.keys(l[0]) : [];
        const dist: any = {}, soma: any = {};
        for (const x of l) for (const [k, v] of Object.entries(x || {})) {
          if (/date/i.test(k) && typeof v === "string") { const d = (o.datas = o.datas || {}); const a = d[k] || [v, v]; d[k] = [a[0] < v ? a[0] : v.slice(0, 10), a[1] > v ? a[1] : v.slice(0, 10)]; }
          if (typeof v === "number" && /amm|amount|value|valor|total/i.test(k)) soma[k] = Math.round(((soma[k] || 0) + v) * 100) / 100;
          if (/cost|categ|plan|account|descr|supplier|forneced|status|type|form|payment/i.test(k)) {
            const val = typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 60);
            (dist[k] = dist[k] || new Set()).add(val);
          }
        }
        o.soma = soma; o.valores = Object.fromEntries(Object.entries(dist).map(([k, v]: any) => [k, [...v].slice(0, 12)]));
      } else o.resp = txt.slice(0, 300);
      out[nome] = o;
    } catch (e) { out[nome] = { erro: (e as Error).message }; }
  }
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
      // Uma academia por chamada (o limite do EVO é por conta, e várias unidades podem dividir a mesma conta).
      // O agendamento chama várias vezes de madrugada; cada vez pega quem está há mais tempo sem atualizar.
      const fin = body.modo === "fin";
      const { data: lista } = await db.from("integracoes_evo").select("academia_id, ultima_sync, ultima_tentativa, ultima_tentativa_fin");
      const { data: meio } = fin ? { data: [] as any[] } : await db.from("evo_cache").select("academia_id").eq("dia", ymd(agoraBR()));
      const pela = new Set((meio || []).map((x: any) => x.academia_id));
      const { data: fins } = fin ? await db.from("evo_dados").select("academia_id, atualizado_em").eq("chave", "financeiro") : { data: [] as any[] };
      const finEm: Record<string, string> = {}; (fins || []).forEach((x: any) => { finEm[x.academia_id] = x.atualizado_em; });
      const velho = (d: string | null | undefined, h: number) => !d || Date.now() - Date.parse(d) > h * 3600000;
      const cand = (lista || []).filter((x: any) => (fin ? velho(finEm[x.academia_id], 12) : velho(x.ultima_sync, 12)) &&
          velho(fin ? x.ultima_tentativa_fin : x.ultima_tentativa, 10 / 60))
        .sort((a: any, b: any) => (pela.has(b.academia_id) ? 1 : 0) - (pela.has(a.academia_id) ? 1 : 0) ||
          String((fin ? finEm[a.academia_id] : a.ultima_sync) || "").localeCompare(String((fin ? finEm[b.academia_id] : b.ultima_sync) || "")));
      // Uma busca por vez: se outra unidade começou há menos de 3 minutos e ainda não terminou, espera a próxima chamada (2 min depois)
      const rodando = (lista || []).some((x: any) => { const t = fin ? x.ultima_tentativa_fin : x.ultima_tentativa;
        return t && !velho(t, 3 / 60) && (fin ? velho(finEm[x.academia_id], 3 / 60) : (!x.ultima_sync || Date.parse(x.ultima_sync) < Date.parse(t))); });
      if (rodando) return resp({ resultado: [], ocupado: true });
      if (!cand.length) return resp({ resultado: [], nada: true });
      alvos = [cand[0].academia_id];
      await db.from("integracoes_evo").update(fin ? { ultima_tentativa_fin: new Date().toISOString() } : { ultima_tentativa: new Date().toISOString() }).eq("academia_id", alvos[0]);
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
      if (!cron && !String(body.modo || "").startsWith("diag") && body.modo !== "fin" && c.ultima_sync && Date.now() - Date.parse(c.ultima_sync) < 30 * 60000) {
        saida.push({ academia_id: a, erro: "Os dados foram atualizados há menos de 30 minutos. Para economizar as consultas do EVO, espere um pouco." }); continue;
      }
      const cfg: Cfg = { academia_id: a, dns: c.dns, token: c.token, calls: 0 };
      try {
        if (body.modo === "diag") { saida.push({ academia_id: a, diag: await diagnostico(cfg) }); continue; }
        if (body.modo === "diag-fin") { saida.push({ academia_id: a, diag: await sondar(cfg, body.sonda) }); continue; }
        if (body.modo === "fin") { const f = await sincronizarFinanceiro(cfg); saida.push({ academia_id: a, ok: true, financeiro: f, consultas: cfg.calls }); continue; }
        T0.v = Date.now();
        let r;
        try { r = await sincronizar(cfg); }
        catch (e) {
          if (!(e instanceof Parcial)) throw e;
          // Libera a fila para a próxima chamada continuar esta mesma academia
          if (cron) await db.from("integracoes_evo").update({ ultima_tentativa: null }).eq("academia_id", a);
          saida.push({ academia_id: a, parcial: true, consultas: cfg.calls }); continue;
        }
        await gravar(cfg, r);
        await limparCache(a);
        saida.push({ academia_id: a, ok: true, resumo: r.resumo, avisos: r.avisos, consultas: cfg.calls });
      } catch (e) {
        const msg = (e as Error).message || "Erro desconhecido.";
        await db.from("integracoes_evo").update({ ultimo_erro: msg }).eq("academia_id", a);
        saida.push({ academia_id: a, erro: msg, consultas: cfg.calls });
      } finally {
        if (cfg.calls) await db.rpc("evo_somar", { p_dns: cfg.dns, p_n: cfg.calls });
      }
    }
    return resp({ resultado: saida });
  } catch (e) {
    return resp({ erro: (e as Error).message || "Erro desconhecido." }, 500);
  }
});

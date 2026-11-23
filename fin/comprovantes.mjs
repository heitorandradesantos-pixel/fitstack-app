// FitStack · leitura de comprovantes de pagamento (PDF do banco) no navegador.
// Lê o texto do PDF (pdf.js) e tenta achar: valor, data do pagamento, quem recebeu, CNPJ/CPF, tipo e um código único.
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

let pdfjs;
async function carregarPdf() {
  if (!pdfjs) { pdfjs = await import(PDFJS); pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; }
  return pdfjs;
}

async function textoDaPagina(doc, p) {
  const pag = await doc.getPage(p);
  const c = await pag.getTextContent();
  let texto = "", ultimoY = null;
  for (const it of c.items) {
    const y = Math.round(it.transform[5]);
    texto += (ultimoY !== null && Math.abs(y - ultimoY) > 3 ? "\n" : " ") + it.str;
    ultimoY = y;
  }
  return texto.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

const so = (s) => String(s || "").replace(/\D/g, "");
const num = (s) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
const iso = (d) => { const m = String(d).match(/(\d{2})\/(\d{2})\/(\d{2,4})/); if (!m) return null; const a = m[3].length === 2 ? "20" + m[3] : m[3]; return `${a}-${m[2]}-${m[1]}`; };
const limpa = (s) => String(s || "").replace(/\s+/g, " ").replace(/^[\s:–\-|]+|[\s:–\-|]+$/g, "").trim();

const R_VALOR = /R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g;
const R_DOC = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|[\d*•.]{3,}\d{3}[\d*•.-]{3,}\d{0,2})\b/;

/** Separa o texto em blocos de "quem pagou" e "quem recebeu". */
function secoes(t) {
  const linhas = t.split("\n");
  const rec = /^(dados (do|de) (recebedor|destino|favorecido|benefici[aá]rio)|recebedor|destin(o|at[aá]rio)|favorecido|benefici[aá]rio( final)?|para|pago para|quem recebeu|conta destino|dados da conta (de )?destino)\b/i;
  const pag = /^(dados (do|de) (pagador|origem)|pagador|origem|de|quem pagou|conta origem|dados da conta (de )?origem|debitado de)\b/i;
  const out = { rec: [], pag: [] };
  let atual = null;
  for (const l of linhas) {
    const s = l.trim();
    if (rec.test(s)) { atual = "rec"; }
    else if (pag.test(s)) { atual = "pag"; }
    if (atual) out[atual].push(s);
  }
  return { ...out, rec: out.rec.join("\n"), pag: out.pag.join("\n") };
}

function nomeNoBloco(b) {
  if (!b) return null;
  // "Nome: FULANO" ou "Razão social: ..." ou primeira linha útil depois do título
  const m = b.match(/(?:nome(?: do (?:recebedor|favorecido|benefici[aá]rio))?|raz[aã]o social|nome fantasia)\s*:?\s*([^\n]{3,80})/i);
  if (m) return limpa(m[1]);
  const ls = b.split("\n").map(limpa);
  for (let i = 0; i < ls.length; i++) {
    const s = ls[i];
    const semTitulo = s.replace(/^(dados (do|de) )?(recebedor|destino|destinat[aá]rio|favorecido|benefici[aá]rio( final)?|para|pago para|quem recebeu)\s*:?\s*/i, "");
    if (semTitulo && semTitulo !== s && /[a-zA-ZÀ-ú]{3}/.test(semTitulo)) return limpa(semTitulo);
    if (i > 0 && /[a-zA-ZÀ-ú]{3}/.test(s) && !/(cpf|cnpj|institui|banco|ag[eê]ncia|conta|chave|tipo|valor|data)/i.test(s)) return s;
  }
  return null;
}

// Alguns bancos (Sicredi no app) imprimem "valor Rótulo:" na mesma linha. Vira "Rótulo: valor".
const ROTULO = /^(.+?)\s+((?:Valor|Data|Hora|N[úu]mero|C[óo]digo|Nome|Raz[ãa]o|CPF|CNPJ|Institui[cç]|Conta|Cooperativa|Autentica[cç]|Descri[cç]|Linha|Tipo|ID |Situa[cç]|Motivo|Solicitante|Realizad|Emitido|Agente|Banco|Ag[êe]ncia|Chave|Favorecido|Benefici|Pagador|Recebedor|Destinat)[^:]{0,70}):$/;
function normalizar(t) {
  return String(t || "").split("\n").map((l) => { const s = l.trim(); const m = s.match(ROTULO); return m ? m[2] + ": " + m[1] : s; }).join("\n");
}
function rotulos(t) {
  const o = [];
  for (const l of t.split("\n")) { const m = l.match(/^([^:\n]{2,70}):\s*(.*)$/); if (m) o.push([m[1].trim().toLowerCase(), m[2].trim()]); }
  return o;
}
const pega = (R, ...res) => { for (const re of res) { const x = R.find(([k, v]) => re.test(k) && v); if (x) return x[1]; } return null; };

/** Extrai os campos de um comprovante a partir do texto. */
export function extrair(texto) {
  const t = normalizar(texto);
  const R = rotulos(t);
  const out = { valor: null, data: null, recebedor: null, documento: null, tipo: "outro", codigo: null, linha: null, banco: null };
  // tipo
  if (/pagamento de funcion[aá]rios|conta sal[aá]rio/i.test(t)) out.tipo = "folha";
  else if (/comprovante de pagamento pix|\bpix\b/i.test(t)) out.tipo = "pix";
  else if (/contas de consumo|simples nacional|\bdarf\b|\bgps\b|\bfgts\b|tributo|conv[eê]nio|concession[aá]ria|arrecada[cç][aã]o/i.test(t)) out.tipo = "conta";
  else if (/\bboletos?\b|c[oó]digo de barras|linha digit[aá]vel|benefici[aá]rio/i.test(t)) out.tipo = "boleto";
  else if (/\b(ted|doc|transfer[eê]ncia)\b/i.test(t)) out.tipo = "transferencia";
  // valor: o rotulado (pago > total > do título), senão o maior R$ do texto
  const vr = pega(R, /^valor pago/, /^valor total/, /^valor \(r\$\)$/, /^valor$/, /^valor (do pagamento|da transfer[eê]ncia|do pix|cobrado|debitado)/, /^valor do t[ií]tulo/, /^valor/);
  const vm = vr && vr.match(/([\d.]+,\d{2})/);
  if (vm) out.valor = num(vm[1]);
  if (out.valor == null) {
    const rot = t.match(/valor\s*(?:total|pago|do pagamento|da transfer[eê]ncia|do pix|cobrado|debitado|a pagar)?\s*(?:\(R\$\))?\s*:?\s*(?:R\$)?\s*([\d.]+,\d{2})/i);
    if (rot) out.valor = num(rot[1]);
    else { let max = null; for (const m of t.matchAll(R_VALOR)) { const v = num(m[1]); if (v != null && (max == null || v > max)) max = v; } out.valor = max; }
  }
  // data do pagamento (nunca o vencimento, se houver outra)
  const dv = pega(R, /^data (do |de |da )?pagamento/, /^realizad[oa] em/, /^efetuad[oa] em/, /^pago em/, /^data (da |de )?(transa[cç][aã]o|transfer[eê]ncia|d[eé]bito|efetiva[cç][aã]o|opera[cç][aã]o)/, /^data e hora/, /^data$/);
  if (dv && iso(dv)) out.data = iso(dv);
  if (!out.data) {
    const MES = { jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06", jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12" };
    const dn = t.match(/\b(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s+(?:de\s+)?(\d{4})\b/i);
    const venc = pega(R, /vencimento/);
    if (dn) out.data = `${dn[3]}-${MES[dn[2].toLowerCase()]}-${dn[1].padStart(2, "0")}`;
    else { const todas = [...t.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((m) => m[1]).filter((d) => !venc || !venc.includes(d)); out.data = iso(todas[0] || venc || ""); }
  }
  // quem recebeu
  let rec = pega(R, /^raz[aã]o social (do )?benefici/, /^nome (do |da )?(destinat[aá]rio|recebedor|favorecido|benefici[aá]rio)/, /^nome fantasia (do )?benefici/, /^nome da empresa/, /^benefici[aá]rio( final)?$/, /^favorecido$/, /^recebedor$/, /^empresa$/, /^cedente$/, /^conv[eê]nio$/);
  if (!rec && /simples nacional/i.test(t)) rec = "Receita Federal - Simples Nacional";
  if (!rec && /\bdarf\b/i.test(t)) rec = "Receita Federal - DARF";
  if (!rec) {
    const sc = secoes(t); rec = nomeNoBloco(sc.rec);
    if (!rec) { const m = t.match(/(?:benefici[aá]rio|favorecido|recebedor|destinat[aá]rio|empresa|cedente|conv[eê]nio|concession[aá]ria)\s*:?\s*([^\n]{3,80})/i); if (m) rec = limpa(m[1]); }
  }
  if (rec) out.recebedor = rec.replace(/\s*(cpf|cnpj|nome fantasia|tipo de pag)\b.*$/i, "").replace(/\s{2,}/g, " ").trim().slice(0, 80) || null;
  // CNPJ/CPF de quem recebeu
  const dc = pega(R, /^cpf\/cnpj (do )?benefici/, /^(cnpj|cpf)( do| da)? (destinat|recebedor|favorecido|benefici)/, /^cpf\/cnpj (do )?(destinat|recebedor|favorecido)/);
  if (dc) out.documento = dc.trim();
  else { const sc = secoes(t); const d2 = (sc.rec.match(/(?:cpf|cnpj)[^\n\d*•]*([\d*•.\/-]{11,20})/i) || sc.rec.match(R_DOC) || [])[1]; if (d2) out.documento = d2.trim(); }
  // código de barras / linha digitável
  const lr = pega(R, /^c[oó]digo de barras/, /^linha digit[aá]vel/);
  const ld = (lr && so(lr).length >= 44) ? so(lr) : (t.replace(/\n/g, " ").match(/(\d{5}[.\s]?\d{5}\s?\d{5}[.\s]?\d{6}\s?\d{5}[.\s]?\d{6}\s?\d\s?\d{14}|8\d{11}\s?\d{12}\s?\d{12}\s?\d{12}|\d{47,48})/) || [])[1];
  if (ld) out.linha = so(ld);
  // código único do comprovante (só rótulos certos: nunca CNPJ, conta ou cooperativa)
  const cd = pega(R, /^id da transa[cç][aã]o/, /^(id|identificador)$/, /^e2e|^end to end/, /^autentica[cç][aã]o eletr[oô]nica/, /^n[uú]mero de controle/, /^c[oó]digo de autentica[cç][aã]o/, /^autentica[cç][aã]o( banc[aá]ria)?$/, /^protocolo/, /^n[uú]mero do documento/);
  if (cd && cd.replace(/[^A-Za-z0-9]/g, "").length >= 8) out.codigo = cd.replace(/[^A-Za-z0-9]/g, "");
  const bm = t.match(/(sicredi|bradesco|ita[uú]|santander|banco do brasil|caixa econ[oô]mica|nubank|nu pagamentos|inter\b|sicoob|c6 bank|mercado pago|btg|pagbank|stone|cora\b)/i);
  if (bm) out.banco = bm[1];
  out.legivel = !!(out.valor && out.data);
  return out;
}

/** Pagamento de salários em lote (um PDF com vários funcionários): um comprovante por pessoa. */
function folha(t) {
  const n = normalizar(t);
  const blocos = n.split(/(?=^N[úu]mero de Controle:)/m).filter((b) => /^N[úu]mero de Controle:/i.test(b));
  return blocos.map((b, i) => {
    const R = rotulos(b), v = pega(R, /^valor/), d = pega(R, /^data (do |de )?pagamento/);
    const nome = pega(R, /^nome$/), cpf = pega(R, /^cpf$/), ctl = pega(R, /^n[uú]mero de controle/);
    const valor = v && v.match(/([\d.]+,\d{2})/) ? num(v.match(/([\d.]+,\d{2})/)[1]) : null;
    const campos = { valor, data: d ? iso(d) : null, recebedor: nome, documento: cpf, tipo: "folha", codigo: ctl ? so(ctl) : null, linha: null, banco: "Sicredi",
      situacao: pega(R, /^situa[cç][aã]o/) || "" };
    campos.legivel = !!(campos.valor && campos.data);
    return { pagina: i + 1, campos };
  }).filter((x) => x.campos.valor != null);
}

/** Recebe o texto de cada página e devolve a lista de comprovantes. */
export function lerTextos(paginas) {
  const tudo = paginas.join("\n");
  if (/pagamento de funcion[aá]rios|conta sal[aá]rio por grupo/i.test(tudo)) {
    const f = folha(tudo);
    if (f.length) return f.map((x) => ({ ...x, paginas: paginas.length, lote: f.length }));
  }
  const itens = paginas.map((tx, i) => ({ pagina: i + 1, texto: tx, campos: extrair(tx) }));
  // Se só uma página tem valor, é um comprovante só (as outras são continuação)
  const comValor = itens.filter((x) => x.campos.valor != null);
  if (comValor.length <= 1) return [{ pagina: 1, paginas: paginas.length, texto: tudo, campos: extrair(tudo) }];
  return comValor.map((x) => ({ ...x, paginas: paginas.length }));
}

/** Lê um PDF e devolve os comprovantes que estão nele. */
export async function lerPdf(arquivo) {
  const lib = await carregarPdf();
  const doc = await lib.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const paginas = [];
  for (let p = 1; p <= Math.min(doc.numPages, 40); p++) paginas.push(await textoDaPagina(doc, p));
  return lerTextos(paginas);
}

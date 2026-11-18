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

/** Extrai os campos de um comprovante a partir do texto. */
export function extrair(texto) {
  const t = String(texto || "");
  const tl = t.toLowerCase();
  const out = { valor: null, data: null, recebedor: null, documento: null, tipo: "outro", codigo: null, linha: null, banco: null };
  // tipo
  if (/\bpix\b/i.test(t)) out.tipo = "pix";
  else if (/conv[eê]nio|concession[aá]ria|arrecada[cç][aã]o|tributo|darf\b|\bgps\b/i.test(t)) out.tipo = "conta";
  else if (/boleto|c[oó]digo de barras|linha digit[aá]vel|benefici[aá]rio/i.test(t)) out.tipo = "boleto";
  else if (/\b(ted|doc|transfer[eê]ncia)\b/i.test(t)) out.tipo = "transferencia";
  else if (/conv[eê]nio|tributo|darf|das\b|gps|fgts|concession[aá]ria|energia|[aá]gua|telefone/i.test(t)) out.tipo = "conta";
  // valor: primeiro o rotulado, senão o maior R$ do texto
  const rot = t.match(/valor\s*(?:total|pago|do pagamento|da transfer[eê]ncia|do pix|cobrado|debitado|a pagar)?\s*:?\s*R\$\s*([\d.]+,\d{2})/i);
  if (rot) out.valor = num(rot[1]);
  else { let max = null; for (const m of t.matchAll(R_VALOR)) { const v = num(m[1]); if (v != null && (max == null || v > max)) max = v; } out.valor = max; }
  // data do pagamento
  const dr = t.match(/(?:data(?: e hora)?(?: do| da| de)? ?(?:pagamento|transa[cç][aã]o|transfer[eê]ncia|d[eé]bito|efetiva[cç][aã]o|opera[cç][aã]o)?|pago em|realizad[oa] em|efetuad[oa] em)\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  const vencRe = /vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i;
  const MES = { jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06", jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12" };
  const dn = t.match(/\b(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s+(?:de\s+)?(\d{4})\b/i);
  if (dr) out.data = iso(dr[1]);
  else if (dn) out.data = `${dn[3]}-${MES[dn[2].toLowerCase()]}-${dn[1].padStart(2, "0")}`;
  else { const venc = (t.match(vencRe) || [])[1]; const todas = [...t.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((m) => m[1]).filter((d) => d !== venc); out.data = iso(todas[0] || venc || ""); }
  // quem recebeu
  const sc = secoes(t);
  out.recebedor = nomeNoBloco(sc.rec);
  if (!out.recebedor) {
    const m = t.match(/(?:benefici[aá]rio|favorecido|recebedor|destinat[aá]rio|nome do recebedor|empresa|cedente|conv[eê]nio|concession[aá]ria)\s*:?\s*([^\n]{3,80})/i);
    if (m) out.recebedor = limpa(m[1]);
  }
  if (out.recebedor) out.recebedor = out.recebedor.replace(/\s*(cpf|cnpj)\s*:?.*$/i, "").replace(/\s{2,}/g, " ").slice(0, 80) || null;
  // CNPJ/CPF de quem recebeu
  const docRec = (sc.rec.match(/(?:cpf|cnpj)[^\n\d*•]*([\d*•.\/-]{11,20})/i) || sc.rec.match(R_DOC) || [])[1];
  if (docRec) out.documento = docRec.trim();
  // linha digitável (boleto) e código único do comprovante
  const ld = t.replace(/\n/g, " ").match(/(\d{5}[.\s]?\d{5}\s?\d{5}[.\s]?\d{6}\s?\d{5}[.\s]?\d{6}\s?\d\s?\d{14}|8\d{11}\s?\d{12}\s?\d{12}\s?\d{12}|\d{47,48})/);
  if (ld) out.linha = so(ld[1]);
  const cod = t.match(/(?:id(?:entificador)?(?: da transa[cç][aã]o)?|c[oó]digo de autentica[cç][aã]o|autentica[cç][aã]o(?: banc[aá]ria| eletr[oô]nica)?|n[uú]mero de controle|e2e|end to end|protocolo|n[ºo°]\.? ?(?:do )?documento)\s*:?\s*([A-Za-z0-9.\-]{10,})/i);
  if (cod) out.codigo = cod[1].replace(/[.\-]/g, "");
  const bm = t.match(/(bradesco|ita[uú]|santander|banco do brasil|caixa econ[oô]mica|nubank|nu pagamentos|inter\b|sicoob|sicredi|c6 bank|mercado pago|btg|pagbank|stone|cora\b)/i);
  if (bm) out.banco = bm[1];
  out.legivel = !!(out.valor || out.data);
  return out;
}

/** Lê um PDF e devolve um comprovante por página (bancos às vezes juntam vários num arquivo só). */
export async function lerPdf(arquivo) {
  const lib = await carregarPdf();
  const doc = await lib.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const paginas = [];
  for (let p = 1; p <= Math.min(doc.numPages, 40); p++) paginas.push(await textoDaPagina(doc, p));
  const itens = paginas.map((tx, i) => ({ pagina: i + 1, texto: tx, campos: extrair(tx) }));
  // Se só a primeira página tem valor, é um comprovante só (as outras são continuação)
  const comValor = itens.filter((x) => x.campos.valor != null);
  if (comValor.length <= 1) {
    const tudo = paginas.join("\n");
    return [{ pagina: 1, paginas: doc.numPages, texto: tudo, campos: extrair(tudo) }];
  }
  return comValor.map((x) => ({ ...x, paginas: doc.numPages }));
}

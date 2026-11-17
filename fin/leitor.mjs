// Leitura de boletos em arquivo (PDF ou foto). Cópia adaptada do O Verificador para o FitStack (sem leitura por IA).
// Ordem: 1) PDF com texto: lido aqui no navegador (pdf.js); 2) código de barras ou QR Pix na imagem (BarcodeDetector/jsQR);
// 3) só se nada disso der certo, a imagem vai para /api/ler-boleto (leitura por IA, sem guardar o arquivo).
// O resultado vira as mesmas linhas "código ; empresa ; valor ; CNPJ ; vencimento" que o verificador já confere.
import { BANCOS, validaCNPJ } from "./motor.mjs";

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
const JSQR = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
const so = (s) => String(s || "").replace(/\D/g, "");

// ---------------------------------------------------------------- texto do boleto → campos
export function camposDoTexto(texto) {
  const t = String(texto || "").replace(/ /g, " ");
  const codigos = [];
  const add = (c) => { if (c && !codigos.includes(c)) codigos.push(c); };
  // linha digitável do boleto bancário: 5.5 5.6 5.6 1 14 (pontos e espaços opcionais)
  for (const m of t.matchAll(/\b(\d{5})[.\s]?(\d{5})\s*(\d{5})[.\s]?(\d{6})\s*(\d{5})[.\s]?(\d{6})\s*(\d)\s*(\d{14})\b/g)) add(m.slice(1).join(""));
  // arrecadação (contas de consumo e tributos): 4 blocos de 11 + DV
  for (const m of t.matchAll(/\b(8\d{10})[-\s]?(\d)\s+(\d{11})[-\s]?(\d)\s+(\d{11})[-\s]?(\d)\s+(\d{11})[-\s]?(\d)\b/g)) add(m.slice(1).join(""));
  // Pix copia e cola embutido (boleto híbrido)
  for (const m of t.matchAll(/000201[\x21-\x7e ]{20,500}?6304[0-9A-Fa-f]{4}/g)) add(m[0].replace(/\s+/g, " ").trim());

  const depois = (rotulo, padrao, janela = 160) => {
    const i = t.search(rotulo); if (i < 0) return null;
    const m = t.slice(i, i + janela).match(padrao); return m ? m[1] : null;
  };
  const cnpjs = [...t.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)].map((m) => so(m[1])).filter(validaCNPJ);
  const cnpjBenef = so(depois(/benefici[aá]rio|cedente/i, /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/, 400)) || null;
  let beneficiario = depois(/benefici[aá]rio(?:\s*final)?\s*[:\-]?/i, /benefici[aá]rio(?:\s*final)?\s*[:\-]?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .,&'\-\/]{3,80}?)(?=\s{2,}|\s*(?:CNPJ|CPF|\d{2}\.\d{3})|\n|$)/i, 200);
  if (beneficiario) beneficiario = beneficiario.replace(/\s+/g, " ").trim();
  const valores = [...t.matchAll(/valor\s+(?:do\s+)?documento[^\d]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/gi)].map((m) => m[1]);
  const valor = valores.length && valores.every((v) => v === valores[0]) ? valores[0] : null;
  const vencs = [...t.matchAll(/vencimento[^\d]{0,30}(\d{2}\/\d{2}\/\d{4})/gi)].map((m) => m[1]);
  const vencimento = vencs.length && vencs.every((v) => v === vencs[0]) ? vencs[0] : null;
  const bancoImpresso = (t.match(/\b(\d{3})-[\dXx]\b/) || [])[1];
  return { codigos, beneficiario: beneficiario || null, cnpj: cnpjBenef && validaCNPJ(cnpjBenef) ? cnpjBenef : (cnpjs.length === 1 ? cnpjs[0] : null),
    valor, vencimento, banco: bancoImpresso && BANCOS[bancoImpresso] ? BANCOS[bancoImpresso] : null };
}

export function paraLinha(c, codigo) {
  const ehPix = codigo.startsWith("000201");
  return [codigo, c.beneficiario || "", ehPix ? "" : c.valor || "", c.cnpj || "", ehPix ? "" : c.vencimento || ""].join(" ; ").replace(/( ; )+$/, "");
}

// ---------------------------------------------------------------- PDF
let pdfjs;
async function carregarPdf() {
  if (!pdfjs) { pdfjs = await import(PDFJS); pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; }
  return pdfjs;
}
async function textoDoPdf(doc) {
  let texto = "";
  for (let p = 1; p <= Math.min(doc.numPages, 6); p++) {
    const pag = await doc.getPage(p);
    const c = await pag.getTextContent();
    let ultimoY = null;
    for (const it of c.items) {
      const y = Math.round(it.transform[5]);
      texto += (ultimoY !== null && Math.abs(y - ultimoY) > 3 ? "\n" : " ") + it.str;
      ultimoY = y;
    }
    texto += "\n";
  }
  return texto;
}
async function imagemDoPdf(doc) {
  const pag = await doc.getPage(1);
  const vp = pag.getViewport({ scale: 2 });
  const cv = document.createElement("canvas");
  cv.width = vp.width; cv.height = vp.height;
  await pag.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
  return cv;
}

// ---------------------------------------------------------------- imagem
async function canvasDaImagem(arquivo) {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * escala); cv.height = Math.round(bmp.height * escala);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv;
}
async function codigosNaImagem(cv) {
  const achados = [];
  if ("BarcodeDetector" in window) {
    try {
      const formatos = await BarcodeDetector.getSupportedFormats();
      const det = new BarcodeDetector({ formats: ["itf", "qr_code"].filter((f) => formatos.includes(f)) });
      for (const b of await det.detect(cv)) {
        const v = String(b.rawValue || "").trim();
        if (b.format === "itf" && so(v).length === 44) achados.push(so(v));
        if (v.startsWith("000201")) achados.push(v);
      }
    } catch (e) {}
  }
  if (!achados.length) {
    try {
      if (!window.jsQR) await new Promise((ok, erro) => { const s = document.createElement("script"); s.src = JSQR; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
      const ctx = cv.getContext("2d"), img = ctx.getImageData(0, 0, cv.width, cv.height);
      const qr = window.jsQR(img.data, cv.width, cv.height);
      if (qr && qr.data.startsWith("000201")) achados.push(qr.data.trim());
    } catch (e) {}
  }
  return achados;
}
async function lerComIA(cv) {
  // No FitStack não há leitura por IA: se o código não aparecer no arquivo, a pessoa cola o código.
  return { erro: "Não achamos o código neste arquivo." };
}

/** Lê um arquivo e devolve {linhas: [{linha, origem}], resumo, erro} */
export async function lerArquivo(arquivo) {
  const nome = arquivo.name || "arquivo";
  try {
    let cv = null;
    if (arquivo.type === "application/pdf" || /\.pdf$/i.test(nome)) {
      const lib = await carregarPdf();
      const doc = await lib.getDocument({ data: await arquivo.arrayBuffer() }).promise;
      const c = camposDoTexto(await textoDoPdf(doc));
      if (c.codigos.length) return { linhas: c.codigos.map((cod) => ({ linha: paraLinha(c, cod), origem: "pdf" })), campos: c };
      cv = await imagemDoPdf(doc); // PDF escaneado: segue como imagem
    } else if (/^image\//.test(arquivo.type)) {
      cv = await canvasDaImagem(arquivo);
    } else return { linhas: [], erro: `${nome}: envie PDF, JPG ou PNG.` };

    const locais = await codigosNaImagem(cv);
    if (locais.length) return { linhas: locais.map((cod) => ({ linha: cod, origem: "imagem" })), campos: {} };
    const ia = await lerComIA(cv);
    if (ia.erro) return { linhas: [], erro: `${nome}: ${ia.erro} Cole o código abaixo.` };
    const c = { beneficiario: ia.beneficiario, cnpj: so(ia.cnpj_beneficiario) || null, valor: ia.valor, vencimento: ia.vencimento,
      banco: null, codigos: [ia.linha_digitavel, ia.pix_copia_cola].filter(Boolean) };
    if (!c.codigos.length) return { linhas: [], erro: `${nome}: não achamos o código do boleto nem um Pix. Cole o código abaixo.` };
    return { linhas: c.codigos.map((cod) => ({ linha: paraLinha(c, cod), origem: "ia" })), campos: c };
  } catch (e) {
    return { linhas: [], erro: `${nome}: não conseguimos abrir o arquivo. Cole o código abaixo.` };
  }
}

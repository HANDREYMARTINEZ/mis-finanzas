// Regenera las 7 capturas del README de mis-finanzas.
// Uso (con `npm run dev` corriendo en :5173):
//   npm i --no-save puppeteer-core
//   node scripts/capturas.mjs docs/screenshots
// Usa Edge (no hay Chrome en la máquina de desarrollo) y una fecha fija para que el mes tenga datos.
import puppeteer from "puppeteer-core";

const OUT  = process.argv[2];
const URL  = "http://localhost:5173/";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

// Fecha fija: a fin de mes el "mes en curso" tiene datos y las capturas se ven naturales.
const FIXED = new Date(2026, 9, 24, 10, 0, 0).getTime();
const d = (m, day) => `2026-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

const SEED = {
  version: 1,
  cards: [
    { id: 1, name: "Bancolombia", bank: "Bancolombia", type: "ahorros",  used: 3250000, logo: "bancolombia", color: "#fbbf24" },
    { id: 2, name: "Nu",          bank: "Nu",          type: "ahorros",  used: 1180000, logo: "estrella",    color: "#818cf8" },
    { id: 3, name: "Nequi",       bank: "Nequi",       type: "debito",   used: 485000,  logo: "nequi",       color: "#f472b6" },
    { id: 4, name: "Efectivo",    bank: "",            type: "efectivo", used: 220000,  logo: "efectivo",    color: "#fbbf24" },
    { id: 5, name: "Visa Oro",    bank: "BBVA",        type: "credito",  limit: 5000000, used: 1450000, logo: "bbva", color: "#60a5fa" },
  ],
  transactions: [
    { id: 10, type: "income",  amount: 4200000, category: "Salario",         note: "Nómina",         date: d(9,1),   accountId: 1, method: "Transferencia" },
    { id: 11, type: "expense", amount: 1100000, category: "Vivienda",        note: "Arriendo",       date: d(9,2),   accountId: 1, method: "PSE / Transferencia" },
    { id: 12, type: "expense", amount: 410000,  category: "Alimentación",    note: "Mercado",        date: d(9,6),   accountId: 1, method: "Tarjeta débito" },
    { id: 13, type: "expense", amount: 230000,  category: "Transporte",      note: "Gasolina",       date: d(9,14),  accountId: 2, method: "Tarjeta débito" },
    { id: 14, type: "expense", amount: 180000,  category: "Entretenimiento", note: "Concierto",      date: d(9,20),  accountId: 3, method: "QR / Nequi" },
    { id: 15, type: "income",  amount: 4200000, category: "Salario",         note: "Nómina",         date: d(10,1),  accountId: 1, method: "Transferencia" },
    { id: 16, type: "expense", amount: 1100000, category: "Vivienda",        note: "Arriendo",       date: d(10,2),  accountId: 1, method: "PSE / Transferencia" },
    { id: 17, type: "expense", amount: 320000,  category: "Alimentación",    note: "Mercado",        date: d(10,5),  accountId: 1, method: "Tarjeta débito" },
    { id: 18, type: "expense", amount: 120000,  category: "Salud",           note: "Consulta",       date: d(10,9),  accountId: 2, method: "Tarjeta débito" },
    { id: 19, type: "expense", amount: 85000,   category: "Transporte",      note: "Gasolina",       date: d(10,12), accountId: 2, method: "Tarjeta débito" },
    { id: 20, type: "income",  amount: 650000,  category: "Freelance",       note: "Diseño de logo", date: d(10,15), accountId: 2, method: "Transferencia" },
    { id: 22, type: "expense", amount: 160000,  category: "Alimentación",    note: "Restaurante",    date: d(10,19), accountId: 3, method: "QR / Nequi" },
    { id: 23, type: "income",  amount: 10000,   category: "Intereses",       note: "Interés préstamo — Camilo", date: d(10,20), accountId: null },
    { id: 24, type: "expense", amount: 45000,   category: "Entretenimiento", note: "Cine",           date: d(10,23), accountId: 3, method: "QR / Nequi" },
    { id: 25, type: "expense", amount: 28000,   category: "Alimentación",    note: "Almuerzo",       date: d(10,24), accountId: 4, method: "Efectivo" },
    { id: 26, type: "expense", amount: 12000,   category: "Transporte",      note: "Bus",            date: d(10,24), accountId: 4, method: "Efectivo" },
  ],
  transfers: [
    { id: 21, from: 1, to: 2, amount: 500000, note: "Ahorro del mes",   date: d(10,16) },
    { id: 27, from: 1, to: 4, amount: 200000, note: "Retiro en cajero", date: d(10,24) },
  ],
  loans: [
    { id: 30, debtor: "Camilo", amount: 500000, interest: 2, interestType: "simple", months: 6, date: d(8,20), note: "", account: 1, paid: false, received: 280000, paidCuotas: 0 },
    { id: 31, debtor: "Laura",  amount: 370000, interest: 0, interestType: "simple", months: 3, date: d(10,10), note: "", account: 3, paid: false, received: 0, paidCuotas: 0 },
  ],
  debts: [
    { id: 32, lender: "Mamá", amount: 300000, interest: 0, interestType: "simple", months: 3, date: d(9,25), note: "", account: 1, paid: false, paidAmt: 100000 },
  ],
  creditPlans: [
    { id: 33, cardId: 5, category: "Tecnología", note: "Celular", total: 1200000, cuotas: 6, cuotasPaid: 2, cuotaAmount: 200000, date: d(8,28) },
  ],
  budgets: { "Alimentación": 600000, "Transporte": 250000, "Entretenimiento": 150000 },
  goals: [
    { id: 34, name: "Fondo de emergencia", target: 6000000, saved: 2100000 },
    { id: 35, name: "Viaje a Cartagena",   target: 2500000, saved: 900000 },
  ],
  recurringTx: [],
  nextId: 100,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument(fixed => {
  const RD = Date;
  class FD extends RD {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  }
  window.Date = FD;
}, FIXED);

// La trampa: el useEffect de persistencia escribe el estado vacío al montar.
// Cargar, esperar el montaje, sembrar y recién ahí recargar.
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(800);
await page.evaluate(s => localStorage.setItem("finanzas.v1", JSON.stringify(s)), SEED);
await page.reload({ waitUntil: "networkidle0" });
await sleep(800);

const click = async text => {
  const ok = await page.evaluate(t => {
    const b = [...document.querySelectorAll("button")].find(x => x.getAttribute("aria-label") === t || x.innerText.trim().toLowerCase() === t.toLowerCase());
    if (b) { b.click(); return true; } return false;
  }, text);
  if (!ok) throw new Error("No encontré el botón: " + text);
  await sleep(500);
};
const shot = async name => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1300);   // animaciones de Recharts y transiciones de la barra
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("ok", name);
};

await shot("01-dashboard");
await click("Movimientos");  await shot("02-movimientos");
await click("Stats");        await shot("03-estadisticas");
await click("Cuentas");      await shot("04-cuentas");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.includes("Salud del crédito")).click());
await sleep(500);            await shot("05-credito");
await click("← Atrás");
await click("Préstamos");    await shot("06-prestamos");

// Mover fondos: Bancolombia → Efectivo
await click("Inicio");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Mover" && b.style.height === "72px").click());
await sleep(500);
await page.type('input[placeholder="0"]', "200000");
await page.evaluate(() => {
  const chips = n => [...document.querySelectorAll("button")].filter(b => b.innerText.startsWith(n) || b.innerText.includes("\n"+n) || b.innerText.includes(n+"\n"));
  chips("Bancolombia")[0].click();
});
await sleep(300);
await page.evaluate(() => {
  const ef = [...document.querySelectorAll("button")].filter(b => /Efectivo/.test(b.innerText) && b.querySelector("span"));
  ef[ef.length-1].click();
});
await sleep(300);
await page.type('input[placeholder="Ej: retiro en cajero"]', "Retiro en cajero");
await shot("07-agregar");

await browser.close();

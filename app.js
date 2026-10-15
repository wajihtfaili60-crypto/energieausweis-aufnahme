/* HK Aufnahme – Datenaufnahme für Energieausweise am Handy, Export als EVEBI-Projekt (.evex).
 * Eingegeben wird nur, was EVEBI nicht selbst ermittelt. Alles andere (Hülle aus den Maßen,
 * Volumen, AN, Bundesland, Vollgeschosse, Empfehlungen …) rechnet die App automatisch („A“).
 * Alle Daten bleiben im Browser des Geräts (localStorage). */
(function () {
  "use strict";
  const G = window.EvexGen;
  const V = window.EVEX_VORLAGE;
  const SP_PROJEKTE = "hkAufnahme.projekte.v1";
  const SP_AUSSTELLER = "hkAufnahme.aussteller.v1";
  const app = document.getElementById("app");
  const titelEl = document.getElementById("titel");
  const zurueckEl = document.getElementById("zurueck");
  const ART = G.BAUTEILARTEN;

  // ------------------------------------------------------------ Hilfen
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const zahl = (x, d = 0) => { if (x === "" || x == null) return d; const v = typeof x === "string" ? Number(x.replace(/\s/g, "").replace(",", ".")) : Number(x); return Number.isFinite(v) ? v : d; };
  const de = (x, n = 2) => Number.isFinite(x) ? x.toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n }) : "–";
  const neueId = () => Math.random().toString(36).slice(2, 9);
  const kopie = o => JSON.parse(JSON.stringify(o));
  const komma = x => String(x).replace(".", ",");

  // ------------------------------------------------------------ Symbole
  const I = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    weg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
    hoch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 14l6-6 6 6"/></svg>',
    kopie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/></svg>',
    pfeil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>',
    teilen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    haus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
    objekt: '<svg viewBox="0 0 24 24" fill="none" stroke="#2a63c2" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    gebaeude: '<svg viewBox="0 0 24 24" fill="none" stroke="#b5452a" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
    masse: '<svg viewBox="0 0 24 24" fill="none" stroke="#3f7310" stroke-width="2" stroke-linecap="round"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',
    aufbauten: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="4" height="18" rx="1" fill="#d9d6cc"/><rect x="8" y="3" width="5" height="18" rx="1" fill="#b5583f"/><rect x="14" y="3" width="4" height="18" rx="1" fill="#f2d35b"/><rect x="19" y="3" width="2" height="18" rx="1" fill="#9aa3a8"/></svg>',
    fenster: '<svg viewBox="0 0 24 24" fill="none" stroke="#2a63c2" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/></svg>',
    huelle: '<svg viewBox="0 0 24 24" fill="none" stroke="#5d6a52" stroke-width="2" stroke-linejoin="round"><path d="M3 10l9-6 9 6v11H3z"/><rect x="7" y="12" width="4" height="4" fill="#8cc21f" stroke="none"/><rect x="13" y="12" width="4" height="4" fill="#8cc21f" stroke="none"/></svg>',
    heizung: '<svg viewBox="0 0 24 24" fill="none" stroke="#d6353d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-3.9 0-6-2.6-6-5.6 0-3.4 3-5.4 3.5-9.4 2.4 1.6 3.4 3.4 3.5 5.4 1-1 1.5-2.2 1.6-3.4 2 1.8 3.4 4.2 3.4 7.2 0 3.2-2.1 5.8-6 5.8z"/></svg>',
    ausweis: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="3" rx="1" fill="#2e9e48"/><rect x="3" y="8.5" width="14" height="3" rx="1" fill="#e7bd22"/><rect x="3" y="13" width="10" height="3" rx="1" fill="#ee8a2a"/><rect x="3" y="17.5" width="7" height="3" rx="1" fill="#d6353d"/></svg>',
    foto: '<svg viewBox="0 0 24 24" fill="none" stroke="#5d6a52" stroke-width="2" stroke-linejoin="round"><path d="M4 7h4l2-2h4l2 2h4v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    waermepumpe: '<svg viewBox="0 0 24 24" fill="none" stroke="#2a63c2" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="10" cy="12" r="4"/><path d="M10 8v8M6 12h8M17 9v6"/></svg>',
  };
  const P = {
    frei: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10 15l10-9 10 9v12H10z"/></svg>',
    dhh: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 15l8-8 8 8v12H4z" fill="currentColor" fill-opacity=".25"/><path d="M20 15l8-8 8 8v12H20z" stroke-dasharray="3 2"/></svg>',
    reihe: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M1 16l6-6 6 6v11H1z" stroke-dasharray="3 2"/><path d="M14 16l6-6 6 6v11H14z" fill="currentColor" fill-opacity=".25"/><path d="M27 16l6-6 6 6v11H27z" stroke-dasharray="3 2"/></svg>',
    kKein: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 6h20v15H10z"/><path d="M4 21h32" stroke-width="3"/></svg>',
    kUnbeh: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2h20v14H10z"/><path d="M4 16h32" stroke-width="3"/><path d="M10 16v12h20V16" stroke-dasharray="3 2"/></svg>',
    kBeh: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2h20v14H10z"/><path d="M4 16h32" stroke-width="3"/><path d="M10 16v12h20V16z" fill="currentColor" fill-opacity=".25"/></svg>',
    dOgd: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 14l12-10 12 10" stroke-dasharray="3 2"/><path d="M8 14h24" stroke-width="3"/><path d="M10 14v14h20V14" fill="currentColor" fill-opacity=".25"/></svg>',
    dBeh: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 14l12-10 12 10v14H8z" fill="currentColor" fill-opacity=".25"/></svg>',
    dFlach: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7h24" stroke-width="3"/><path d="M10 7v21h20V7" fill="currentColor" fill-opacity=".25"/></svg>',
    hk: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="7" width="28" height="16" rx="2"/><path d="M12 7v16M18 7v16M24 7v16M30 7v16"/></svg>',
    fbh: '<svg viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 22h32"/><path d="M8 18c3 0 3-4 6-4s3 4 6 4 3-4 6-4 3 4 6 4"/></svg>',
  };

  // ------------------------------------------------------------ Fachlisten
  const BUNDESLAENDER = [["BL_BW", "Baden-Württemberg"], ["BL_BY", "Bayern"], ["BL_BE", "Berlin"], ["BL_BB", "Brandenburg"], ["BL_HB", "Bremen"],
    ["BL_HH", "Hamburg"], ["BL_HE", "Hessen"], ["BL_MV", "Mecklenburg-Vorpommern"], ["BL_NI", "Niedersachsen"], ["BL_NW", "Nordrhein-Westfalen"],
    ["BL_RP", "Rheinland-Pfalz"], ["BL_SL", "Saarland"], ["BL_SN", "Sachsen"], ["BL_ST", "Sachsen-Anhalt"], ["BL_SH", "Schleswig-Holstein"], ["BL_TH", "Thüringen"]];
  const BL_NAME = Object.fromEntries(BUNDESLAENDER);
  const ANLASS = [["AG_VERMIETUNG", "Vermietung / Verkauf"], ["AG_MODERNISIERUNG", "Modernisierung"], ["AG_SONST", "Sonstiges"]];
  const RAHMEN = [["RMAT_RAHMEN_KST", "Kunststoff"], ["RMAT_RAHMEN_HOLZ", "Holz"], ["RMAT_RAHMEN_ALUMINIUM", "Aluminium"], ["RMAT_RAHMEN_HOLZ_ALU", "Holz-Alu"]];
  const FENSTERART = [["FART_STANDARD", "Fenster"], ["FART_AUSSENTUER", "Haustür"], ["FART_DACHFENSTER", "Dachfenster"]];
  const GRUPPEN = [["wand", "Wände"], ["dach", "Dach & oberste Decke"], ["boden", "Boden & Keller"]];
  const KOMPASS = [["NW", 315], ["N", 0], ["NO", 45], ["W", 270], null, ["O", 90], ["SW", 225], ["S", 180], ["SO", 135]];
  const KURZ = { 0: "N", 45: "NO", 90: "O", 135: "SO", 180: "S", 225: "SW", 270: "W", 315: "NW" };
  const norm = g => ((Math.round(zahl(g, 180)) % 360) + 360) % 360;

  // λ-Richtwerte nach DIN 4108-4 / DIN EN ISO 10456 – bei Bedarf anpassbar
  const BAUSTOFFE = [
    ["putz", "Putz & Bekleidung", [["Kalkgipsputz", 0.70, 1400], ["Gipsputz", 0.51, 1200], ["Kalkzementputz", 1.00, 1800], ["Leichtputz", 0.56, 1300],
      ["Gipskartonplatte", 0.25, 900], ["Holzwolle-Leichtbauplatte", 0.09, 400], ["Fliesen", 1.30, 2300]]],
    ["mauer", "Mauerwerk", [["Kalksandstein (ρ 1800)", 0.99, 1800], ["Kalksandstein (ρ 1400)", 0.70, 1400], ["Vollziegel (ρ 1800)", 0.81, 1800],
      ["Vormauerziegel / Klinker", 0.96, 2000], ["Hochlochziegel alt (ρ 1200)", 0.50, 1200], ["Hochlochziegel alt (ρ 1400)", 0.58, 1400],
      ["Wärmedämmziegel (λ 0,12)", 0.12, 700], ["Porenbeton (ρ 500)", 0.16, 500], ["Porenbeton alt (ρ 600)", 0.22, 600],
      ["Leichtbeton-Hohlblock / Bims", 0.45, 1000], ["Natursandstein", 2.30, 2300]]],
    ["beton", "Beton & Estrich", [["Stahlbeton", 2.30, 2400], ["Beton unbewehrt", 1.65, 2200], ["Zementestrich", 1.40, 2000], ["Anhydritestrich", 1.20, 2100],
      ["Gussasphaltestrich", 0.70, 2300], ["Trockenestrich (Gipsfaser)", 0.32, 1150]]],
    ["daemm", "Dämmstoffe", [["Mineralwolle WLS 032", 0.032, 30], ["Mineralwolle WLS 035", 0.035, 30], ["Mineralwolle WLS 040", 0.040, 30],
      ["Mineralwolle WLS 045", 0.045, 30], ["EPS WLS 032", 0.032, 20], ["EPS WLS 035", 0.035, 20], ["EPS WLS 040", 0.040, 20],
      ["XPS WLS 035", 0.035, 35], ["PUR/PIR WLS 024", 0.024, 30], ["PUR/PIR WLS 028", 0.028, 30], ["Holzfaser WLS 040", 0.040, 160],
      ["Zellulose WLS 040", 0.040, 50], ["Perlite-Schüttung", 0.060, 100], ["Kork WLS 045", 0.045, 120]]],
    ["holz", "Holz & Platten", [["Nadelholz / Dielen", 0.13, 500], ["OSB-Platte", 0.13, 650], ["Spanplatte", 0.14, 700], ["Holzschalung", 0.13, 500]]],
    ["sonst", "Sonstiges", [["Bitumenbahn", 0.17, 1100], ["Dachziegel / Dachstein", 1.00, 2000]]],
  ];
  const BAUSTOFF = {};
  for (const [gr, , l] of BAUSTOFFE) for (const [n, la, r] of l) BAUSTOFF[n] = { lambda: la, rho: r, gruppe: gr };
  const LUFT = "Luftschicht, ruhend";
  const farbe = s => s.luft ? "m-luft" : "m-" + ((BAUSTOFF[s.name] || {}).gruppe || (zahl(s.lambda) && zahl(s.lambda) < 0.07 ? "daemm" : "sonst"));

  const KONSTR_VORLAGEN = [
    { name: "Zweischaliges Mauerwerk, Luftschicht ungedämmt", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Kalksandstein (ρ 1800)", 17.5], [LUFT, 6], ["Vormauerziegel / Klinker", 11.5]] },
    { name: "Zweischaliges Mauerwerk mit Kerndämmung", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Kalksandstein (ρ 1800)", 17.5], ["Mineralwolle WLS 035", 6], ["Vormauerziegel / Klinker", 11.5]] },
    { name: "Hochlochziegel 30 cm, verputzt", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Hochlochziegel alt (ρ 1200)", 30], ["Kalkzementputz", 2]] },
    { name: "Kalksandstein + WDVS 14 cm", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Kalksandstein (ρ 1800)", 17.5], ["EPS WLS 035", 14], ["Leichtputz", 1]] },
    { name: "Betondecke, 5 cm Dämmung", typ: "dach", s: [["Kalkgipsputz", 1], ["Stahlbeton", 16], ["Mineralwolle WLS 040", 5]] },
    { name: "Holzbalkendecke, 10 cm Mineralwolle", typ: "dach", s: [["Gipskartonplatte", 1.25], ["Mineralwolle WLS 040", 10], ["Nadelholz / Dielen", 2.4]] },
    { name: "Steildach, 14 cm Zwischensparren", typ: "dach", s: [["Gipskartonplatte", 1.25], ["Mineralwolle WLS 035", 14]] },
    { name: "Bodenplatte ungedämmt", typ: "boden", s: [["Zementestrich", 5], ["Stahlbeton", 15]] },
    { name: "Bodenplatte, 4 cm Dämmung", typ: "boden", s: [["Zementestrich", 5], ["EPS WLS 040", 4], ["Stahlbeton", 15]] },
    { name: "Kellerdecke ungedämmt", typ: "boden", s: [["Zementestrich", 4], ["Stahlbeton", 16]] },
    { name: "Kellerdecke, 10 cm Dämmung unten", typ: "boden", s: [["Zementestrich", 4], ["Stahlbeton", 16], ["Mineralwolle WLS 035", 10]] },
  ];
  const FENSTER_VORLAGEN = [
    { name: "Einfachverglasung", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_HOLZ", uw: "5,0", g: "0,87" },
    { name: "Isolierverglasung 2-fach (1978–94)", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "2,7", g: "0,76" },
    { name: "2-fach-Wärmeschutz (1995–2007)", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "1,6", g: "0,60" },
    { name: "2-fach-Wärmeschutz (ab 2008)", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "1,3", g: "0,60" },
    { name: "3-fach-Wärmeschutz", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "0,9", g: "0,50" },
    { name: "Haustür Bestand", art: "FART_AUSSENTUER", rahmen: "RMAT_RAHMEN_HOLZ", uw: "2,9", g: "0,50" },
    { name: "Haustür neu, gedämmt", art: "FART_AUSSENTUER", rahmen: "RMAT_RAHMEN_KST", uw: "1,3", g: "0,50" },
    { name: "Dachflächenfenster", art: "FART_DACHFENSTER", rahmen: "RMAT_RAHMEN_HOLZ", uw: "1,4", g: "0,60" },
  ];

  // ------------------------------------------------------------ Speicher
  function lesen(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  let projekte = lesen(SP_PROJEKTE, []).map(migrieren);
  let aussteller = lesen(SP_AUSSTELLER, {});
  let timer = null;
  function speichern(sofort) {
    clearTimeout(timer);
    const tun = () => {
      try { localStorage.setItem(SP_PROJEKTE, JSON.stringify(projekte)); localStorage.setItem(SP_AUSSTELLER, JSON.stringify(aussteller)); }
      catch (e) { toast("Speicher des Browsers ist voll. Foto entfernen oder alte Projekte sichern und löschen."); }
    };
    if (sofort) tun(); else timer = setTimeout(tun, 300);
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  function neuesProjekt() {
    return {
      id: neueId(), version: 2, angelegt: new Date().toISOString(), geaendert: new Date().toISOString(),
      objekt: {}, kunde: {}, allg: { gebaeudeArt: "GEBV_FREISTEHEND", keller: "KK_KEINKELLER", dach: "DK_DACH_UNBEH", we: 1, geschosse: 2 },
      geo: { vorne: 180, nachbar: "rechts", dachneigung: "40" }, konstruktionen: [], fenstertypen: [], bauteile: [],
      heizung: { preset: "gas_bw_zentral_speicher", uebergabe: "HZK_HEIZKOERPER", hydr: false },
      ea: { anlass: "AG_VERMIETUNG", aus: [], eigene: [] }, foto: null,
    };
  }
  /** Projekte aus der ersten App-Fassung auf das neue Modell bringen. */
  function migrieren(p) {
    if (p.version === 2) return p;
    p.version = 2;
    p.objekt = p.objekt || {};
    p.allg = Object.assign({ gebaeudeArt: "GEBV_FREISTEHEND", keller: "KK_KEINKELLER", dach: "DK_DACH_UNBEH", we: 1, geschosse: 2 }, p.allg || {});
    p.kunde = p.kunde || {};
    if (!p.kunde.name) p.kunde.name = [p.kunde.vorname, p.kunde.nachname].filter(Boolean).join(" ");
    p.geo = Object.assign({ vorne: 180, nachbar: "rechts", dachneigung: "40" }, p.geo || {});
    p.heizung = p.heizung || {};
    if (typeof p.heizung.hydr === "string") p.heizung.hydr = p.heizung.hydr !== "HYA_NONE";
    p.ea = p.ea || {};
    p.ea.eigene = (p.ea.eigene || []).concat(p.ea.modernisierungen || []);
    delete p.ea.modernisierungen;
    p.ea.aus = p.ea.aus || [];
    p.konstruktionen = p.konstruktionen || []; p.fenstertypen = p.fenstertypen || [];
    p.bauteile = (p.bauteile || []).map(b => Object.assign(b, { auto: !!b.auto }));
    return p;
  }
  function konstrAusVorlage(v) {
    return { id: neueId(), name: v.name, typ: v.typ, schichten: v.s.map(([n, d]) => n === LUFT ? { name: "Luftschicht (ruhend)", dicke: komma(d), luft: true }
      : { name: n, dicke: komma(d), lambda: komma(BAUSTOFF[n].lambda), rho: String(BAUSTOFF[n].rho) }) };
  }
  function beispielProjekt() {
    const p = neuesProjekt();
    Object.assign(p.objekt, { strasse: "Beispielweg", hausnr: "12", plz: "26603", ort: "Aurich" });
    p.kunde = { name: "Beispiel Eigentümer" };
    Object.assign(p.allg, { baujahr: "1970", gebaeudeArt: "GEBV_ANGEBAUT", we: 2, wfl: "145,37", geschosse: 2 });
    Object.assign(p.geo, { laenge: "8,995", breite: "10,49", hoehe: "5,70", vorne: 180, nachbar: "rechts" });
    p.konstruktionen = [konstrAusVorlage(KONSTR_VORLAGEN[0]), konstrAusVorlage(KONSTR_VORLAGEN[4]), konstrAusVorlage(KONSTR_VORLAGEN[7])];
    const f = { id: neueId(), ...FENSTER_VORLAGEN[4], baujahr: "2026" }, t = { id: neueId(), ...FENSTER_VORLAGEN[6], baujahr: "2026" };
    p.fenstertypen = [f, t];
    huelleAbgleichen(p);
    const o = (fid, b, h, n) => ({ id: neueId(), fensterId: fid, breite: b, hoehe: h, anzahl: String(n) });
    const bt = key => p.bauteile.find(b => b.key === key);
    bt("aw-vorne").oeffnungen = [o(f.id, "2,00", "1,51", 2), o(f.id, "1,01", "2,135", 2), o(f.id, "1,76", "1,26", 2)];
    bt("aw-giebel-links").oeffnungen = [o(f.id, "1,38", "1,38", 4)];
    bt("aw-hinten").oeffnungen = [o(f.id, "1,76", "1,385", 2), o(f.id, "0,76", "0,885", 2), o(t.id, "1,01", "2,135", 2)];
    p.heizung = { preset: "gas_bw_etage", baujahr: "2018", uebergabe: "HZK_HEIZKOERPER", hydr: false, bjUebergabe: "2026" };
    return p;
  }

  // ------------------------------------------------------------ Hülle aus den Maßen
  function standardAufbau(p, art) {
    const typ = (ART[art] || ART.aw).konstr;
    const k = p.konstruktionen.find(x => x.typ === typ);
    return k ? k.id : "";
  }
  /** Gleicht die automatisch erzeugten Bauteile mit der Soll-Hülle ab; Fenster und Aufbauten bleiben erhalten. */
  function huelleAbgleichen(p) {
    const soll = G.huelleSoll(p);
    const alt = p.bauteile.filter(b => b.auto), manuell = p.bauteile.filter(b => !b.auto);
    const neu = [], verloren = [];
    for (const s of soll) {
      let b = alt.find(x => x.key === s.key);
      if (!b) b = { id: neueId(), key: s.key, auto: true, konstrId: "", oeffnungen: [] };
      Object.assign(b, { art: s.art, name: s.name, orient: s.orient == null ? "" : s.orient, neigung: s.neigung == null ? "" : s.neigung,
        laenge: s.laenge, hoehe: s.hoehe, flaeche: zahl(b.flaecheManuell) > 0 ? b.flaecheManuell : (s.flaeche || "") });
      if (!p.konstruktionen.some(k => k.id === b.konstrId && k.typ === ART[b.art].konstr)) b.konstrId = standardAufbau(p, b.art);
      neu.push(b);
    }
    for (const b of alt) if (!neu.includes(b) && (b.oeffnungen || []).length) verloren.push(b);
    p.bauteile = neu.concat(manuell);
    return verloren;
  }

  // ------------------------------------------------------------ Pfade
  const holen = (obj, pfad) => pfad.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function setzen(obj, pfad, wert) {
    const t = pfad.split(".");
    let o = obj;
    for (let i = 0; i < t.length - 1; i++) { if (o[t[i]] == null) o[t[i]] = /^\d+$/.test(t[i + 1]) ? [] : {}; o = o[t[i]]; }
    o[t[t.length - 1]] = wert;
  }
  const betrifftHuelle = pfad => /^(geo\.|allg\.(gebaeudeArt|keller|dach|geschosse))/.test(pfad) || /^bauteile\.\d+\.flaecheManuell$/.test(pfad);

  // ------------------------------------------------------------ Bausteine
  let nr = 0;
  function feld(p, label, pfad, o = {}) {
    const id = "f" + (++nr), w = holen(p, pfad);
    return `<div class="feld${o.ganz ? " ganz" : ""}"><label for="${id}">${esc(label)}</label>
      <div class="eingabe"><input id="${id}" type="${o.typ || "text"}" data-pfad="${esc(pfad)}" value="${esc(w == null ? "" : w)}"
        ${o.zahl ? 'class="zahl" inputmode="decimal"' : ""} ${o.platz ? `placeholder="${esc(o.platz)}"` : ""} autocomplete="${o.auto || "off"}"
        ${o.typ === "tel" ? 'inputmode="tel"' : ""}>${o.einheit ? `<span class="einheit">${esc(o.einheit)}</span>` : ""}</div></div>`;
  }
  function auswahlFeld(p, label, pfad, liste, o = {}) {
    const id = "f" + (++nr), w = holen(p, pfad);
    return `<div class="feld${o.ganz ? " ganz" : ""}"><label for="${id}">${esc(label)}</label><div class="eingabe"><select id="${id}" data-pfad="${esc(pfad)}">
      ${o.leer != null ? `<option value="">${esc(o.leer)}</option>` : ""}${liste.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(w) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>`;
  }
  function wahl(p, pfad, optionen, o = {}) {
    const w = holen(p, pfad);
    return `<div class="wahl${o.text ? " text" : ""}" style="--n:${optionen.length}" role="group" aria-label="${esc(o.label || "")}">${optionen.map(([v, t, ico]) =>
      `<button type="button" data-aktion="setze" data-pfad="${pfad}" data-wert="${esc(v)}" aria-pressed="${String(v) === String(w)}">${ico || ""}<span>${esc(t)}</span></button>`).join("")}</div>`;
  }
  function zaehler(p, label, pfad, min = 1, max = 99) {
    const w = Math.round(zahl(holen(p, pfad), min));
    return `<div class="feld"><span class="lbl">${esc(label)}</span><div class="zaehler">
      <button type="button" data-aktion="zaehlen" data-pfad="${pfad}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} verringern">−</button>
      <b>${w}</b><button type="button" data-aktion="zaehlen" data-pfad="${pfad}" data-d="1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} erhöhen">+</button></div></div>`;
  }
  const karte = (titel, inhalt) => `<section class="karte">${titel ? `<h3>${esc(titel)}</h3>` : ""}${inhalt}</section>`;
  const autoBlock = (zeilen, text) => `<section class="auto"><div class="auto-kopf"><span class="a">A</span> Automatisch berechnet</div>
    <div class="auto-liste">${zeilen.map(([k, v, live]) => `<div><span>${esc(k)}</span><b${live ? ` data-live="${live}"` : ""}>${v}</b></div>`).join("")}</div>${text ? `<p class="hinweis">${text}</p>` : ""}</section>`;
  function upill(u, gegWert) {
    if (u == null || !Number.isFinite(u)) return '<span class="upill k-0">U –</span>';
    const f = u / (gegWert || 0.24);
    const k = f <= 1 ? "a" : f <= 1.5 ? "b" : f <= 2.5 ? "c" : f <= 4 ? "d" : "e";
    return `<span class="upill k-${k}">U ${de(u, 2)}</span>`;
  }
  function weiterKnopf(p, key) {
    const i = SCHRITTE.findIndex(s => s.key === key), n = SCHRITTE[i + 1];
    return n ? `<div class="weiter"><a class="knopf dunkel" href="#/p/${p.id}/${n.key}">Weiter: ${esc(n.titel)} ${I.pfeil}</a></div>`
      : `<div class="weiter"><a class="knopf dunkel" href="#/p/${p.id}/export">Weiter: EVEBI-Datei ${I.pfeil}</a></div>`;
  }

  // ------------------------------------------------------------ Prüfung & Schritte
  function pruefen(p) {
    const fehler = [], ok = [];
    const o = p.objekt, a = p.allg, g = p.geo;
    (o.strasse && o.plz && o.ort ? ok : fehler).push("Objektadresse");
    (zahl(a.baujahr) > 1700 ? ok : fehler).push("Baujahr");
    (zahl(a.wfl) > 0 ? ok : fehler).push("Wohnfläche");
    (zahl(g.laenge) > 0 && zahl(g.breite) > 0 && zahl(g.hoehe) > 0 ? ok : fehler).push("Maße (Länge, Breite, Wandhöhe)");
    const ohneK = p.bauteile.filter(b => !p.konstruktionen.some(k => k.id === b.konstrId));
    if (!p.bauteile.length) fehler.push("Hülle (entsteht aus den Maßen)");
    else if (ohneK.length) fehler.push("Aufbau fehlt: " + ohneK.map(b => b.name).join(", "));
    else ok.push("Alle Bauteile haben einen Aufbau");
    const n = p.bauteile.reduce((s, b) => s + (b.oeffnungen || []).length, 0);
    (n ? ok : fehler).push("Fenster und Türen eingetragen");
    if (p.bauteile.some(b => (b.oeffnungen || []).some(x => !p.fenstertypen.some(f => f.id === x.fensterId)))) fehler.push("Fenster ohne Fenstertyp");
    for (const b of G.kennwerte(p).bauteile) if (b.oeff > b.brutto + 0.01) fehler.push("Fenster größer als die Fläche: " + (p.bauteile.find(x => x.id === b.id) || {}).name);
    (zahl(p.heizung.baujahr) > 1900 ? ok : fehler).push("Baujahr Wärmeerzeuger");
    return { fehler, ok };
  }
  const anzahlOeffnungen = p => p.bauteile.reduce((s, b) => s + (b.oeffnungen || []).reduce((t, o) => t + Math.max(1, zahl(o.anzahl, 1)), 0), 0);
  const SCHRITTE = [
    { key: "objekt", titel: "Objekt & Kunde", ico: "objekt", farbe: "#e6eefb", seite: seiteObjekt,
      info: p => [[p.objekt.strasse, p.objekt.hausnr].filter(Boolean).join(" "), p.objekt.ort].filter(Boolean).join(", ") || "Adresse eintragen",
      fertig: p => !!(p.objekt.strasse && p.objekt.plz && p.objekt.ort) },
    { key: "gebaeude", titel: "Gebäude", ico: "gebaeude", farbe: "#f7e6e0", seite: seiteGebaeude,
      info: p => [p.allg.baujahr && "Bj. " + p.allg.baujahr, p.allg.wfl && komma(p.allg.wfl) + " m²", p.allg.we + " WE"].filter(Boolean).join(" · "),
      fertig: p => !!(zahl(p.allg.baujahr) && zahl(p.allg.wfl)) },
    { key: "masse", titel: "Maße & Ausrichtung", ico: "masse", farbe: "#e9f3d6", seite: seiteMasse,
      info: p => { const k = G.kennwerte(p); return k.ve ? `Ve ${de(k.ve, 0)} m³ · AN ${de(k.an, 0)} m²` : "Länge, Breite, Höhe"; },
      fertig: p => G.kennwerte(p).ve > 0 },
    { key: "aufbauten", titel: "Aufbauten", ico: "aufbauten", farbe: "#f3efe4", seite: seiteAufbauten,
      info: p => p.konstruktionen.length ? p.konstruktionen.length + " Schichtaufbauten" : "Wand, Decke, Boden",
      fertig: p => p.konstruktionen.length > 0 && GRUPPEN.every(([g]) => !p.bauteile.some(b => ART[b.art].konstr === g) || p.konstruktionen.some(k => k.typ === g)) },
    { key: "fenster", titel: "Fenster & Türen", ico: "fenster", farbe: "#e6eefb", seite: seiteFenstertypen,
      info: p => p.fenstertypen.length ? p.fenstertypen.length + " Typen" : "Typen festlegen", fertig: p => p.fenstertypen.length > 0 },
    { key: "huelle", titel: "Hülle & Fenstermaße", ico: "huelle", farbe: "#eceee8", seite: seiteHuelle,
      info: p => p.bauteile.length ? `${p.bauteile.length} Bauteile · ${anzahlOeffnungen(p)} Fenster/Türen` : "entsteht aus den Maßen",
      fertig: p => p.bauteile.length > 0 && !pruefen(p).fehler.some(f => /Aufbau fehlt|Fenster/.test(f)) },
    { key: "heizung", titel: "Heizung & Warmwasser", ico: "heizung", farbe: "#fbe6e6", seite: seiteHeizung,
      info: p => (V.heizung[p.heizung.preset] || {}).name || "Erzeuger wählen", fertig: p => zahl(p.heizung.baujahr) > 1900 },
    { key: "ausweis", titel: "Energieausweis", ico: "ausweis", farbe: "#eef6dd", seite: seiteAusweis,
      info: p => (ANLASS.find(a => a[0] === p.ea.anlass) || [, ""])[1] + " · " + (G.empfehlungen(p).filter(e => e.aktiv).length + (p.ea.eigene || []).length) + " Empfehlungen",
      fertig: p => !!p.ea.anlass },
    { key: "foto", titel: "Gebäudefoto", ico: "foto", farbe: "#eceee8", seite: seiteFoto, info: p => p.foto ? "Foto vorhanden" : "für Seite 1", fertig: p => !!p.foto },
  ];

  // ------------------------------------------------------------ Router
  let aktuell = null;
  const route = () => (location.hash || "#/").slice(1).split("/").filter(Boolean);
  function render(oben = true) {
    nr = 0;
    const r = route(), y = window.scrollY;
    if (r[0] === "einstellungen") { aktuell = null; seiteEinstellungen(); }
    else if (r[0] === "p") {
      const p = projekte.find(x => x.id === r[1]);
      if (!p) { location.hash = "#/"; return; }
      aktuell = p;
      if (!r[2]) seiteProjekt(p);
      else if (r[2] === "aufbau" && r[3]) seiteAufbau(p, r[3]);
      else if (r[2] === "fenstertyp" && r[3]) seiteFenstertyp(p, r[3]);
      else if (r[2] === "bauteil" && r[3]) seiteBauteil(p, r[3]);
      else if (r[2] === "export") seiteExport(p);
      else { const s = SCHRITTE.find(x => x.key === r[2]); if (s) s.seite(p); else { location.hash = "#/p/" + p.id; return; } }
    } else { aktuell = null; seiteStart(); }
    window.scrollTo(0, oben ? 0 : y);
  }
  function kopf(titel, unter, zurueck) {
    titelEl.innerHTML = `${esc(titel)}${unter ? `<small>${esc(unter)}</small>` : ""}`;
    zurueckEl.hidden = !zurueck;
    zurueckEl.dataset.ziel = zurueck || "";
    document.getElementById("logo").hidden = !!zurueck;
    document.title = titel === "HK Aufnahme" ? "HK Aufnahme" : titel + " · HK Aufnahme";
  }
  const ortZeile = p => [p.objekt.plz, p.objekt.ort].filter(Boolean).join(" ");
  const projektName = p => [p.objekt.strasse, p.objekt.hausnr].filter(Boolean).join(" ") || "Neues Projekt";
  const fortschritt = p => SCHRITTE.filter(s => s.fertig(p)).length;

  // ------------------------------------------------------------ Start
  function ring(anteil) {
    const u = 2 * Math.PI * 17;
    return `<svg class="ring" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="17" fill="none" stroke="var(--linie)" stroke-width="5"/>
      <circle cx="21" cy="21" r="17" fill="none" stroke="var(--gruen)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(anteil * u).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 21 21)"/></svg>`;
  }
  function seiteStart() {
    kopf("HK Aufnahme", "Energieausweis-Daten für EVEBI", null);
    const liste = projekte.slice().sort((a, b) => (b.geaendert || "").localeCompare(a.geaendert || ""));
    app.innerHTML = `
      <div class="hero"><h2>Vor Ort aufnehmen,<br>in EVEBI weiterrechnen.</h2>
        <p>Nur eingeben, was EVEBI nicht selbst berechnet. Am Ende entsteht eine .evex-Datei für den PC.</p>
        <div class="reihe"><button class="knopf haupt" data-aktion="neu">${I.plus} Neues Projekt</button>
          ${liste.length ? "" : `<button class="knopf" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.35)" data-aktion="beispiel">Beispiel ansehen</button>`}</div></div>
      ${liste.length ? `<section class="karte"><h3>Projekte auf diesem Gerät</h3><div style="display:grid;gap:10px">${liste.map(p => `<a class="projekt" href="#/p/${p.id}">
          ${p.foto ? `<img src="${p.foto}" alt="">` : `<span class="platz">${I.haus}</span>`}
          <span style="min-width:0"><b>${esc(projektName(p))}</b><span>${esc(ortZeile(p) || "ohne Ort")} · ${new Date(p.geaendert).toLocaleDateString("de-DE")}</span></span>
          ${ring(fortschritt(p) / SCHRITTE.length)}</a>`).join("")}</div></section>`
        : karte("So läuft's", `<ol class="hinweis" style="margin:0;padding-left:18px;display:grid;gap:6px">
            <li>Adresse, Gebäudedaten und Außenmaße eintragen – die Hülle entsteht automatisch.</li>
            <li>Aufbauten und Fenstertypen wählen, Fenstermaße je Wand eintragen.</li>
            <li>Heizung wählen, EVEBI-Datei erzeugen und per OneDrive, Mail oder WhatsApp an den PC schicken.</li></ol>`)}
      <div class="reihe"><label class="knopf klein" for="import">Sicherung öffnen</label>${liste.length ? `<button class="knopf klein" data-aktion="beispiel">Beispielprojekt</button>` : ""}</div>
      <input id="import" type="file" accept=".json,application/json" hidden>`;
  }

  // ------------------------------------------------------------ Aussteller
  function seiteEinstellungen() {
    kopf("Aussteller", "steht im Energieausweis", "#/");
    const a = { aussteller };
    app.innerHTML = `<div></div>${karte("Aussteller / Planer", `<p class="hinweis">Einmal eintragen – wird in jede EVEBI-Datei übernommen und bleibt nur auf diesem Gerät.</p>
      <div class="felder">${feld(a, "Firma", "aussteller.firma", { ganz: true, auto: "organization" })}
      ${auswahlFeld(a, "Anrede", "aussteller.anrede", [["Herr", "Herr"], ["Frau", "Frau"]], { leer: "–" })}${feld(a, "BAFA-Beraternr.", "aussteller.bafaNr")}
      ${feld(a, "Vorname", "aussteller.vorname", { auto: "given-name" })}${feld(a, "Nachname", "aussteller.nachname", { auto: "family-name" })}
      ${feld(a, "Straße", "aussteller.strasse")}${feld(a, "Nr.", "aussteller.hausnr")}
      ${feld(a, "PLZ", "aussteller.plz", { zahl: true })}${feld(a, "Ort", "aussteller.ort")}
      ${feld(a, "Telefon", "aussteller.telefon", { typ: "tel" })}${feld(a, "E-Mail", "aussteller.email", { typ: "email" })}</div>
      <p class="hinweis">Logo und Unterschrift fügst du einmalig in EVEBI unter „Planeradresse“ hinzu.</p>`)}`;
  }

  // ------------------------------------------------------------ Projektübersicht
  function seiteProjekt(p) {
    kopf(projektName(p), ortZeile(p), "#/");
    const kw = G.kennwerte(p), f = fortschritt(p), offen = pruefen(p).fehler.length;
    app.innerHTML = `
      <div class="hero">
        <div class="hero-zeile">${p.foto ? `<img class="foto-mini" src="${p.foto}" alt="">` : ""}
          <div style="min-width:0"><h2>${esc(projektName(p))}</h2><p>${esc([ortZeile(p) || "Adresse fehlt", p.allg.baujahr && "Baujahr " + p.allg.baujahr].filter(Boolean).join(" · "))}</p></div></div>
        <div class="kennzahlen"><div class="kz"><b>${kw.ve ? de(kw.ve, 0) : "–"}</b><span>Ve in m³</span></div>
          <div class="kz"><b>${kw.an ? de(kw.an, 0) : "–"}</b><span>AN in m²</span></div><div class="kz"><b>${kw.huelle ? de(kw.huelle, 0) : "–"}</b><span>Hülle in m²</span></div></div>
        <div class="fortschritt"><i style="width:${(f / SCHRITTE.length * 100).toFixed(0)}%"></i></div>
        <div class="fortschritt-text"><span>${f} von ${SCHRITTE.length} Schritten erledigt</span></div>
      </div>
      <div class="kacheln">${SCHRITTE.map((s, i) => `<a class="kachel${s.fertig(p) ? " fertig" : ""}" href="#/p/${p.id}/${s.key}">
        <span class="nr">${s.fertig(p) ? "✓" : i + 1}</span><span class="ico" style="background:${s.farbe}">${I[s.ico]}</span>
        <b>${esc(s.titel)}</b><span>${esc(s.info(p))}</span></a>`).join("")}
        <a class="kachel breit" href="#/p/${p.id}/export" style="background:var(--tief)"><span class="ico" style="background:var(--gruen);color:#1b2a07">${I.export}</span>
          <span><b style="color:#fff">EVEBI-Datei erzeugen</b><br><span style="color:rgba(255,255,255,.75)">${offen ? offen + " Punkte noch offen" : "alles eingetragen"}</span></span></a>
      </div>
      <div id="loeschen-bereich" class="reihe"><button class="knopf klein" data-aktion="projekt-kopieren">${I.kopie} Kopieren</button>
        <button class="knopf klein gefahr" data-aktion="projekt-loeschen-frage">${I.weg} Löschen</button></div>`;
  }

  // ------------------------------------------------------------ 1 Objekt & Kunde
  function seiteObjekt(p) {
    kopf("Objekt & Kunde", projektName(p), "#/p/" + p.id);
    const bl = G.auto(p).bundesland;
    app.innerHTML = `<div></div>
      ${karte("Objektadresse", `<div class="felder">${feld(p, "Straße", "objekt.strasse", { auto: "address-line1" })}${feld(p, "Nr.", "objekt.hausnr")}
        ${feld(p, "PLZ", "objekt.plz", { zahl: true, auto: "postal-code" })}${feld(p, "Ort", "objekt.ort", { auto: "address-level2" })}</div>`)}
      ${autoBlock([["Bundesland", esc(BL_NAME[bl] || "–"), "bundesland"], ["Bezeichnung", "Wohngebäude " + esc(p.objekt.ort || "…"), "bezeichnung"]],
        p.objekt.bundesland ? `Von Hand festgelegt. <button class="knopf klein" data-aktion="bl-auto">wieder aus PLZ</button>` : `Aus der PLZ. <button class="knopf klein" data-aktion="bl-aendern">anderes Bundesland</button>`)}
      <div id="bl-wahl"${p.objekt.bundesland ? "" : " hidden"}>${karte("", auswahlFeld(p, "Bundesland", "objekt.bundesland", BUNDESLAENDER, { ganz: true, leer: "aus PLZ ermitteln" }))}</div>
      ${karte("Kunde", `<div class="felder">${auswahlFeld(p, "Anrede", "kunde.anrede", [["Herr", "Herr"], ["Frau", "Frau"]], { leer: "–" })}
        ${feld(p, "Name", "kunde.name", { auto: "name" })}${feld(p, "Telefon", "kunde.telefon", { typ: "tel" })}${feld(p, "E-Mail", "kunde.email", { typ: "email" })}</div>
        <label class="schalter"><span>Andere Adresse als das Objekt<small>sonst gilt die Objektadresse</small></span>
          <input type="checkbox" data-pfad="kunde.andereAdresse" data-neu="1"${p.kunde.andereAdresse ? " checked" : ""}></label>
        ${p.kunde.andereAdresse ? `<div class="felder">${feld(p, "Straße", "kunde.strasse")}${feld(p, "Nr.", "kunde.hausnr")}${feld(p, "PLZ", "kunde.plz", { zahl: true })}${feld(p, "Ort", "kunde.ort")}</div>` : ""}`)}
      ${weiterKnopf(p, "objekt")}`;
  }

  // ------------------------------------------------------------ 2 Gebäude
  function seiteGebaeude(p) {
    kopf("Gebäude", projektName(p), "#/p/" + p.id);
    const A = G.auto(p);
    app.innerHTML = `<div></div>
      ${karte("Gebäudeart", wahl(p, "allg.gebaeudeArt", [["GEBV_FREISTEHEND", "Freistehend", P.frei], ["GEBV_ANGEBAUT", "Doppelhaus­hälfte / Reihenende", P.dhh], ["GEBV_REIHENBEBAUUNG", "Reihen­mittelhaus", P.reihe]], { label: "Gebäudeart" }))}
      ${karte("Eckdaten", `<div class="felder">${feld(p, "Baujahr", "allg.baujahr", { zahl: true, platz: "z. B. 1970" })}
        ${feld(p, "Wohnfläche", "allg.wfl", { zahl: true, einheit: "m²" })}
        ${zaehler(p, "Wohnungen", "allg.we", 1, 200)}${zaehler(p, "Beheizte Geschosse", "allg.geschosse", 1, 30)}</div>
        <p class="hinweis">Geschosse inklusive ausgebautem Dach und beheiztem Keller.</p>`)}
      ${karte("Keller", wahl(p, "allg.keller", [["KK_KEINKELLER", "Kein Keller", P.kKein], ["KK_KELLER_UNBEH", "Unbeheizt", P.kUnbeh], ["KK_KELLER_BEH", "Beheizt", P.kBeh]], { label: "Keller" }))}
      ${karte("Dach", wahl(p, "allg.dach", [["DK_DACH_UNBEH", "Dachboden unbeheizt", P.dOgd], ["DK_DACH_BEH", "Ausgebaut, beheizt", P.dBeh], ["DK_FLACHDACH", "Flachdach", P.dFlach]], { label: "Dach" }))}
      ${autoBlock([["Vollgeschosse", A.vollgeschosse, "vollgeschosse"], ["Selbstgenutzte WE", A.weSelbst, "weSelbst"], ["Personen", A.personen, "personen"],
        ["Raumhöhe", "2,50 m"], ["Wärmebrücken", "0,10 W/(m²K)"]])}
      ${weiterKnopf(p, "gebaeude")}`;
  }

  // ------------------------------------------------------------ 3 Maße & Ausrichtung
  function skizze(p) {
    const A = G.auto(p);
    if (!(A.L > 0 && A.B > 0)) return "";
    const s = 140 / Math.max(A.L, A.B), w = A.L * s, h = A.B * s, x = (240 - w) / 2, y = 26;
    const art = p.allg.gebaeudeArt;
    const links = art === "GEBV_REIHENBEBAUUNG" || (art === "GEBV_ANGEBAUT" && p.geo.nachbar === "links");
    const rechts = art === "GEBV_REIHENBEBAUUNG" || (art === "GEBV_ANGEBAUT" && p.geo.nachbar !== "links");
    const nb = (xx) => `<rect x="${xx}" y="${y}" width="28" height="${h}" fill="var(--karte-2)" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
    return `<svg viewBox="0 0 240 ${h + 66}" style="width:100%;max-width:320px;justify-self:center;display:block;margin:0 auto" role="img" aria-label="Grundriss-Skizze">
      ${links ? nb(x - 28) : ""}${rechts ? nb(x + w) : ""}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--auto-bg)" stroke="var(--ink)" stroke-width="2"/>
      <line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="var(--gruen)" stroke-width="7"/>
      <text x="${x + w / 2}" y="${y + h + 22}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink)">vorne (${KURZ[norm(p.geo.vorne)]}) · ${de(A.L, 2)} m</text>
      <text x="${x + w / 2}" y="16" text-anchor="middle" font-size="11" fill="var(--muted)">hinten</text>
      <text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="12" fill="var(--muted)">${de(A.B, 2)} m tief</text></svg>`;
  }
  function seiteMasse(p) {
    kopf("Maße & Ausrichtung", projektName(p), "#/p/" + p.id);
    const A = G.auto(p), vorne = norm(p.geo.vorne);
    app.innerHTML = `<div></div>
      ${karte("Außenmaße", `<p class="hinweis">Außenmaße der beheizten Hülle – bei Doppel- und Reihenhäusern bis Mitte Trennwand.</p>
        <div class="felder">${feld(p, "Länge Traufseite", "geo.laenge", { zahl: true, einheit: "m" })}${feld(p, "Breite Giebelseite", "geo.breite", { zahl: true, einheit: "m" })}
        ${feld(p, "Wandhöhe", "geo.hoehe", { zahl: true, einheit: "m" })}
        ${A.dachBeh ? feld(p, "Dachneigung", "geo.dachneigung", { zahl: true, einheit: "°" }) : ""}
        ${A.kellerBeh ? feld(p, "Höhe Kellergeschoss", "geo.kellerhoehe", { zahl: true, einheit: "m", platz: "2,50" }) : ""}</div>
        <p class="hinweis">Wandhöhe: Unterkante Bodenplatte bzw. Kellerdecke bis Oberkante oberste Geschossdecke${A.dachBeh ? " bzw. Traufe" : ""}.</p>`)}
      ${karte("Vorderseite (Traufseite) zeigt nach", `<div class="kompass" role="group" aria-label="Ausrichtung der Vorderseite">${KOMPASS.map(k => k
        ? `<button type="button" data-aktion="setze" data-pfad="geo.vorne" data-wert="${k[1]}" aria-pressed="${k[1] === vorne}">${k[0]}</button>`
        : `<span class="mitte">${I.haus}<span>vorne</span></span>`).join("")}</div>
        ${p.allg.gebaeudeArt === "GEBV_ANGEBAUT" ? `<div class="feld"><span class="lbl">Nachbarhaus ist angebaut (von vorne gesehen)</span>${wahl(p, "geo.nachbar", [["links", "links"], ["rechts", "rechts"]], { text: true, label: "Nachbarseite" })}</div>` : ""}
        ${skizze(p)}`)}
      ${autoBlock([["Grundfläche", de(A.L * A.B, 2) + " m²", "grund"], ...(A.dachBeh ? [["Dachvolumen", de(A.dachVolumen, 1) + " m³", "dachvol"]] : []),
        ["Volumen Ve", de(A.ve, 1) + " m³", "ve"], ["Geschosshöhe", de(A.geschosshoehe, 2) + " m", "gh"], ["Nutzfläche AN", de(A.an, 1) + " m²", "an"],
        ["Hüllfläche", de(G.kennwerte(p).huelle, 1) + " m²", "huelle"]],
        "Wände, Dach bzw. oberste Geschossdecke und Boden entstehen aus diesen Maßen automatisch.")}
      ${weiterKnopf(p, "masse")}`;
  }

  // ------------------------------------------------------------ 4 Aufbauten
  function schichtbild(k) {
    const summe = k.schichten.reduce((s, x) => s + zahl(x.dicke), 0) || 1;
    return `<div class="schichtbild" aria-hidden="true">${k.schichten.map(s => `<i class="${farbe(s)}" style="flex:${Math.max(zahl(s.dicke), summe * 0.03)}"></i>`).join("") || '<i class="m-sonst" style="flex:1;opacity:.2"></i>'}</div>`;
  }
  const artFuerKonstr = (p, k) => { const b = p.bauteile.find(x => x.konstrId === k.id); return b ? b.art : { wand: "aw", dach: "ogd", boden: "bp" }[k.typ]; };
  function seiteAufbauten(p) {
    kopf("Aufbauten", projektName(p), "#/p/" + p.id);
    app.innerHTML = `<div></div>${GRUPPEN.map(([g, titel]) => {
      const liste = p.konstruktionen.filter(k => k.typ === g);
      const gebraucht = p.bauteile.some(b => ART[b.art].konstr === g);
      return karte(titel, `${liste.length ? `<div class="liste">${liste.map(k => {
        const art = artFuerKonstr(p, k);
        return `<a class="zeile" href="#/p/${p.id}/aufbau/${k.id}"><span style="display:grid;gap:8px;min-width:0"><span class="t">${esc(k.name)}</span>${schichtbild(k)}
          <span class="u">${k.schichten.length} Schichten · ${de(k.schichten.reduce((s, x) => s + zahl(x.dicke), 0), 1)} cm · ${p.bauteile.filter(b => b.konstrId === k.id).length}× verwendet</span></span>
          <span class="rechts">${upill(G.uWert(k, art), ART[art].gegWert)}</span></a>`;
      }).join("")}</div>` : (gebraucht ? '<p class="hinweis warn">Wird für die Hülle gebraucht – Vorlage antippen:</p>' : '<p class="hinweis">Typische Aufbauten:</p>')}
        <div class="chips">${KONSTR_VORLAGEN.map((v, i) => v.typ === g ? `<button data-aktion="konstr-vorlage" data-i="${i}">${esc(v.name)}</button>` : "").join("")}
          <button data-aktion="konstr-neu" data-typ="${g}">${I.plus} Eigener Aufbau</button></div>`);
    }).join("")}
      <div class="legende"><span><i class="m-putz"></i>Putz</span><span><i class="m-mauer"></i>Mauerwerk</span><span><i class="m-beton"></i>Beton/Estrich</span>
        <span><i class="m-daemm"></i>Dämmung</span><span><i class="m-holz"></i>Holz</span><span><i class="m-luft"></i>Luft</span></div>
      ${weiterKnopf(p, "aufbauten")}`;
  }
  function baustoffOptionen(s) {
    const name = s.luft ? LUFT : s.name;
    return `<option value="">Baustoff …</option>` + BAUSTOFFE.map(([, gr, l]) => `<optgroup label="${esc(gr)}">${l.map(([n]) =>
      `<option value="${esc(n)}"${n === name ? " selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>`).join("") +
      `<option value="${LUFT}"${s.luft ? " selected" : ""}>${LUFT}</option>${s.name && !BAUSTOFF[s.name] && !s.luft ? `<option selected>${esc(s.name)}</option>` : ""}<option value="__eigen">Eigener Baustoff …</option>`;
  }
  function seiteAufbau(p, kid) {
    const i = p.konstruktionen.findIndex(k => k.id === kid);
    if (i < 0) { location.hash = `#/p/${p.id}/aufbauten`; return; }
    const k = p.konstruktionen[i], pf = `konstruktionen.${i}`, art = artFuerKonstr(p, k);
    kopf(k.name || "Aufbau", (GRUPPEN.find(g => g[0] === k.typ) || [, ""])[1], `#/p/${p.id}/aufbauten`);
    app.innerHTML = `<div></div>
      ${karte("", `${feld(p, "Bezeichnung", pf + ".name", { ganz: true })}${schichtbild(k)}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="hinweis"><span class="a">A</span> U-Wert aus den Schichten</span><span data-live="upill:${k.id}">${upill(G.uWert(k, art), ART[art].gegWert)}</span></div>`)}
      ${karte("Schichten von innen nach außen", `<div style="display:grid;gap:14px">${k.schichten.map((s, j) => {
        const sp = `${pf}.schichten.${j}`;
        return `<div class="schicht"><span class="farbe ${farbe(s)}"></span>
          ${s.eigen ? `<div class="eingabe"><input type="text" data-pfad="${sp}.name" value="${esc(s.name)}" placeholder="Baustoff" aria-label="Baustoff"></div>`
            : `<div class="eingabe"><select data-baustoff="${sp}" aria-label="Baustoff">${baustoffOptionen(s)}</select></div>`}
          <div class="eingabe"><input type="text" class="zahl" inputmode="decimal" data-pfad="${sp}.dicke" value="${esc(s.dicke || "")}" aria-label="Dicke"><span class="einheit">cm</span></div>
          <span style="display:grid;gap:4px">${j ? `<button class="icon-knopf" data-aktion="schicht-hoch" data-j="${j}" aria-label="nach oben">${I.hoch}</button>` : ""}
            <button class="icon-knopf" data-aktion="schicht-weg" data-j="${j}" aria-label="Schicht löschen">${I.weg}</button></span>
          ${s.luft ? `<span class="lam"><span class="a">A</span> R = ${de(G.rLuft(zahl(s.dicke)), 2)} m²K/W (ruhende Luft)</span>`
            : `<span class="lam"><span class="a">A</span> λ <input type="text" inputmode="decimal" data-pfad="${sp}.lambda" value="${esc(s.lambda || "")}" aria-label="Lambda"> W/(mK)</span>`}
        </div>`;
      }).join("") || '<p class="hinweis">Noch keine Schicht.</p>'}</div>
        <div class="reihe"><button class="knopf klein" data-aktion="schicht-neu">${I.plus} Schicht</button></div>`)}
      <details class="karte"${zahl(k.uManuell) ? " open" : ""}><summary style="font-weight:600;cursor:pointer">U-Wert direkt eingeben</summary>
        ${feld(p, "U-Wert (überschreibt die Schichten)", pf + ".uManuell", { zahl: true, einheit: "W/m²K", platz: "leer = aus Schichten" })}
        <p class="hinweis">Für Holzanteile (Sparren, Balken) oder bekannte Herstellerwerte.</p></details>
      <div class="reihe"><button class="knopf klein" data-aktion="konstr-kopieren">${I.kopie} Kopieren</button>
        <button class="knopf klein gefahr" data-aktion="konstr-weg">${I.weg} Löschen</button>
        <a class="knopf dunkel klein" href="#/p/${p.id}/aufbauten" style="margin-left:auto">Fertig</a></div>`;
  }

  // ------------------------------------------------------------ 5 Fenster & Türen
  function seiteFenstertypen(p) {
    kopf("Fenster & Türen", projektName(p), "#/p/" + p.id);
    app.innerHTML = `<div></div>
      ${karte("Typen im Gebäude", p.fenstertypen.length ? `<div class="liste">${p.fenstertypen.map(f => `
        <a class="zeile" href="#/p/${p.id}/fenstertyp/${f.id}"><span><span class="t">${esc(f.name || "ohne Name")}</span>
        <span class="u">${esc((FENSTERART.find(a => a[0] === f.art) || [, ""])[1])} · ${esc((RAHMEN.find(a => a[0] === f.rahmen) || [, ""])[1])}${f.baujahr ? " · " + esc(f.baujahr) : ""}</span></span>
        <span class="rechts">${upill(zahl(f.uw) || null, 1.3)}</span></a>`).join("")}</div>` : '<p class="hinweis">Lege an, welche Fenster und Türen es im Haus gibt. Die Maße trägst du danach je Wand ein.</p>')}
      ${karte("Hinzufügen", `<div class="chips">${FENSTER_VORLAGEN.map((v, i) => `<button data-aktion="fenster-vorlage" data-i="${i}">${esc(v.name)} · Uw ${esc(v.uw)}</button>`).join("")}
        <button data-aktion="fenster-neu">${I.plus} Eigener Typ</button></div>`)}
      ${weiterKnopf(p, "fenster")}`;
  }
  function seiteFenstertyp(p, fid) {
    const i = p.fenstertypen.findIndex(f => f.id === fid);
    if (i < 0) { location.hash = `#/p/${p.id}/fenster`; return; }
    const pf = `fenstertypen.${i}`;
    kopf(p.fenstertypen[i].name || "Fenstertyp", "Fenster & Türen", `#/p/${p.id}/fenster`);
    app.innerHTML = `<div></div>
      ${karte("Art", wahl(p, pf + ".art", FENSTERART, { text: true, label: "Art" }))}
      ${karte("Angaben", `<div class="felder">${feld(p, "Bezeichnung", pf + ".name", { ganz: true })}
        ${feld(p, "Uw-Wert", pf + ".uw", { zahl: true, einheit: "W/m²K" })}${feld(p, "g-Wert", pf + ".g", { zahl: true })}
        ${auswahlFeld(p, "Rahmen", pf + ".rahmen", RAHMEN)}${feld(p, "Einbaujahr", pf + ".baujahr", { zahl: true })}</div>
        <p class="hinweis">Uw und g aus Rechnung oder Datenblatt – sonst bleiben die Richtwerte der Vorlage.</p>`)}
      <div class="reihe"><button class="knopf klein gefahr" data-aktion="fenster-weg">${I.weg} Löschen</button>
        <a class="knopf dunkel klein" href="#/p/${p.id}/fenster" style="margin-left:auto">Fertig</a></div>`;
  }

  // ------------------------------------------------------------ 6 Hülle
  function seiteHuelle(p) {
    kopf("Hülle & Fenstermaße", projektName(p), "#/p/" + p.id);
    const kw = G.kennwerte(p);
    if (!p.bauteile.length) {
      app.innerHTML = `<div></div>${karte("Noch keine Hülle", `<p class="hinweis">Die Bauteile entstehen automatisch, sobald Länge, Breite und Wandhöhe eingetragen sind.</p>
        <a class="knopf dunkel" href="#/p/${p.id}/masse">Maße eintragen ${I.pfeil}</a>`)}`;
      return;
    }
    app.innerHTML = `<div></div><p class="hinweis"><span class="a">A</span> Aus den Maßen angelegt. Tippe eine Wand an, um Fenster und Türen einzutragen.</p>
      ${GRUPPEN.map(([g, titel]) => {
      const liste = p.bauteile.filter(b => ART[b.art].konstr === g);
      if (!liste.length) return "";
      return karte(titel, `<div class="liste">${liste.map(b => {
        const k = kw.bauteile.find(x => x.id === b.id) || {};
        const n = (b.oeffnungen || []).reduce((s, o) => s + Math.max(1, zahl(o.anzahl, 1)), 0);
        const kon = p.konstruktionen.find(x => x.id === b.konstrId);
        return `<a class="zeile" href="#/p/${p.id}/bauteil/${b.id}"><span style="min-width:0"><span class="t">${b.orient !== "" && b.orient != null ? `<span class="richtung">${KURZ[b.orient] || ""}</span> ` : ""}${esc(b.name.replace(/ \([^)]*\)$/, ""))}</span>
          <span class="u">${de(k.netto, 1)} m²${n ? ` · ${n} Fenster/Türen` : " · keine Fenster"} · ${kon ? esc(kon.name) : '<b style="color:var(--warn)">Aufbau fehlt</b>'}</span></span>
          <span class="rechts">${upill(k.u, ART[b.art].gegWert)}</span></a>`;
      }).join("")}</div>`);
    }).join("")}
      <details class="karte"><summary style="font-weight:600;cursor:pointer">Weiteres Bauteil (Gaube, Anbau, Wand zur Garage …)</summary>
        <div class="chips">${Object.entries(ART).map(([k, a]) => `<button data-aktion="bauteil-neu" data-art="${k}">${I.plus} ${esc(a.label)}</button>`).join("")}</div></details>
      ${weiterKnopf(p, "huelle")}`;
  }
  function seiteBauteil(p, bid) {
    const i = p.bauteile.findIndex(b => b.id === bid);
    if (i < 0) { location.hash = `#/p/${p.id}/huelle`; return; }
    const b = p.bauteile[i], pf = `bauteile.${i}`, a = ART[b.art] || ART.aw;
    const k = G.kennwerte(p).bauteile.find(x => x.id === b.id) || {};
    const passende = p.konstruktionen.filter(x => x.typ === a.konstr);
    const fensterWahl = p.fenstertypen.filter(f => a.btl === "WAND" ? f.art !== "FART_DACHFENSTER" : true);
    kopf(b.name, a.label, `#/p/${p.id}/huelle`);
    app.innerHTML = `<div></div>
      ${b.auto ? autoBlock([["Art", esc(a.label)], ...(b.orient !== "" ? [["Ausrichtung", G.RICHTUNG[b.orient] || "–"]] : []),
        ...(b.neigung !== "" && b.neigung != null ? [["Neigung", komma(b.neigung) + "°"]] : []),
        ["Bruttofläche", de(k.brutto, 2) + " m²", `bt:${b.id}:brutto`], ["Fenster/Türen", de(k.oeff, 2) + " m²", `bt:${b.id}:oeff`],
        ["Nettofläche", de(k.netto, 2) + " m²", `bt:${b.id}:netto`]], "Aus den Gebäudemaßen.")
      : karte("Bauteil", `<div class="felder">${feld(p, "Bezeichnung", pf + ".name", { ganz: true })}
          ${auswahlFeld(p, "Art", pf + ".art", Object.entries(ART).map(([x, y]) => [x, y.label]), { ganz: true })}
          ${feld(p, "Länge", pf + ".laenge", { zahl: true, einheit: "m" })}${feld(p, a.btl === "WAND" ? "Höhe" : (b.art === "dach" ? "Sparrenlänge" : "Breite"), pf + ".hoehe", { zahl: true, einheit: "m" })}
          ${b.art === "dach" ? feld(p, "Neigung", pf + ".neigung", { zahl: true, einheit: "°" }) : ""}</div>
          ${a.btl === "WAND" || b.art === "dach" ? `<div class="feld"><span class="lbl">Ausrichtung</span><div class="kompass" role="group" aria-label="Ausrichtung">${KOMPASS.map(x => x
            ? `<button type="button" data-aktion="setze" data-pfad="${pf}.orient" data-wert="${x[1]}" aria-pressed="${String(x[1]) === String(b.orient)}">${x[0]}</button>` : `<span class="mitte">${I.haus}</span>`).join("")}</div></div>` : ""}`)}
      ${karte("Fenster & Türen", `<div style="display:grid;gap:10px">${(b.oeffnungen || []).map((o, j) => {
          const op = `${pf}.oeffnungen.${j}`;
          return `<div class="oeff"><div class="eingabe typ"><select data-pfad="${op}.fensterId" aria-label="Fenstertyp">${fensterWahl.map(f => `<option value="${f.id}"${f.id === o.fensterId ? " selected" : ""}>${esc(f.name)} · Uw ${esc(f.uw)}</option>`).join("")}${o.fensterId ? "" : '<option value="" selected>– Typ wählen –</option>'}</select></div>
            <div class="eingabe"><input type="text" class="zahl" inputmode="decimal" data-pfad="${op}.breite" value="${esc(o.breite || "")}" placeholder="Breite" aria-label="Breite in m"><span class="einheit">m</span></div><span class="mal">×</span>
            <div class="eingabe"><input type="text" class="zahl" inputmode="decimal" data-pfad="${op}.hoehe" value="${esc(o.hoehe || "")}" placeholder="Höhe" aria-label="Höhe in m"><span class="einheit">m</span></div>
            <div class="eingabe"><input type="text" class="zahl" inputmode="numeric" data-pfad="${op}.anzahl" value="${esc(o.anzahl || "1")}" aria-label="Anzahl"><span class="einheit">St.</span></div>
            <button class="icon-knopf" data-aktion="oeffnung-weg" data-j="${j}" aria-label="Öffnung löschen">${I.weg}</button></div>`;
        }).join("")}</div>
        ${fensterWahl.length ? `<div class="reihe"><button class="knopf klein" data-aktion="oeffnung-neu">${I.plus} Fenster / Tür</button></div>` : `<a class="knopf dunkel" href="#/p/${p.id}/fenster">Erst Fenstertypen anlegen ${I.pfeil}</a>`}`)}
      ${karte("Aufbau", passende.length ? `<div class="optionen">${passende.map(x => `<button class="option" data-aktion="setze" data-pfad="${pf}.konstrId" data-wert="${x.id}" aria-pressed="${x.id === b.konstrId}" style="grid-template-columns:minmax(0,1fr) auto">
          <span style="display:grid;gap:6px;min-width:0"><b>${esc(x.name)}</b>${schichtbild(x)}</span>${upill(G.uWert(x, b.art), a.gegWert)}</button>`).join("")}</div>`
        : `<p class="hinweis warn">Noch kein passender Aufbau.</p><a class="knopf dunkel" href="#/p/${p.id}/aufbauten">Aufbau anlegen ${I.pfeil}</a>`)}
      ${b.auto ? `<details class="karte"${zahl(b.flaecheManuell) ? " open" : ""}><summary style="font-weight:600;cursor:pointer">Fläche anpassen</summary>
        ${feld(p, "Bruttofläche selbst eingeben", pf + ".flaecheManuell", { zahl: true, einheit: "m²", platz: "leer = aus den Maßen" })}
        <p class="hinweis">Zum Beispiel bei Vor- und Rücksprüngen. Leer lassen, um wieder aus den Maßen zu rechnen.</p></details>`
      : `<div class="reihe"><button class="knopf klein" data-aktion="bauteil-kopieren">${I.kopie} Kopieren</button><button class="knopf klein gefahr" data-aktion="bauteil-weg">${I.weg} Löschen</button></div>`}
      <div class="weiter"><a class="knopf dunkel" href="#/p/${p.id}/huelle">Fertig ${I.pfeil}</a></div>`;
  }

  // ------------------------------------------------------------ 7 Heizung
  function seiteHeizung(p) {
    kopf("Heizung & Warmwasser", projektName(p), "#/p/" + p.id);
    const h = p.heizung, A = G.auto(p);
    app.innerHTML = `<div></div>
      ${karte("Wärmeerzeuger", `<div class="optionen">${Object.entries(V.heizung).map(([k, v]) => `<button class="option" data-aktion="setze" data-pfad="heizung.preset" data-wert="${k}" aria-pressed="${h.preset === k}">
        <span class="ico">${/^wp/.test(k) ? I.waermepumpe : I.heizung}</span><span><b>${esc(v.name)}</b></span></button>`).join("")}</div>
        <p class="hinweis">Öl, Pellet oder Fernwärme: das Ähnlichste wählen und in EVEBI umstellen.</p>`)}
      ${karte("Angaben", `<div class="felder">${feld(p, "Baujahr Wärmeerzeuger", "heizung.baujahr", { zahl: true, platz: "z. B. 2018" })}
        ${feld(p, "Heizkörper erneuert", "heizung.bjUebergabe", { zahl: true, platz: "Jahr, sonst leer" })}</div>
        <div class="feld"><span class="lbl">Wärmeübergabe</span>${wahl(p, "heizung.uebergabe", [["HZK_HEIZKOERPER", "Heizkörper", P.hk], ["HZK_FLAECHENHZ", "Fußbodenheizung", P.fbh]], { label: "Wärmeübergabe" })}</div>
        <label class="schalter"><span>Hydraulisch abgeglichen<small>mit Nachweis, z. B. nach Heizkörpertausch</small></span><input type="checkbox" data-pfad="heizung.hydr" data-neu="1"${h.hydr ? " checked" : ""}></label>`)}
      ${autoBlock([["Systemtemperatur", h.uebergabe === "HZK_FLAECHENHZ" ? "35/28 °C" : "55/45 °C"], ...(h.preset === "gas_bw_etage" ? [["Thermen", A.we + " (je Wohnung)"]] : []),
        ["Nennleistung", "rechnet EVEBI"], ["Warmwasser", { gas_bw_zentral_speicher: "Kessel mit Speicher", gas_bw_kombi: "Kombitherme", gas_bw_etage: "über die Thermen", gas_nt_dl: "Gas-Durchlauferhitzer", wp_luft: "über die Wärmepumpe" }[h.preset] || "–"], ["Lüftung", "Fensterlüftung"]],
        "Eine Lüftungsanlage stellst du bei Bedarf in EVEBI unter „Belüftung“ ein.")}
      ${weiterKnopf(p, "heizung")}`;
  }

  // ------------------------------------------------------------ 8 Ausweis
  function seiteAusweis(p) {
    kopf("Energieausweis", projektName(p), "#/p/" + p.id);
    const emp = G.empfehlungen(p);
    app.innerHTML = `<div></div>
      ${karte("Anlass", wahl(p, "ea.anlass", ANLASS, { text: true, label: "Anlass" }))}
      ${autoBlock([["Ausstellungsdatum", new Date().toLocaleDateString("de-DE")], ["Ausweisart", "Bedarfsausweis"], ["Gebäudeteil", "ganzes Gebäude"], ["Datenerhebung", "Aussteller"]])}
      ${karte("Modernisierungsempfehlungen", `<p class="hinweis"><span class="a">A</span> Aus Aufbauten, Fenstern und Heizung vorgeschlagen – abwählen, was nicht passt.</p>
        ${emp.length ? emp.map(e => `<label class="schalter"><span>${esc(e.text)}<small>${esc(e.anlagenteil)}${e.paket ? " · im Maßnahmenpaket" : " · Einzelmaßnahme"}</small></span>
          <input type="checkbox" data-empf="${e.key}"${e.aktiv ? " checked" : ""}></label>`).join("") : '<p class="hinweis">Noch keine Vorschläge – die entstehen, sobald Aufbauten und Fenster eingetragen sind.</p>'}
        ${(p.ea.eigene || []).map((m, j) => `<div style="display:grid;gap:8px;padding-top:12px;border-top:1px solid var(--linie)">
          ${feld(p, "Bauteil / Anlagenteil", `ea.eigene.${j}.anlagenteil`, { ganz: true })}
          <textarea data-pfad="ea.eigene.${j}.text" aria-label="Maßnahme" placeholder="Maßnahme">${esc(m.text || "")}</textarea>
          <div><button class="knopf klein gefahr" data-aktion="eigene-weg" data-j="${j}">${I.weg} Entfernen</button></div></div>`).join("")}
        <div class="reihe"><button class="knopf klein" data-aktion="eigene-neu">${I.plus} Eigene Empfehlung</button></div>`)}
      ${weiterKnopf(p, "ausweis")}`;
  }

  // ------------------------------------------------------------ 9 Foto
  function seiteFoto(p) {
    kopf("Gebäudefoto", projektName(p), "#/p/" + p.id);
    app.innerHTML = `<div></div>${karte("Foto für Seite 1 des Ausweises", `${p.foto ? `<img class="foto" src="${p.foto}" alt="Gebäudefoto">`
      : `<label class="foto-leer" for="foto-input"><span style="display:grid;gap:8px;justify-items:center">${I.foto}<span>Straßenseite, ganzes Gebäude im Bild</span></span></label>`}
      <div class="reihe"><label class="knopf haupt" for="foto-input">${p.foto ? "Neues Foto" : "Foto aufnehmen"}</label>
        <input id="foto-input" type="file" accept="image/*" capture="environment" hidden>
        ${p.foto ? `<button class="knopf gefahr" data-aktion="foto-weg">${I.weg} Entfernen</button>` : ""}</div>`)}
      ${weiterKnopf(p, "foto")}`;
  }

  // ------------------------------------------------------------ Export
  let letzteDatei = null;
  function seiteExport(p) {
    kopf("EVEBI-Datei", projektName(p), "#/p/" + p.id);
    const pr = pruefen(p), kw = G.kennwerte(p);
    app.innerHTML = `
      <div class="hero"><div class="kennzahlen"><div class="kz"><b>${de(kw.ve, 0)}</b><span>Ve in m³</span></div><div class="kz"><b>${de(kw.an, 0)}</b><span>AN in m²</span></div>
        <div class="kz"><b>${de(kw.huelle, 0)}</b><span>Hülle in m²</span></div></div>
        <button class="knopf haupt voll" data-aktion="export">${I.export} EVEBI-Datei (.evex) erzeugen</button>
        <button class="knopf voll" data-aktion="teilen" id="teilen" hidden style="background:transparent;color:#fff;border-color:rgba(255,255,255,.35)">${I.teilen} An den PC schicken …</button>
        <div id="export-info" aria-live="polite"></div></div>
      ${karte("Prüfung", `<ul class="pruef">${pr.fehler.map(f => `<li><span class="offen">!</span><span>${esc(f)}</span></li>`).join("")}
        ${pr.ok.map(f => `<li><span class="ok">✓</span><span>${esc(f)}</span></li>`).join("")}</ul>
        ${pr.fehler.length ? '<p class="hinweis warn">Export geht trotzdem – Offenes ergänzt du dann in EVEBI.</p>' : ""}`)}
      ${karte("So geht's weiter", `<p class="hinweis">iPhone: Die Datei liegt in „Dateien“. Android: im Ordner „Downloads“. Per OneDrive, Mail oder WhatsApp an den PC schicken und mit EVEBI öffnen – dort rechnen und den Ausweis ausstellen.</p>`)}
      ${karte("Sicherung", `<p class="hinweis">Alle Eingaben als .json, zum Weiterarbeiten auf einem anderen Gerät.</p><div><button class="knopf klein" data-aktion="sicherung">Sicherung speichern</button></div>`)}`;
  }
  async function exportieren(p) {
    const info = document.getElementById("export-info");
    info.innerHTML = '<p style="margin:0;opacity:.85">Datei wird erzeugt …</p>';
    try {
      const r = await G.erzeugeEvex(p, aussteller);
      letzteDatei = r;
      herunterladen(r.bytes, r.dateiname, "application/octet-stream");
      info.innerHTML = `<p style="margin:0">✓ <b>${esc(r.dateiname)}</b> (${de(r.bytes.length / 1024, 0)} KB)</p>` +
        (r.warnungen.length ? `<ul style="margin:6px 0 0;padding-left:18px;opacity:.9">${r.warnungen.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : "");
      const t = document.getElementById("teilen");
      if (t && teilbar(r)) t.hidden = false;
      toast("EVEBI-Datei erzeugt");
    } catch (e) { info.innerHTML = `<p style="margin:0">Export fehlgeschlagen: ${esc(e.message || e)}</p>`; }
  }
  function teilbar(r) { try { const f = new File([r.bytes], r.dateiname, { type: "application/octet-stream" }); return !!(navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { return false; } }
  function herunterladen(bytes, name, typ) {
    const url = URL.createObjectURL(new Blob([bytes], { type: typ }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  // ------------------------------------------------------------ Live-Werte (ohne Neuzeichnen, Fokus bleibt)
  function aktualisiereLive() {
    const p = aktuell;
    if (!p) return;
    const A = G.auto(p), kw = G.kennwerte(p);
    const werte = { bundesland: BL_NAME[A.bundesland] || "–", bezeichnung: "Wohngebäude " + (p.objekt.ort || "…"), vollgeschosse: A.vollgeschosse,
      weSelbst: A.weSelbst, personen: A.personen, grund: de(A.L * A.B, 2) + " m²", dachvol: de(A.dachVolumen, 1) + " m³", ve: de(A.ve, 1) + " m³",
      gh: de(A.geschosshoehe, 2) + " m", an: de(A.an, 1) + " m²", huelle: de(kw.huelle, 1) + " m²" };
    document.querySelectorAll("[data-live]").forEach(el => {
      const key = el.dataset.live;
      if (key in werte) el.textContent = werte[key];
      else if (key.startsWith("bt:")) {
        const [, bid, f] = key.split(":"), b = kw.bauteile.find(x => x.id === bid);
        if (b) el.textContent = de(b[f], 2) + " m²";
      } else if (key.startsWith("upill:")) {
        const k = p.konstruktionen.find(x => x.id === key.slice(6));
        if (k) { const art = artFuerKonstr(p, k); el.innerHTML = upill(G.uWert(k, art), ART[art].gegWert); }
      }
    });
  }

  // ------------------------------------------------------------ Foto & Toast
  function fotoLaden(datei) {
    return new Promise((ok, fehler) => {
      const url = URL.createObjectURL(datei), img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error("Bild konnte nicht gelesen werden")); };
      img.src = url;
    });
  }
  let toastTimer;
  function toast(text) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 3200);
  }
  function geaendert(p) { p.geaendert = new Date().toISOString(); speichern(); }
  function nachHuellAenderung(p) {
    const verloren = huelleAbgleichen(p);
    if (verloren.length) toast(`Entfernt: ${verloren.map(b => b.name).join(", ")} (mit Fenstern)`);
  }

  // ------------------------------------------------------------ Eingaben
  app.addEventListener("input", e => {
    const el = e.target;
    if (!el.dataset.pfad) return;
    const wert = el.type === "checkbox" ? el.checked : el.value;
    if (route()[0] === "einstellungen") { setzen({ aussteller }, el.dataset.pfad, wert); speichern(); return; }
    const p = aktuell; if (!p) return;
    setzen(p, el.dataset.pfad, wert);
    if (betrifftHuelle(el.dataset.pfad)) nachHuellAenderung(p);
    geaendert(p);
    if (el.dataset.neu) render(false); else aktualisiereLive();
  });
  app.addEventListener("change", async e => {
    const el = e.target, p = aktuell;
    if (el.id === "import") return importieren(el.files[0]);
    if (el.id === "foto-input" && p && el.files[0]) {
      try { p.foto = await fotoLaden(el.files[0]); geaendert(p); speichern(true); render(false); toast("Foto übernommen"); } catch (err) { toast(err.message); }
      return;
    }
    if (el.dataset.empf && p) {
      const aus = new Set(p.ea.aus || []);
      if (el.checked) aus.delete(el.dataset.empf); else aus.add(el.dataset.empf);
      p.ea.aus = [...aus]; geaendert(p); return;
    }
    if (el.dataset.baustoff && p) {
      const s = holen(p, el.dataset.baustoff);
      if (el.value === LUFT) Object.assign(s, { name: "Luftschicht (ruhend)", luft: true, eigen: false, lambda: "", rho: "" });
      else if (el.value === "__eigen") Object.assign(s, { name: "", luft: false, eigen: true });
      else if (BAUSTOFF[el.value]) Object.assign(s, { name: el.value, luft: false, eigen: false, lambda: komma(BAUSTOFF[el.value].lambda), rho: String(BAUSTOFF[el.value].rho) });
      geaendert(p); render(false); return;
    }
    if (el.dataset.pfad && p && /^bauteile\.\d+\.(art|fensterId)$|^objekt\.bundesland$|\.flaecheManuell$|\.dicke$|\.lambda$/.test(el.dataset.pfad)) render(false);
  });
  async function importieren(datei) {
    if (!datei) return;
    try {
      const d = JSON.parse(await datei.text());
      const liste = Array.isArray(d) ? d : (d.objekt && d.bauteile ? [d] : []);
      if (!liste.length) throw new Error("keine Projekte gefunden");
      for (const p of liste) { if (!p.id || projekte.some(x => x.id === p.id)) p.id = neueId(); projekte.push(migrieren(p)); }
      speichern(true); render(); toast(liste.length + " Projekt(e) geöffnet");
    } catch (e) { toast("Sicherung konnte nicht gelesen werden: " + e.message); }
  }

  // ------------------------------------------------------------ Aktionen
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-aktion]");
    if (!btn) return;
    const a = btn.dataset.aktion, p = aktuell, r = route();
    const kon = () => p.konstruktionen.find(x => x.id === r[3]);
    const btl = () => p.bauteile.find(x => x.id === r[3]);
    switch (a) {
      case "neu": { const n = neuesProjekt(); projekte.push(n); speichern(true); location.hash = `#/p/${n.id}/objekt`; break; }
      case "beispiel": { const n = beispielProjekt(); projekte.push(n); speichern(true); location.hash = `#/p/${n.id}`; break; }
      case "setze": {
        const pfad = btn.dataset.pfad;
        let wert = btn.dataset.wert;
        if (/\.(vorne|orient)$/.test(pfad)) wert = Number(wert);
        setzen(p, pfad, wert);
        if (betrifftHuelle(pfad)) nachHuellAenderung(p);
        geaendert(p); render(false); break;
      }
      case "zaehlen": {
        const pfad = btn.dataset.pfad, v = Math.min(+btn.dataset.max, Math.max(+btn.dataset.min, Math.round(zahl(holen(p, pfad), 1)) + +btn.dataset.d));
        setzen(p, pfad, v); if (betrifftHuelle(pfad)) nachHuellAenderung(p); geaendert(p); render(false); break;
      }
      case "bl-aendern": document.getElementById("bl-wahl").hidden = false; break;
      case "bl-auto": p.objekt.bundesland = ""; geaendert(p); render(false); break;
      case "projekt-kopieren": { const n = kopie(p); n.id = neueId(); n.objekt.hausnr = (n.objekt.hausnr || "") + " (Kopie)"; n.geaendert = new Date().toISOString(); projekte.push(n); speichern(true); location.hash = `#/p/${n.id}`; break; }
      case "projekt-loeschen-frage":
        document.getElementById("loeschen-bereich").outerHTML = `<div class="bestaetigen" id="loeschen-bereich"><span>„${esc(projektName(p))}“ mit allen Eingaben von diesem Gerät löschen?</span>
          <div class="reihe"><button class="knopf gefahr" data-aktion="projekt-loeschen">Endgültig löschen</button><button class="knopf" data-aktion="abbrechen">Behalten</button></div></div>`;
        break;
      case "abbrechen": render(false); break;
      case "projekt-loeschen": projekte = projekte.filter(x => x.id !== p.id); speichern(true); location.hash = "#/"; toast("Projekt gelöscht"); break;
      case "konstr-neu": case "konstr-vorlage": {
        const k = a === "konstr-vorlage" ? konstrAusVorlage(KONSTR_VORLAGEN[+btn.dataset.i]) : { id: neueId(), name: "Eigener Aufbau", typ: btn.dataset.typ, schichten: [] };
        p.konstruktionen.push(k);
        p.bauteile.forEach(b => { if (!b.konstrId && ART[b.art].konstr === k.typ) b.konstrId = k.id; });
        geaendert(p);
        if (a === "konstr-neu") location.hash = `#/p/${p.id}/aufbau/${k.id}`; else { render(false); toast(`„${k.name}“ hinzugefügt`); }
        break;
      }
      case "konstr-kopieren": { const k = kopie(kon()); k.id = neueId(); k.name += " (Kopie)"; p.konstruktionen.push(k); geaendert(p); location.hash = `#/p/${p.id}/aufbau/${k.id}`; break; }
      case "konstr-weg": {
        const benutzt = p.bauteile.filter(b => b.konstrId === r[3]).length;
        if (benutzt && !btn.dataset.sicher) { btn.dataset.sicher = "1"; btn.textContent = `Wirklich? ${benutzt} Bauteil(e) verlieren den Aufbau`; break; }
        p.konstruktionen = p.konstruktionen.filter(x => x.id !== r[3]);
        p.bauteile.forEach(b => { if (b.konstrId === r[3]) b.konstrId = standardAufbau(p, b.art); });
        geaendert(p); location.hash = `#/p/${p.id}/aufbauten`; break;
      }
      case "schicht-neu": kon().schichten.push({ name: "", dicke: "", lambda: "", rho: "" }); geaendert(p); render(false); break;
      case "schicht-weg": kon().schichten.splice(+btn.dataset.j, 1); geaendert(p); render(false); break;
      case "schicht-hoch": { const s = kon().schichten, j = +btn.dataset.j; [s[j - 1], s[j]] = [s[j], s[j - 1]]; geaendert(p); render(false); break; }
      case "fenster-neu": case "fenster-vorlage": {
        const v = a === "fenster-vorlage" ? FENSTER_VORLAGEN[+btn.dataset.i] : { name: "Fenster", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "", g: "" };
        const f = { id: neueId(), ...v, baujahr: "" };
        p.fenstertypen.push(f); geaendert(p);
        if (a === "fenster-neu") location.hash = `#/p/${p.id}/fenstertyp/${f.id}`; else { render(false); toast(`„${v.name}“ hinzugefügt`); }
        break;
      }
      case "fenster-weg": {
        p.fenstertypen = p.fenstertypen.filter(x => x.id !== r[3]);
        p.bauteile.forEach(b => (b.oeffnungen || []).forEach(o => { if (o.fensterId === r[3]) o.fensterId = ""; }));
        geaendert(p); location.hash = `#/p/${p.id}/fenster`; break;
      }
      case "bauteil-neu": {
        const art = btn.dataset.art, x = ART[art];
        const b = { id: neueId(), auto: false, art, name: x.label, konstrId: standardAufbau(p, art), oeffnungen: [], laenge: "", hoehe: "",
          orient: x.btl === "WAND" || art === "dach" ? 180 : "", neigung: art === "dach" ? "40" : "" };
        p.bauteile.push(b); geaendert(p); location.hash = `#/p/${p.id}/bauteil/${b.id}`; break;
      }
      case "bauteil-kopieren": { const b = kopie(btl()); b.id = neueId(); b.name += " (Kopie)"; (b.oeffnungen || []).forEach(o => { o.id = neueId(); }); p.bauteile.push(b); geaendert(p); location.hash = `#/p/${p.id}/bauteil/${b.id}`; break; }
      case "bauteil-weg": p.bauteile = p.bauteile.filter(x => x.id !== r[3]); geaendert(p); location.hash = `#/p/${p.id}/huelle`; break;
      case "oeffnung-neu": {
        const b = btl(), a2 = ART[b.art];
        const letzte = (b.oeffnungen || []).slice(-1)[0];
        const passend = letzte ? p.fenstertypen.find(f => f.id === letzte.fensterId)
          : p.fenstertypen.find(f => a2.btl === "WAND" ? f.art === "FART_STANDARD" : f.art === "FART_DACHFENSTER") || p.fenstertypen[0];
        (b.oeffnungen = b.oeffnungen || []).push({ id: neueId(), fensterId: passend ? passend.id : "", breite: "", hoehe: "", anzahl: "1" });
        geaendert(p); render(false);
        const felder = app.querySelectorAll(".oeff input[data-pfad$='.breite']");
        if (felder.length) felder[felder.length - 1].focus();
        break;
      }
      case "oeffnung-weg": btl().oeffnungen.splice(+btn.dataset.j, 1); geaendert(p); render(false); break;
      case "eigene-neu": (p.ea.eigene = p.ea.eigene || []).push({ id: neueId(), anlagenteil: "", text: "", paket: false }); geaendert(p); render(false); break;
      case "eigene-weg": p.ea.eigene.splice(+btn.dataset.j, 1); geaendert(p); render(false); break;
      case "foto-weg": p.foto = null; geaendert(p); speichern(true); render(false); break;
      case "export": speichern(true); await exportieren(p); break;
      case "teilen":
        if (!letzteDatei) break;
        try { await navigator.share({ files: [new File([letzteDatei.bytes], letzteDatei.dateiname, { type: "application/octet-stream" })], title: letzteDatei.dateiname }); }
        catch (err) { if (err && err.name !== "AbortError") toast("Teilen nicht möglich – die Datei liegt bei den Downloads."); }
        break;
      case "sicherung":
        herunterladen(new TextEncoder().encode(JSON.stringify(p, null, 1)), (projektName(p) + " – HK Aufnahme.json").replace(/[\\/:*?"<>|]+/g, " "), "application/json");
        toast("Sicherung gespeichert"); break;
    }
  });
  zurueckEl.addEventListener("click", () => { location.hash = zurueckEl.dataset.ziel || "#/"; });
  document.getElementById("einstellungen").addEventListener("click", () => { location.hash = "#/einstellungen"; });
  window.addEventListener("hashchange", () => render(true));
  window.addEventListener("pagehide", () => speichern(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") speichern(true); });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  if (!V || !G) { app.innerHTML = '<p class="hinweis warn">App-Dateien unvollständig geladen. Bitte neu laden.</p>'; return; }
  projekte.forEach(p => { if (!p.bauteile.length || p.bauteile.some(b => b.auto)) huelleAbgleichen(p); });
  render();
})();

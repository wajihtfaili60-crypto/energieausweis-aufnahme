/* HK Aufnahme – Datenaufnahme für Energieausweise am Handy, Export als EVEBI-Projekt (.evex).
 * Alle Daten bleiben im Browser des Geräts (localStorage). Kein Server. */
(function () {
  "use strict";
  const G = window.EvexGen;
  const V = window.EVEX_VORLAGE;
  const SP_PROJEKTE = "hkAufnahme.projekte.v1";
  const SP_AUSSTELLER = "hkAufnahme.aussteller.v1";
  const app = document.getElementById("app");
  const titelEl = document.getElementById("titel");
  const zurueckEl = document.getElementById("zurueck");

  // ------------------------------------------------------------ Hilfen
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const zahl = (x, d = 0) => { const v = typeof x === "string" ? Number(x.replace(/\s/g, "").replace(",", ".")) : Number(x); return Number.isFinite(v) ? v : d; };
  const de = (x, n = 2) => Number.isFinite(x) ? x.toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n }) : "–";
  const neueId = () => Math.random().toString(36).slice(2, 9);
  const heute = () => new Date().toISOString().slice(0, 10);
  const kopie = o => JSON.parse(JSON.stringify(o));

  const ICON = {
    zurueck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    stift: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.2V21h3.8L17.8 10l-3.8-3.8L3 17.2zM20.7 7.1a1 1 0 000-1.4l-2.4-2.4a1 1 0 00-1.4 0l-1.8 1.8 3.8 3.8 1.8-1.8z"/></svg>',
    projekt: '<svg viewBox="0 0 24 24" fill="none" stroke="#2463b5" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    allgemein: '<svg viewBox="0 0 24 24" fill="none" stroke="#b5452a" stroke-width="2"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    geometrie: '<svg viewBox="0 0 24 24" fill="none" stroke="#6d9a0c" stroke-width="2"><path d="M3 21h18M3 21V3M7 17l10-10M14 7h3v3"/></svg>',
    konstr: '<svg viewBox="0 0 24 24" fill="#8a6a3a"><rect x="3" y="4" width="4" height="16"/><rect x="9" y="4" width="3" height="16" fill="#e0b84a"/><rect x="14" y="4" width="7" height="16" fill="#b5452a"/></svg>',
    fenster: '<svg viewBox="0 0 24 24" fill="none" stroke="#2463b5" stroke-width="2"><rect x="4" y="3" width="16" height="18"/><path d="M12 3v18M4 12h16"/></svg>',
    bauteil: '<svg viewBox="0 0 24 24" fill="none" stroke="#5b5f63" stroke-width="2"><path d="M4 20V9l8-5 8 5v11z"/><rect x="9" y="12" width="6" height="8" fill="#9cc31b" stroke="none"/></svg>',
    heizung: '<svg viewBox="0 0 24 24" fill="none" stroke="#c0272d" stroke-width="2"><path d="M7 21V8M12 21V5M17 21V8M4 21h16"/></svg>',
    lueftung: '<svg viewBox="0 0 24 24" fill="none" stroke="#2a8fb5" stroke-width="2"><path d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h8"/></svg>',
    ausweis: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#c0272d"/><path d="M8 7v10M16 7v10M8 12h8" stroke="#fff" stroke-width="2.4"/></svg>',
    foto: '<svg viewBox="0 0 24 24" fill="none" stroke="#5b5f63" stroke-width="2"><path d="M4 7h4l2-2h4l2 2h4v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="#6d9a0c" stroke-width="2.2"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
    weg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
    hoch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 14l6-6 6 6"/></svg>',
    kopie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/></svg>',
  };

  // ------------------------------------------------------------ Fachlisten
  const BUNDESLAENDER = [["BL_BW", "Baden-Württemberg"], ["BL_BY", "Bayern"], ["BL_BE", "Berlin"], ["BL_BB", "Brandenburg"], ["BL_HB", "Bremen"],
    ["BL_HH", "Hamburg"], ["BL_HE", "Hessen"], ["BL_MV", "Mecklenburg-Vorpommern"], ["BL_NI", "Niedersachsen"], ["BL_NW", "Nordrhein-Westfalen"],
    ["BL_RP", "Rheinland-Pfalz"], ["BL_SL", "Saarland"], ["BL_SN", "Sachsen"], ["BL_ST", "Sachsen-Anhalt"], ["BL_SH", "Schleswig-Holstein"], ["BL_TH", "Thüringen"]];
  const GEBAEUDEART = [["GEBV_FREISTEHEND", "freistehend"], ["GEBV_ANGEBAUT", "einseitig angebaut (Doppelhaushälfte, Reihenendhaus)"], ["GEBV_REIHENBEBAUUNG", "zweiseitig angebaut (Reihenmittelhaus)"]];
  const KELLER = [["KK_KEINKELLER", "kein Keller"], ["KK_KELLER_UNBEH", "Keller unbeheizt"], ["KK_KELLER_TEILW_BEH", "Keller teilweise beheizt"], ["KK_KELLER_BEH", "Keller beheizt"]];
  const DACH = [["DK_DACH_UNBEH", "Dachraum unbeheizt"], ["DK_DACH_TEILW_BEH", "Dach teilweise beheizt"], ["DK_DACH_BEH", "Dach beheizt (ausgebaut)"], ["DK_FLACHDACH", "Flachdach"]];
  const ANLASS = [["AG_VERMIETUNG", "Vermietung / Verkauf"], ["AG_MODERNISIERUNG", "Modernisierung (Änderung/Erweiterung)"], ["AG_NEUBAU", "Neubau"], ["AG_SONST", "Sonstiges (freiwillig)"], ["AG_AUSHANG", "Aushang"]];
  const WBZ = [["0.1", "0,10 W/(m²K) – pauschal, Bestand"], ["0.05", "0,05 W/(m²K) – Gleichwertigkeitsnachweis"], ["0.15", "0,15 W/(m²K) – ungünstige Details"], ["0.03", "0,03 W/(m²K) – detaillierter Nachweis"]];
  const HKTEMP = [["HKTEMP_35_28", "35/28 °C"], ["HKTEMP_55_45", "55/45 °C"], ["HKTEMP_70_55", "70/55 °C"], ["HKTEMP_90_70", "90/70 °C"]];
  const HYDR = [["HYA_NONE", "nicht abgeglichen"], ["HYA_STATISCH_OHNE_GRUPPE", "statisch abgeglichen"], ["HYA_STATISCH_MIT_GRUPPE_STAT", "statisch, mit Gruppenabgleich statisch"],
    ["HYA_STATISCH_MIT_GRUPPE_DYN", "statisch, mit Gruppenabgleich dynamisch"], ["HYA_DYNAMISCH", "dynamisch abgeglichen"]];
  const RAHMEN = [["RMAT_RAHMEN_KST", "Kunststoff"], ["RMAT_RAHMEN_HOLZ", "Holz"], ["RMAT_RAHMEN_ALUMINIUM", "Aluminium"], ["RMAT_RAHMEN_HOLZ_ALU", "Holz-Alu"]];
  const FENSTERART = [["FART_STANDARD", "Fenster / Fenstertür"], ["FART_AUSSENTUER", "Haustür / Außentür"], ["FART_DACHFENSTER", "Dachflächenfenster"]];
  const KONSTR_TYP = [["wand", "Wand"], ["dach", "Dach / Decke nach oben"], ["boden", "Boden / Decke nach unten"]];
  const ORIENT = [["N", 0], ["NO", 45], ["O", 90], ["SO", 135], ["S", 180], ["SW", 225], ["W", 270], ["NW", 315]];
  const ORIENT_NAME = Object.fromEntries(ORIENT.map(([n, g]) => [g, n]));
  const ART = G.BAUTEILARTEN;
  const STANDARD_ART = { wand: "aw", dach: "dach", boden: "bp" };

  // λ-Richtwerte nach DIN 4108-4 / DIN EN ISO 10456 – bei Bedarf überschreiben
  const BAUSTOFFE = [
    ["Putz & Bekleidung", [["Kalkgipsputz", 0.70, 1400], ["Gipsputz ohne Zuschlag", 0.51, 1200], ["Kalkzementputz", 1.00, 1800], ["Leichtputz", 0.56, 1300],
      ["Gipskartonplatte", 0.25, 900], ["Holzwolle-Leichtbauplatte", 0.09, 400], ["Fliesen", 1.30, 2300]]],
    ["Mauerwerk", [["Kalksandstein (ρ 1800)", 0.99, 1800], ["Kalksandstein (ρ 1400)", 0.70, 1400], ["Vollziegel (ρ 1800)", 0.81, 1800],
      ["Vormauerziegel / Klinker", 0.96, 2000], ["Hochlochziegel alt (ρ 1200)", 0.50, 1200], ["Hochlochziegel alt (ρ 1400)", 0.58, 1400],
      ["Wärmedämmziegel (λ 0,12)", 0.12, 700], ["Porenbeton (ρ 500)", 0.16, 500], ["Porenbeton alt (ρ 600)", 0.22, 600],
      ["Leichtbeton-Hohlblock / Bims", 0.45, 1000], ["Natursandstein", 2.30, 2300]]],
    ["Beton & Estrich", [["Stahlbeton", 2.30, 2400], ["Beton unbewehrt", 1.65, 2200], ["Zementestrich", 1.40, 2000], ["Anhydritestrich", 1.20, 2100],
      ["Gussasphaltestrich", 0.70, 2300], ["Trockenestrich (Gipsfaser)", 0.32, 1150]]],
    ["Dämmstoffe", [["Mineralwolle WLS 032", 0.032, 30], ["Mineralwolle WLS 035", 0.035, 30], ["Mineralwolle WLS 040", 0.040, 30],
      ["Mineralwolle WLS 045", 0.045, 30], ["EPS WLS 032", 0.032, 20], ["EPS WLS 035", 0.035, 20], ["EPS WLS 040", 0.040, 20],
      ["XPS WLS 035", 0.035, 35], ["PUR/PIR WLS 024", 0.024, 30], ["PUR/PIR WLS 028", 0.028, 30], ["Holzfaser WLS 040", 0.040, 160],
      ["Zellulose WLS 040", 0.040, 50], ["Perlite-Schüttung", 0.060, 100], ["Kork WLS 045", 0.045, 120]]],
    ["Holz & Platten", [["Nadelholz / Dielen", 0.13, 500], ["OSB-Platte", 0.13, 650], ["Spanplatte", 0.14, 700], ["Holzschalung", 0.13, 500]]],
    ["Sonstiges", [["Bitumenbahn", 0.17, 1100], ["Dachziegel / Dachstein", 1.00, 2000]]],
  ];
  const BAUSTOFF = {};
  for (const [, l] of BAUSTOFFE) for (const [n, la, r] of l) BAUSTOFF[n] = { lambda: la, rho: r };
  const LUFT = "Luftschicht, ruhend";

  const KONSTR_VORLAGEN = [
    { name: "Zweischaliges Mauerwerk 36,5 cm, Luftschicht ungedämmt", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Kalksandstein (ρ 1800)", 17.5], [LUFT, 6], ["Vormauerziegel / Klinker", 11.5]] },
    { name: "Zweischaliges Mauerwerk mit Kerndämmung", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Kalksandstein (ρ 1800)", 17.5], ["Mineralwolle WLS 035", 6], ["Vormauerziegel / Klinker", 11.5]] },
    { name: "Hochlochziegel 30 cm, verputzt", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Hochlochziegel alt (ρ 1200)", 30], ["Kalkzementputz", 2]] },
    { name: "Kalksandstein 17,5 cm + WDVS 14 cm", typ: "wand", s: [["Kalkgipsputz", 1.5], ["Kalksandstein (ρ 1800)", 17.5], ["EPS WLS 035", 14], ["Leichtputz", 1]] },
    { name: "Oberste Geschossdecke Beton, 5 cm Dämmung", typ: "dach", s: [["Kalkgipsputz", 1], ["Stahlbeton", 16], ["Mineralwolle WLS 040", 5]] },
    { name: "Oberste Geschossdecke Holzbalken, 10 cm Mineralwolle", typ: "dach", s: [["Gipskartonplatte", 1.25], ["Mineralwolle WLS 040", 10], ["Nadelholz / Dielen", 2.4]] },
    { name: "Steildach Zwischensparren 14 cm (ohne Sparrenanteil)", typ: "dach", s: [["Gipskartonplatte", 1.25], ["Mineralwolle WLS 035", 14]] },
    { name: "Bodenplatte ungedämmt", typ: "boden", s: [["Zementestrich", 5], ["Stahlbeton", 15]] },
    { name: "Bodenplatte mit 4 cm Dämmung unter Estrich", typ: "boden", s: [["Zementestrich", 5], ["EPS WLS 040", 4], ["Stahlbeton", 15]] },
    { name: "Kellerdecke Beton ungedämmt", typ: "boden", s: [["Zementestrich", 4], ["Stahlbeton", 16]] },
    { name: "Kellerdecke + 10 cm Dämmung unterseitig", typ: "boden", s: [["Zementestrich", 4], ["Stahlbeton", 16], ["Mineralwolle WLS 035", 10]] },
  ];
  const FENSTER_VORLAGEN = [
    { name: "Holzfenster, Einfachverglasung", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_HOLZ", uw: "5,0", g: "0,87" },
    { name: "Fenster, Isolierverglasung 2-fach (1978–1994)", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "2,7", g: "0,76" },
    { name: "Kunststofffenster, 2-fach-Wärmeschutz (1995–2007)", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "1,6", g: "0,60" },
    { name: "Kunststofffenster, 2-fach-Wärmeschutz (ab 2008)", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "1,3", g: "0,60" },
    { name: "Kunststofffenster, 3-fach-Wärmeschutz", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "0,9", g: "0,50" },
    { name: "Haustür Bestand, ungedämmt", art: "FART_AUSSENTUER", rahmen: "RMAT_RAHMEN_HOLZ", uw: "2,9", g: "0,50" },
    { name: "Haustür neu, gedämmt", art: "FART_AUSSENTUER", rahmen: "RMAT_RAHMEN_KST", uw: "1,3", g: "0,50" },
    { name: "Dachflächenfenster, 2-fach", art: "FART_DACHFENSTER", rahmen: "RMAT_RAHMEN_HOLZ", uw: "1,4", g: "0,60" },
  ];
  const ANLAGENTEILE = ["Außenwand gg. Außenluft", "Dach", "Oberste Geschossdecke", "Kellerdecke", "Fußboden", "Fenster", "Haustür", "Heizung", "Warmwasser", "Lüftung", "Erneuerbare Energien"];
  const MOD_VORSCHLAEGE = [
    ["Außenwand gg. Außenluft", "Kerndämmung der Hohlschicht im zweischaligen Mauerwerk (Einblasdämmung)", true],
    ["Außenwand gg. Außenluft", "Dämmung der Außenwände gemäß gültiger Verordnung, 14–16 cm", true],
    ["Oberste Geschossdecke", "Dämmung der obersten Geschossdecke gemäß gültiger Verordnung, 16–20 cm", true],
    ["Dach", "Dämmung der Dachflächen zwischen und unter den Sparren", true],
    ["Kellerdecke", "Dämmung der Kellerdecke von unten, 10–12 cm", true],
    ["Fenster", "Austausch der Fenster, Uw ≤ 0,95 W/(m²K)", true],
    ["Heizung", "Hydraulischer Abgleich und Optimierung der Regelungstechnik", false],
    ["Heizung", "Umstellung auf Wärmepumpe", false],
    ["Erneuerbare Energien", "Photovoltaikanlage auf der Dachfläche", false],
  ];

  // ------------------------------------------------------------ Speicher
  function lesen(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  let projekte = lesen(SP_PROJEKTE, []);
  let aussteller = lesen(SP_AUSSTELLER, {});
  let speicherTimer = null;
  function speichern(sofort) {
    clearTimeout(speicherTimer);
    const tun = () => {
      try {
        localStorage.setItem(SP_PROJEKTE, JSON.stringify(projekte));
        localStorage.setItem(SP_AUSSTELLER, JSON.stringify(aussteller));
      } catch (e) {
        toast("Speichern fehlgeschlagen: Speicher des Browsers ist voll. Foto entfernen oder alte Projekte sichern und löschen.");
      }
    };
    if (sofort) tun(); else speicherTimer = setTimeout(tun, 350);
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  function neuesProjekt() {
    return {
      id: neueId(), angelegt: new Date().toISOString(), geaendert: new Date().toISOString(),
      projekt: { bezeichnung: "" }, objekt: { bundesland: "BL_NI" }, kunde: {},
      allg: { gebaeudeArt: "GEBV_FREISTEHEND", keller: "KK_KEINKELLER", dach: "DK_DACH_UNBEH", we: "1", weSelbst: "1", geschosse: "2", vollgeschosse: "2", wbz: "0.1" },
      geo: { raumhoehe: "2,50", geschosshoehe: "2,75" },
      konstruktionen: [], fenstertypen: [], bauteile: [],
      heizung: { preset: "gas_bw_zentral_speicher", uebergabe: "HZK_HEIZKOERPER", hkTemp: "HKTEMP_55_45", hydr: "HYA_NONE" },
      ea: { anlass: "AG_VERMIETUNG", datum: heute(), datenEigentuemer: false, modernisierungen: [] },
      foto: null,
    };
  }
  function konstrAusVorlage(v) {
    return {
      id: neueId(), name: v.name, typ: v.typ,
      schichten: v.s.map(([n, d]) => n === LUFT ? { name: "Luftschicht (ruhend)", dicke: String(d).replace(".", ","), luft: true }
        : { name: n, dicke: String(d).replace(".", ","), lambda: String(BAUSTOFF[n].lambda).replace(".", ","), rho: String(BAUSTOFF[n].rho) }),
    };
  }
  function beispielProjekt() {
    const p = neuesProjekt();
    p.projekt.bezeichnung = "Beispiel: Doppelhaushälfte, 2 Wohnungen";
    Object.assign(p.objekt, { strasse: "Beispielweg", hausnr: "12", plz: "26603", ort: "Aurich" });
    Object.assign(p.allg, { baujahr: "1970", gebaeudeArt: "GEBV_ANGEBAUT", we: "2", weSelbst: "0", wfl: "145,37", personen: "4" });
    Object.assign(p.geo, { laenge: "8,995", breite: "10,49", hoehe: "5,70" });
    const aw = konstrAusVorlage(KONSTR_VORLAGEN[0]), ogd = konstrAusVorlage(KONSTR_VORLAGEN[4]), bp = konstrAusVorlage(KONSTR_VORLAGEN[7]);
    p.konstruktionen = [aw, ogd, bp];
    const f = { id: neueId(), ...FENSTER_VORLAGEN[4], baujahr: "2026" }, t = { id: neueId(), ...FENSTER_VORLAGEN[6], baujahr: "2026" };
    p.fenstertypen = [f, t];
    const o = (name, fid, b, h, n = 1) => ({ id: neueId(), name, fensterId: fid, breite: b, hoehe: h, anzahl: String(n) });
    p.bauteile = [
      { id: neueId(), art: "bp", name: "Bodenplatte", konstrId: bp.id, laenge: "8,995", hoehe: "10,49", baujahr: "1970", oeffnungen: [] },
      { id: neueId(), art: "ogd", name: "Oberste Geschossdecke", konstrId: ogd.id, laenge: "8,995", hoehe: "10,49", baujahr: "1970", oeffnungen: [] },
      { id: neueId(), art: "aw", name: "Außenwand Süd (Terrasse)", konstrId: aw.id, orient: 180, laenge: "8,995", hoehe: "5,70", baujahr: "1970",
        oeffnungen: [o("Wohnzimmer EG + OG", f.id, "2,00", "1,51", 2), o("Terrassen-/Balkontür", f.id, "1,01", "2,135", 2), o("Küche EG + OG", f.id, "1,76", "1,26", 2)] },
      { id: neueId(), art: "aw", name: "Außenwand West (Giebel)", konstrId: aw.id, orient: 270, laenge: "10,49", hoehe: "5,70", baujahr: "1970",
        oeffnungen: [o("Giebelfenster", f.id, "1,38", "1,38", 4)] },
      { id: neueId(), art: "aw", name: "Außenwand Nord (Eingang)", konstrId: aw.id, orient: 0, laenge: "8,995", hoehe: "5,70", baujahr: "1970",
        oeffnungen: [o("Kinderzimmer", f.id, "1,76", "1,385", 2), o("WC", f.id, "0,76", "0,885", 2), o("Haustüren", t.id, "1,01", "2,135", 2)] },
    ];
    p.heizung = { preset: "gas_bw_etage", baujahr: "2018", anzahl: "2", uebergabe: "HZK_HEIZKOERPER", hkTemp: "HKTEMP_55_45", hydr: "HYA_NONE", bjUebergabe: "2026" };
    p.ea.modernisierungen = [{ id: neueId(), anlagenteil: MOD_VORSCHLAEGE[0][0], text: MOD_VORSCHLAEGE[0][1], paket: true },
      { id: neueId(), anlagenteil: MOD_VORSCHLAEGE[2][0], text: MOD_VORSCHLAEGE[2][1], paket: true }];
    return p;
  }

  // ------------------------------------------------------------ Pfad-Bindung
  function holen(obj, pfad) { return pfad.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setzen(obj, pfad, wert) {
    const teile = pfad.split(".");
    let o = obj;
    for (let i = 0; i < teile.length - 1; i++) {
      if (o[teile[i]] == null) o[teile[i]] = /^\d+$/.test(teile[i + 1]) ? [] : {};
      o = o[teile[i]];
    }
    o[teile[teile.length - 1]] = wert;
  }

  // ------------------------------------------------------------ Bausteine
  const opt = (liste, wert) => liste.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(wert) ? " selected" : ""}>${esc(t)}</option>`).join("");
  const badge = b => b === "a" ? '<span class="badge a" title="berechnet">A</span>' : b === "s" ? `<span class="badge s" title="Eingabe">${ICON.stift}</span>` : "<span></span>";
  let feldNr = 0;
  function feld(p, label, pfad, o = {}) {
    const id = "f" + (++feldNr);
    const wert = holen(p, pfad);
    const typ = o.typ || "text";
    const attr = [o.zahl ? 'class="zahl" inputmode="decimal"' : "", o.platz ? `placeholder="${esc(o.platz)}"` : "",
      o.liste ? `list="${o.liste}"` : "", typ === "tel" ? 'inputmode="tel"' : "", o.auto ? `autocomplete="${o.auto}"` : 'autocomplete="off"'].join(" ");
    return `<div class="feld${o.breit ? " breit" : ""}"><label for="${id}">${esc(label)}</label>
      <input id="${id}" type="${typ}" data-pfad="${esc(pfad)}" value="${esc(wert == null ? "" : wert)}" ${attr}>
      ${o.breit ? "" : `<span class="einheit">${esc(o.einheit || "")}</span>${badge(o.badge || "s")}`}</div>`;
  }
  function auswahl(p, label, pfad, liste, o = {}) {
    const id = "f" + (++feldNr);
    return `<div class="feld${o.breit ? " breit" : ""}"><label for="${id}">${esc(label)}</label>
      <select id="${id}" data-pfad="${esc(pfad)}">${o.leer ? `<option value="">${esc(o.leer)}</option>` : ""}${opt(liste, holen(p, pfad))}</select>
      ${o.breit ? "" : `<span class="einheit">${esc(o.einheit || "")}</span>${badge("s")}`}</div>`;
  }
  const anzeige = (label, live, einheit) => `<div class="feld"><span class="lbl">${esc(label)}</span>
      <input type="text" class="zahl" readonly data-live="${live}" value="" tabindex="-1" aria-label="${esc(label)}"><span class="einheit">${esc(einheit || "")}</span>${badge("a")}</div>`;
  const panel = (titel, inhalt, kopfRechts) => `<section class="panel">${kopfRechts ? `<div class="panel-kopf"><span>${esc(titel)}</span>${kopfRechts}</div>` : `<h2>${esc(titel)}</h2>`}<div class="inhalt">${inhalt}</div></section>`;

  // ------------------------------------------------------------ Kennwerte & Prüfung
  function pruefen(p) {
    const fehler = [], ok = [];
    const o = p.objekt || {}, a = p.allg || {}, g = p.geo || {};
    (o.strasse && o.plz && o.ort ? ok : fehler).push("Objektadresse");
    (zahl(a.baujahr) > 1700 ? ok : fehler).push("Baujahr");
    (zahl(a.wfl) > 0 ? ok : fehler).push("Wohnfläche");
    ((zahl(g.laenge) > 0 && zahl(g.breite) > 0 && (zahl(g.hoehe) > 0 || zahl(g.veManuell) > 0)) ? ok : fehler).push("Gebäudemaße (Länge, Breite, Höhe)");
    ((p.bauteile || []).length ? ok : fehler).push("Bauteile der Hülle");
    ((p.bauteile || []).some(b => ART[b.art] && ART[b.art].boden) ? ok : fehler).push("Bodenbauteil (Bodenplatte oder Kellerdecke)");
    const ohneK = (p.bauteile || []).filter(b => !(p.konstruktionen || []).some(k => k.id === b.konstrId));
    if (ohneK.length) fehler.push("Konstruktion fehlt bei: " + ohneK.map(b => b.name || ART[b.art].label).join(", ")); else if ((p.bauteile || []).length) ok.push("Alle Bauteile haben eine Konstruktion");
    const ohneF = (p.bauteile || []).filter(b => (b.oeffnungen || []).some(x => !(p.fenstertypen || []).some(f => f.id === x.fensterId)));
    if (ohneF.length) fehler.push("Fenstertyp fehlt bei Öffnungen in: " + ohneF.map(b => b.name).join(", "));
    const kw = G.kennwerte(p);
    for (const b of kw.bauteile) if (b.oeff > b.brutto + 0.01) fehler.push(`Öffnungen größer als die Fläche: ${(p.bauteile.find(x => x.id === b.id) || {}).name}`);
    (p.heizung && p.heizung.preset ? ok : fehler).push("Heizung");
    return { fehler, ok };
  }
  function aktualisiereLive(p) {
    const kw = G.kennwerte(p);
    const werte = {
      grund: zahl(p.geo.laenge) * zahl(p.geo.breite), ve: kw.ve, an: kw.an, huelle: kw.huelle, ave: kw.aVe,
      nBauteile: (p.bauteile || []).length,
    };
    document.querySelectorAll("[data-live]").forEach(el => {
      const key = el.dataset.live;
      let v = null;
      if (key in werte) v = werte[key];
      else if (key.startsWith("u:")) {
        const k = p.konstruktionen.find(x => x.id === key.slice(2));
        const b = k && (p.bauteile || []).find(x => x.konstrId === k.id);
        v = k ? G.uWert(k, b ? b.art : STANDARD_ART[k.typ]) : null;
      } else if (key.startsWith("bt:")) {
        const [, bid, feldname] = key.split(":");
        const b = kw.bauteile.find(x => x.id === bid);
        v = b ? b[feldname] : null;
      }
      const txt = v == null || !Number.isFinite(v) ? "–" : de(v, key === "nBauteile" ? 0 : 2);
      if ("value" in el && el.tagName === "INPUT") el.value = txt; else el.textContent = txt;
    });
  }

  // ------------------------------------------------------------ Router
  let aktuell = null;
  function route() {
    const h = (location.hash || "#/").slice(1).split("/").filter(Boolean);
    return h;
  }
  function projektVon(id) { return projekte.find(p => p.id === id); }
  function geaendert(p) { p.geaendert = new Date().toISOString(); speichern(); }

  function render() {
    feldNr = 0;
    const r = route();
    window.scrollTo(0, 0);
    if (r[0] === "einstellungen") { aktuell = null; return seiteEinstellungen(); }
    if (r[0] === "p") {
      const p = projektVon(r[1]);
      if (!p) { location.hash = "#/"; return; }
      aktuell = p;
      if (!r[2]) return seiteProjekt(p);
      if (r[2] === "konstruktion" && r[3]) return seiteKonstruktion(p, r[3]);
      if (r[2] === "fenstertyp" && r[3]) return seiteFenstertyp(p, r[3]);
      if (r[2] === "bauteil" && r[3]) return seiteBauteil(p, r[3]);
      const s = ABSCHNITTE.find(x => x.key === r[2]);
      if (s) return s.seite(p);
      location.hash = "#/p/" + p.id; return;
    }
    aktuell = null;
    seiteStart();
  }
  function kopf(titel, unter, zurueck) {
    titelEl.innerHTML = `${esc(titel)}${unter ? `<small>${esc(unter)}</small>` : ""}`;
    zurueckEl.hidden = !zurueck;
    zurueckEl.dataset.ziel = zurueck || "";
    document.title = titel === "HK Aufnahme" ? "HK Aufnahme" : titel + " – HK Aufnahme";
  }
  const adresse = p => [[p.objekt.strasse, p.objekt.hausnr].filter(Boolean).join(" "), [p.objekt.plz, p.objekt.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const projektName = p => p.projekt.bezeichnung || adresse(p) || "Neues Projekt";

  // ------------------------------------------------------------ Startseite
  function seiteStart() {
    kopf("HK Aufnahme", "Energieausweis-Daten für EVEBI", null);
    const liste = projekte.slice().sort((a, b) => (b.geaendert || "").localeCompare(a.geaendert || ""));
    app.innerHTML = `
      ${panel("Projekte", liste.length ? `<div class="liste">${liste.map(p => {
        const pr = pruefen(p);
        return `<a class="zeile" href="#/p/${p.id}"><span><span class="titel">${esc(projektName(p))}</span>
          <span class="unter">${esc(adresse(p) || "ohne Adresse")} · ${(p.bauteile || []).length} Bauteile · ${new Date(p.geaendert).toLocaleDateString("de-DE")}</span></span>
          <span class="chip ${pr.fehler.length ? "offen" : "ok"}">${pr.fehler.length ? pr.fehler.length + " offen" : "bereit"}</span></a>`;
      }).join("")}</div>` : `<p class="hinweis">Noch kein Projekt auf diesem Gerät. Lege ein neues an oder schau dir das Beispiel an: eine Doppelhaushälfte mit allen Eingaben, fertig zum Export.</p>`)}
      <div class="reihe">
        <button class="knopf haupt" data-aktion="neu">${ICON.plus} Neues Projekt</button>
        <button class="knopf" data-aktion="beispiel">Beispiel laden</button>
        <label class="knopf" for="import">Sicherung öffnen</label>
        <input id="import" type="file" accept=".json,application/json" hidden>
      </div>
      ${panel("So funktioniert's", `<ol class="hinweis" style="margin:0;padding-left:18px;display:grid;gap:4px">
        <li>Vor Ort alles eingeben: Gebäude, Konstruktionen, Bauteile mit Fenstern, Heizung, Ausweis-Angaben, Foto.</li>
        <li>Unter <b>Export</b> die EVEBI-Datei (.evex) erzeugen und z. B. per OneDrive, Mail oder WhatsApp an den PC schicken.</li>
        <li>Am PC die .evex mit EVEBI öffnen, prüfen, rechnen und den Ausweis ausstellen.</li></ol>
        <p class="hinweis">Die Daten bleiben nur auf diesem Gerät gespeichert. Für den Wechsel auf ein anderes Gerät nutze „Sicherung“ im Export.</p>`)}`;
  }

  // ------------------------------------------------------------ Einstellungen (Aussteller)
  function seiteEinstellungen() {
    kopf("Aussteller", "wird in jede EVEBI-Datei übernommen", "#/");
    const a = { aussteller };
    app.innerHTML = panel("Aussteller / Planer", `
      <p class="hinweis">Diese Angaben stehen später als Aussteller im Energieausweis. Sie bleiben nur auf diesem Gerät.</p>
      ${feld(a, "Firma", "aussteller.firma", { auto: "organization" })}
      ${auswahl(a, "Anrede", "aussteller.anrede", [["Herr", "Herr"], ["Frau", "Frau"]], { leer: "–" })}
      ${feld(a, "Vorname", "aussteller.vorname", { auto: "given-name" })}
      ${feld(a, "Nachname", "aussteller.nachname", { auto: "family-name" })}
      ${feld(a, "Straße", "aussteller.strasse")}${feld(a, "Hausnummer", "aussteller.hausnr")}
      ${feld(a, "PLZ", "aussteller.plz", { zahl: true })}${feld(a, "Ort", "aussteller.ort")}
      ${feld(a, "Telefon", "aussteller.telefon", { typ: "tel" })}${feld(a, "E-Mail", "aussteller.email", { typ: "email" })}
      ${feld(a, "BAFA-Beraternummer", "aussteller.bafaNr")}
      <p class="hinweis">Logo und Unterschrift fügst du in EVEBI unter „Planeradresse“ hinzu.</p>`);
  }

  // ------------------------------------------------------------ Projektbaum
  const ABSCHNITTE = [
    { key: "projekt", titel: "Projektverwaltung", ico: "projekt", seite: seiteProjektdaten, unter: p => adresse(p) || "Adresse, Kunde", fertig: p => p.objekt.strasse && p.objekt.plz && p.objekt.ort },
    { key: "allgemein", titel: "Allgemeine Daten", ico: "allgemein", seite: seiteAllgemein, unter: p => [p.allg.baujahr && "Bj. " + p.allg.baujahr, p.allg.wfl && p.allg.wfl + " m² Wfl.", p.allg.we && p.allg.we + " WE"].filter(Boolean).join(" · ") || "Baujahr, Wohnfläche, Wohnungen", fertig: p => zahl(p.allg.baujahr) && zahl(p.allg.wfl) },
    { key: "geometrie", titel: "Zonen & Volumen", ico: "geometrie", seite: seiteGeometrie, unter: p => { const k = G.kennwerte(p); return k.ve ? `Ve ${de(k.ve, 1)} m³ · AN ${de(k.an, 1)} m²` : "Länge, Breite, Höhe"; }, fertig: p => G.kennwerte(p).ve > 0 },
    { key: "konstruktionen", titel: "Konstruktionen", ico: "konstr", seite: seiteKonstruktionen, unter: p => (p.konstruktionen.length || "keine") + " Schichtaufbauten", fertig: p => p.konstruktionen.length },
    { key: "fenster", titel: "Fenster & Türen", ico: "fenster", seite: seiteFenstertypen, unter: p => (p.fenstertypen.length || "keine") + " Fenstertypen", fertig: p => p.fenstertypen.length },
    { key: "bauteile", titel: "Bauteile", ico: "bauteil", seite: seiteBauteile, unter: p => { const k = G.kennwerte(p); return p.bauteile.length ? `${p.bauteile.length} Bauteile · Hülle ${de(k.huelle, 1)} m²` : "Wände, Dach, Boden mit Öffnungen"; }, fertig: p => p.bauteile.length && !pruefen(p).fehler.some(f => /Konstruktion fehlt|Fenstertyp fehlt|Öffnungen größer|Bodenbauteil/.test(f)) },
    { key: "heizung", titel: "Beheizung & Warmwasser", ico: "heizung", seite: seiteHeizung, unter: p => (V.heizung[p.heizung.preset] || {}).name || "Wärmeerzeuger wählen", fertig: p => p.heizung.preset },
    { key: "lueftung", titel: "Belüftung", ico: "lueftung", seite: seiteLueftung, unter: () => "Fensterlüftung", fertig: () => true },
    { key: "ausweis", titel: "Energieausweis", ico: "ausweis", seite: seiteAusweis, unter: p => (ANLASS.find(a => a[0] === p.ea.anlass) || [, ""])[1] + " · " + p.ea.modernisierungen.length + " Empfehlungen", fertig: p => p.ea.anlass },
    { key: "foto", titel: "Gebäudefoto", ico: "foto", seite: seiteFoto, unter: p => p.foto ? "Foto vorhanden" : "für Seite 1 des Ausweises", fertig: p => p.foto },
    { key: "export", titel: "Export für EVEBI", ico: "export", seite: seiteExport, unter: p => { const f = pruefen(p).fehler.length; return f ? f + " Punkte offen" : "bereit zum Export"; }, fertig: p => !pruefen(p).fehler.length },
  ];
  function seiteProjekt(p) {
    kopf(projektName(p), adresse(p), "#/");
    const kw = G.kennwerte(p);
    app.innerHTML = `
      <section class="panel"><h2>Kennwerte</h2><div class="kennkarte">
        <div><b>${de(kw.ve, 1)}</b><span>Ve in m³</span></div>
        <div><b>${de(kw.an, 1)}</b><span>Gebäudenutzfläche AN in m²</span></div>
        <div><b>${de(kw.huelle, 1)}</b><span>Hüllfläche A in m²</span></div>
        <div><b>${kw.aVe ? de(kw.aVe, 2) : "–"}</b><span>A/Ve in 1/m</span></div>
      </div></section>
      <section class="panel"><h2>Gebäudedaten</h2><ul class="baum">${ABSCHNITTE.map(s => `
        <li><a href="#/p/${p.id}/${s.key}"><span class="ico">${ICON[s.ico]}</span>
          <span><span class="titel">${esc(s.titel)}</span><span class="unter">${esc(s.unter(p))}</span></span>
          ${s.key === "lueftung" ? "<span></span>" : `<span class="chip ${s.fertig(p) ? "ok" : "offen"}">${s.fertig(p) ? "ok" : "offen"}</span>`}
          <span class="pfeil">›</span></a></li>`).join("")}</ul></section>
      <div id="loeschen-bereich" class="reihe">
        <button class="knopf" data-aktion="projekt-kopieren">${ICON.kopie} Projekt kopieren</button>
        <button class="knopf gefahr" data-aktion="projekt-loeschen-frage">${ICON.weg} Projekt löschen</button>
      </div>`;
  }

  // ------------------------------------------------------------ Abschnitte
  function seiteProjektdaten(p) {
    kopf("Projektverwaltung", projektName(p), "#/p/" + p.id);
    app.innerHTML = `
      ${panel("Projekt", feld(p, "Bezeichnung (optional)", "projekt.bezeichnung", { breit: true, platz: "z. B. Doppelhaushälfte Müller" }))}
      ${panel("Objektadresse", `${feld(p, "Straße", "objekt.strasse")}${feld(p, "Hausnummer", "objekt.hausnr")}
        ${feld(p, "PLZ", "objekt.plz", { zahl: true })}${feld(p, "Ort", "objekt.ort")}
        ${auswahl(p, "Bundesland", "objekt.bundesland", BUNDESLAENDER)}`)}
      ${panel("Kunde / Auftraggeber", `
        <div class="reihe ende"><button class="knopf klein" data-aktion="kunde-wie-objekt">Adresse wie Objekt</button></div>
        ${auswahl(p, "Anrede", "kunde.anrede", [["Herr", "Herr"], ["Frau", "Frau"], ["Firma", "Firma"]], { leer: "–" })}
        ${feld(p, "Vorname", "kunde.vorname")}${feld(p, "Nachname / Firma", "kunde.nachname")}
        ${feld(p, "Straße", "kunde.strasse")}${feld(p, "Hausnummer", "kunde.hausnr")}
        ${feld(p, "PLZ", "kunde.plz", { zahl: true })}${feld(p, "Ort", "kunde.ort")}
        ${feld(p, "Telefon", "kunde.telefon", { typ: "tel" })}${feld(p, "E-Mail", "kunde.email", { typ: "email" })}`)}`;
  }
  function seiteAllgemein(p) {
    kopf("Allgemeine Daten", projektName(p), "#/p/" + p.id);
    app.innerHTML = `
      ${panel("Gebäude", `${feld(p, "Baujahr", "allg.baujahr", { zahl: true })}
        ${auswahl(p, "Gebäudeart", "allg.gebaeudeArt", GEBAEUDEART, { breit: true })}
        ${feld(p, "Wohneinheiten", "allg.we", { zahl: true })}${feld(p, "davon selbstgenutzt", "allg.weSelbst", { zahl: true })}
        ${feld(p, "beheizte Fläche (Wohnfläche)", "allg.wfl", { zahl: true, einheit: "m²" })}
        ${feld(p, "Geschosse", "allg.geschosse", { zahl: true })}${feld(p, "Vollgeschosse", "allg.vollgeschosse", { zahl: true })}
        ${feld(p, "Personen", "allg.personen", { zahl: true, platz: "auto" })}`)}
      ${panel("Keller & Dach", `${auswahl(p, "Keller", "allg.keller", KELLER, { breit: true })}${auswahl(p, "Dach", "allg.dach", DACH, { breit: true })}`)}
      ${panel("Wärmebrücken", `${auswahl(p, "Wärmebrückenzuschlag ΔUWB", "allg.wbz", WBZ, { breit: true })}
        <p class="hinweis">Für Bestandsgebäude ohne Nachweis ist 0,10 W/(m²K) üblich.</p>`)}`;
  }
  function seiteGeometrie(p) {
    kopf("Zonen & Volumen", projektName(p), "#/p/" + p.id);
    app.innerHTML = `
      ${panel("Außenmaße der beheizten Hülle", `
        <p class="hinweis">Außenmaße des beheizten Gebäudes. Bei Doppel- und Reihenhäusern bis zur Mitte der Trennwand messen. Höhe von Unterkante Bodenplatte bzw. Kellerdecke bis Oberkante oberste Geschossdecke bzw. Dach.</p>
        ${feld(p, "charakteristische Länge", "geo.laenge", { zahl: true, einheit: "m" })}
        ${feld(p, "charakteristische Breite", "geo.breite", { zahl: true, einheit: "m" })}
        ${feld(p, "Höhe beheizte Hülle", "geo.hoehe", { zahl: true, einheit: "m" })}
        ${anzeige("Grundfläche", "grund", "m²")}
        ${feld(p, "oder Ve direkt (z. B. mit Dachvolumen)", "geo.veManuell", { zahl: true, einheit: "m³", platz: "leer = L × B × H" })}`)}
      ${panel("Zone Wohnen", `${feld(p, "lichte Raumhöhe", "geo.raumhoehe", { zahl: true, einheit: "m" })}
        ${feld(p, "mittlere Geschosshöhe", "geo.geschosshoehe", { zahl: true, einheit: "m" })}
        ${anzeige("Gebäudevolumen Ve", "ve", "m³")}${anzeige("Gebäudenutzfläche AN", "an", "m²")}
        <p class="hinweis">AN = 0,32 · Ve (Geschosshöhe 2,50–3,00 m). EVEBI rechnet AN selbst nach.</p>`)}`;
  }

  // ---------- Konstruktionen
  function seiteKonstruktionen(p) {
    kopf("Konstruktionen", projektName(p), "#/p/" + p.id);
    app.innerHTML = `
      ${panel("Schichtaufbauten", p.konstruktionen.length ? `<div class="liste">${p.konstruktionen.map(k => `
        <a class="zeile" href="#/p/${p.id}/konstruktion/${k.id}"><span><span class="titel">${esc(k.name || "ohne Name")}</span>
        <span class="unter">${esc((KONSTR_TYP.find(t => t[0] === k.typ) || [, ""])[1])} · ${k.schichten.length} Schichten · ${p.bauteile.filter(b => b.konstrId === k.id).length}× verwendet</span></span>
        <span class="wert">U <span data-live="u:${k.id}">–</span></span></a>`).join("")}</div>` : `<p class="hinweis">Noch keine Konstruktion. Starte mit einer Vorlage und passe die Schichten an.</p>`)}
      ${panel("Neu", `<div class="reihe">${KONSTR_TYP.map(([t, n]) => `<button class="knopf" data-aktion="konstr-neu" data-typ="${t}">${ICON.plus} ${esc(n)}</button>`).join("")}</div>
        <p class="hinweis">Vorlagen (typische Aufbauten, danach anpassbar):</p>
        <div class="vorlagen">${KONSTR_VORLAGEN.map((v, i) => `<button data-aktion="konstr-vorlage" data-i="${i}">${esc(v.name)}</button>`).join("")}</div>`)}`;
    aktualisiereLive(p);
  }
  function baustoffOptionen(name) {
    return `<option value="">Baustoff wählen …</option>` + BAUSTOFFE.map(([gr, l]) => `<optgroup label="${esc(gr)}">${l.map(([n, la]) =>
      `<option value="${esc(n)}"${n === name ? " selected" : ""}>${esc(n)} (λ ${String(la).replace(".", ",")})</option>`).join("")}</optgroup>`).join("") +
      `<option value="${LUFT}"${name === LUFT ? " selected" : ""}>${LUFT}</option><option value="__eigen">Eigener Baustoff …</option>`;
  }
  function seiteKonstruktion(p, kid) {
    const i = p.konstruktionen.findIndex(k => k.id === kid);
    if (i < 0) { location.hash = `#/p/${p.id}/konstruktionen`; return; }
    const k = p.konstruktionen[i];
    const pf = `konstruktionen.${i}`;
    kopf(k.name || "Konstruktion", "Schichtaufbau", `#/p/${p.id}/konstruktionen`);
    app.innerHTML = `
      ${panel("Konstruktion", `${feld(p, "Name", pf + ".name", { breit: true })}
        ${auswahl(p, "Bauteiltyp", pf + ".typ", KONSTR_TYP, { breit: true })}`)}
      ${panel("Schichten von innen nach außen", `<div class="schichten">${k.schichten.map((s, j) => {
        const sp = `${pf}.schichten.${j}`;
        const bekannt = BAUSTOFF[s.name] || s.luft;
        return `<div class="schicht">
          <div class="name"><span class="nr">${j + 1}</span>
            ${bekannt || !s.eigen ? `<select data-baustoff="${sp}" aria-label="Baustoff">${baustoffOptionen(s.luft ? LUFT : s.name)}</select>`
              : `<input type="text" data-pfad="${sp}.name" value="${esc(s.name)}" aria-label="Baustoffname">`}</div>
          <label><span class="mini">Dicke cm</span><input type="text" class="zahl" inputmode="decimal" data-pfad="${sp}.dicke" value="${esc(s.dicke || "")}"></label>
          ${s.luft ? `<span class="mini">λ automatisch (ruhende Luft)</span>` : `<label><span class="mini">λ W/(mK)</span><input type="text" class="zahl" inputmode="decimal" data-pfad="${sp}.lambda" value="${esc(s.lambda || "")}"></label>`}
          <span style="display:grid;gap:4px">${j ? `<button class="knopf-icon" style="width:30px;height:30px" data-aktion="schicht-hoch" data-j="${j}" aria-label="nach oben">${ICON.hoch}</button>` : ""}
            <button class="knopf-icon" style="width:30px;height:30px" data-aktion="schicht-weg" data-j="${j}" aria-label="Schicht löschen">${ICON.weg}</button></span>
        </div>`;
      }).join("")}</div>
      <div class="reihe"><button class="knopf" data-aktion="schicht-neu">${ICON.plus} Schicht</button></div>
      <div class="uwert"><span>U-Wert (Schichtverfahren)</span><b><span data-live="u:${k.id}">–</span> W/(m²K)</b></div>
      ${feld(p, "U-Wert fest eingeben (optional)", pf + ".uManuell", { zahl: true, einheit: "W/m²K", platz: "leer = aus Schichten" })}
      <p class="hinweis">Holzanteile (Sparren, Balken) gehen hier nicht ein. In EVEBI kannst du dafür einen zweiten Bereich anlegen oder den U-Wert fest eingeben.</p>`)}
      <div class="reihe"><button class="knopf" data-aktion="konstr-kopieren">${ICON.kopie} Kopieren</button>
        <button class="knopf gefahr" data-aktion="konstr-weg">${ICON.weg} Löschen</button></div>`;
    aktualisiereLive(p);
  }

  // ---------- Fenstertypen
  function seiteFenstertypen(p) {
    kopf("Fenster & Türen", projektName(p), "#/p/" + p.id);
    app.innerHTML = `
      ${panel("Fenster- und Türtypen", p.fenstertypen.length ? `<div class="liste">${p.fenstertypen.map(f => `
        <a class="zeile" href="#/p/${p.id}/fenstertyp/${f.id}"><span><span class="titel">${esc(f.name || "ohne Name")}</span>
        <span class="unter">${esc((FENSTERART.find(a => a[0] === f.art) || [, ""])[1])}${f.baujahr ? " · Bj. " + esc(f.baujahr) : ""}</span></span>
        <span class="wert">Uw ${esc(f.uw || "–")}</span></a>`).join("")}</div>` : `<p class="hinweis">Lege die Fenster- und Türtypen an. In den Bauteilen trägst du dann nur noch die Maße ein.</p>`)}
      ${panel("Neu", `<div class="reihe"><button class="knopf" data-aktion="fenster-neu">${ICON.plus} Eigener Typ</button></div>
        <p class="hinweis">Vorlagen mit typischen Werten:</p>
        <div class="vorlagen">${FENSTER_VORLAGEN.map((v, i) => `<button data-aktion="fenster-vorlage" data-i="${i}">${esc(v.name)} · ${esc(v.uw)}</button>`).join("")}</div>`)}`;
  }
  function seiteFenstertyp(p, fid) {
    const i = p.fenstertypen.findIndex(f => f.id === fid);
    if (i < 0) { location.hash = `#/p/${p.id}/fenster`; return; }
    const pf = `fenstertypen.${i}`;
    kopf(p.fenstertypen[i].name || "Fenstertyp", "Fenster & Türen", `#/p/${p.id}/fenster`);
    app.innerHTML = `${panel("Fenstertyp", `${feld(p, "Name", pf + ".name", { breit: true })}
        ${auswahl(p, "Art", pf + ".art", FENSTERART, { breit: true })}${auswahl(p, "Rahmen", pf + ".rahmen", RAHMEN)}
        ${feld(p, "Uw-Wert", pf + ".uw", { zahl: true, einheit: "W/m²K" })}${feld(p, "g-Wert", pf + ".g", { zahl: true })}
        ${feld(p, "Baujahr / Einbau", pf + ".baujahr", { zahl: true })}
        <p class="hinweis">Uw und g aus Rechnung oder Datenblatt übernehmen, sonst Richtwerte der Vorlage.</p>`)}
      <div class="reihe"><button class="knopf gefahr" data-aktion="fenster-weg">${ICON.weg} Löschen</button></div>`;
  }

  // ---------- Bauteile
  function seiteBauteile(p) {
    kopf("Bauteile", projektName(p), "#/p/" + p.id);
    const kw = G.kennwerte(p);
    app.innerHTML = `
      ${panel("Thermische Hülle", p.bauteile.length ? `<div class="liste">${p.bauteile.map(b => {
        const k = kw.bauteile.find(x => x.id === b.id) || {};
        const kon = p.konstruktionen.find(x => x.id === b.konstrId);
        const ori = ART[b.art] && ART[b.art].btl !== "KELLER" && b.art !== "ogd" && b.art !== "flach" && b.orient != null && b.orient !== "" ? " · " + ORIENT_NAME[b.orient] : "";
        return `<a class="zeile" href="#/p/${p.id}/bauteil/${b.id}"><span><span class="titel">${esc(b.name || ART[b.art].label)}</span>
          <span class="unter">${esc(ART[b.art].label)}${ori} · ${kon ? esc(kon.name) : "<b>Konstruktion fehlt</b>"}${(b.oeffnungen || []).length ? " · " + b.oeffnungen.length + " Öffnungen" : ""}</span></span>
          <span class="wert">${de(k.netto, 2)} m²${k.u ? `<br>U ${de(k.u, 2)}` : ""}</span></a>`;
      }).join("")}</div>` : `<p class="hinweis">Noch keine Bauteile. Lege Außenwände, Dach oder oberste Geschossdecke und Boden an.</p>`)}
      ${panel("Bauteil hinzufügen", `<div class="vorlagen">${Object.entries(ART).map(([k, a]) => `<button data-aktion="bauteil-neu" data-art="${k}">${esc(a.label)}</button>`).join("")}</div>`)}`;
  }
  function seiteBauteil(p, bid) {
    const i = p.bauteile.findIndex(b => b.id === bid);
    if (i < 0) { location.hash = `#/p/${p.id}/bauteile`; return; }
    const b = p.bauteile[i];
    const pf = `bauteile.${i}`;
    const a = ART[b.art] || ART.aw;
    const istWand = a.btl === "WAND";
    const geneigt = b.art === "dach";
    const mitRichtung = istWand || geneigt;
    const passende = p.konstruktionen.filter(k => k.typ === a.konstr);
    kopf(b.name || a.label, a.label, `#/p/${p.id}/bauteile`);
    app.innerHTML = `
      ${panel("Bauteil", `${feld(p, "Bezeichnung", pf + ".name", { breit: true })}
        ${auswahl(p, "Art / Übergang", pf + ".art", Object.entries(ART).map(([k, x]) => [k, x.label]), { breit: true })}
        <div class="feld breit"><label for="konstr-wahl">Konstruktion</label>
          <select id="konstr-wahl" data-pfad="${pf}.konstrId"><option value="">– wählen –</option>${passende.map(k => `<option value="${k.id}"${k.id === b.konstrId ? " selected" : ""}>${esc(k.name)}</option>`).join("")}</select></div>
        <div class="reihe"><button class="knopf klein" data-aktion="konstr-neu-fuer" data-typ="${a.konstr}">${ICON.plus} neue Konstruktion</button>
          ${b.konstrId ? `<a class="knopf klein" href="#/p/${p.id}/konstruktion/${b.konstrId}">Konstruktion bearbeiten</a>` : ""}</div>
        ${feld(p, "Baujahr", pf + ".baujahr", { zahl: true })}`)}
      ${mitRichtung ? panel("Ausrichtung", `<div class="kompass" role="group" aria-label="Himmelsrichtung">${ORIENT.map(([n, g]) =>
        `<button data-aktion="orient" data-g="${g}" aria-pressed="${String(b.orient) === String(g)}">${n}</button>`).join("")}</div>
        ${geneigt ? feld(p, "Dachneigung", pf + ".neigung", { zahl: true, einheit: "°" }) : ""}`) : ""}
      ${panel("Fläche", `${feld(p, istWand ? "Länge" : (geneigt ? "Traufenlänge" : "Länge"), pf + ".laenge", { zahl: true, einheit: "m" })}
        ${feld(p, istWand ? "Höhe" : (geneigt ? "Sparrenlänge" : "Breite"), pf + ".hoehe", { zahl: true, einheit: "m" })}
        ${feld(p, "oder Fläche direkt", pf + ".flaeche", { zahl: true, einheit: "m²", platz: "überschreibt L × H" })}
        ${anzeige("Bruttofläche", `bt:${b.id}:brutto`, "m²")}${anzeige("Öffnungen", `bt:${b.id}:oeff`, "m²")}
        ${anzeige("Nettofläche", `bt:${b.id}:netto`, "m²")}${anzeige("U-Wert", `bt:${b.id}:u`, "W/m²K")}`)}
      ${panel("Fenster & Türen in diesem Bauteil", `${(b.oeffnungen || []).map((o, j) => {
        const op = `${pf}.oeffnungen.${j}`;
        return `<div class="oeffnung">
          <div class="voll"><label>Fenstertyp</label><select data-pfad="${op}.fensterId">${p.fenstertypen.map(f => `<option value="${f.id}"${f.id === o.fensterId ? " selected" : ""}>${esc(f.name)}</option>`).join("")}<option value=""${o.fensterId ? "" : " selected"}>– kein Typ –</option></select></div>
          <div class="voll"><label>Bezeichnung</label><input type="text" data-pfad="${op}.name" value="${esc(o.name || "")}" placeholder="z. B. Wohnzimmer EG"></div>
          <div><label>Breite m</label><input type="text" class="zahl" inputmode="decimal" data-pfad="${op}.breite" value="${esc(o.breite || "")}"></div>
          <div><label>Höhe m</label><input type="text" class="zahl" inputmode="decimal" data-pfad="${op}.hoehe" value="${esc(o.hoehe || "")}"></div>
          <div><label>Anzahl</label><input type="text" class="zahl" inputmode="numeric" data-pfad="${op}.anzahl" value="${esc(o.anzahl || "1")}"></div>
          <button class="knopf-icon" style="width:30px;height:30px" data-aktion="oeffnung-weg" data-j="${j}" aria-label="Öffnung löschen">${ICON.weg}</button>
        </div>`;
      }).join("") || '<p class="hinweis">Keine Öffnungen.</p>'}
        <div class="reihe"><button class="knopf" data-aktion="oeffnung-neu">${ICON.plus} Fenster / Tür</button>
        ${p.fenstertypen.length ? "" : `<a class="knopf klein" href="#/p/${p.id}/fenster">Erst Fenstertyp anlegen</a>`}</div>`)}
      <div class="reihe"><button class="knopf" data-aktion="bauteil-kopieren">${ICON.kopie} Kopieren</button>
        <button class="knopf gefahr" data-aktion="bauteil-weg">${ICON.weg} Löschen</button></div>`;
    aktualisiereLive(p);
  }

  // ---------- Heizung
  function seiteHeizung(p) {
    kopf("Beheizung & Warmwasser", projektName(p), "#/p/" + p.id);
    const h = p.heizung;
    app.innerHTML = `
      ${panel("Wärmeerzeuger", `<div class="auswahl">${Object.entries(V.heizung).map(([k, v]) => `
        <label><input type="radio" name="preset" value="${k}" data-pfad="heizung.preset"${h.preset === k ? " checked" : ""}>
        <span><b>${esc(v.name)}</b><small>${esc(v.hinweis)}</small></span></label>`).join("")}</div>
        <p class="hinweis">Andere Erzeuger (Öl, Pellet, Fernwärme …) wählst du hier am ähnlichsten und stellst sie in EVEBI um.</p>`)}
      ${panel("Kenndaten", `${feld(p, "Baujahr Wärmeerzeuger", "heizung.baujahr", { zahl: true })}
        ${feld(p, "Nennleistung (optional)", "heizung.leistung", { zahl: true, einheit: "kW", platz: "aus Vorlage" })}
        ${h.preset === "gas_bw_etage" ? feld(p, "Anzahl Geräte (Thermen)", "heizung.anzahl", { zahl: true }) : ""}
        ${feld(p, "Baujahr Warmwasserbereiter", "heizung.bjTww", { zahl: true, platz: "wie Erzeuger" })}`)}
      ${panel("Wärmeübergabe", `<div class="auswahl">
        <label><input type="radio" name="ueb" value="HZK_HEIZKOERPER" data-pfad="heizung.uebergabe"${h.uebergabe !== "HZK_FLAECHENHZ" ? " checked" : ""}><span><b>Heizkörper</b></span></label>
        <label><input type="radio" name="ueb" value="HZK_FLAECHENHZ" data-pfad="heizung.uebergabe"${h.uebergabe === "HZK_FLAECHENHZ" ? " checked" : ""}><span><b>Fußbodenheizung</b><small>Nasssystem</small></span></label></div>
        ${auswahl(p, "Systemtemperatur", "heizung.hkTemp", HKTEMP)}
        ${auswahl(p, "Hydraulischer Abgleich", "heizung.hydr", HYDR, { breit: true })}
        ${feld(p, "Baujahr Heizkörper / Regelung", "heizung.bjUebergabe", { zahl: true, platz: "wie Gebäude" })}`)}`;
  }
  function seiteLueftung(p) {
    kopf("Belüftung", projektName(p), "#/p/" + p.id);
    app.innerHTML = panel("Lüftung", `<div class="feld"><span class="lbl">Art der Lüftung</span><input type="text" readonly value="Fensterlüftung"><span></span>${badge("a")}</div>
      <p class="hinweis">Die App überträgt Fensterlüftung. Eine Abluftanlage oder Lüftung mit Wärmerückgewinnung stellst du in EVEBI unter „Belüftung“ ein.</p>`);
  }

  // ---------- Ausweis
  function seiteAusweis(p) {
    kopf("Energieausweis", projektName(p), "#/p/" + p.id);
    app.innerHTML = `
      ${panel("Angaben", `${auswahl(p, "Anlass", "ea.anlass", ANLASS, { breit: true })}
        <div class="feld"><label for="ea-datum">Ausstellungsdatum</label><input id="ea-datum" type="date" data-pfad="ea.datum" value="${esc(p.ea.datum || "")}"><span></span>${badge("s")}</div>
        <label class="reihe" style="gap:8px"><input type="checkbox" data-pfad="ea.datenEigentuemer"${p.ea.datenEigentuemer ? " checked" : ""}> Datenerhebung auch durch Eigentümer</label>`)}
      ${panel("Modernisierungsempfehlungen", `${p.ea.modernisierungen.map((m, j) => `
        <div class="oeffnung" style="grid-template-columns:minmax(0,1fr) 30px">
          <div><label>Bauteil / Anlagenteil</label><input type="text" list="anlagenteile" data-pfad="ea.modernisierungen.${j}.anlagenteil" value="${esc(m.anlagenteil || "")}"></div>
          <button class="knopf-icon" style="width:30px;height:30px" data-aktion="mod-weg" data-j="${j}" aria-label="Empfehlung löschen">${ICON.weg}</button>
          <div class="voll"><label>Maßnahme</label><textarea data-pfad="ea.modernisierungen.${j}.text">${esc(m.text || "")}</textarea></div>
          <label class="voll reihe" style="gap:8px;font-size:13px;color:var(--text)"><input type="checkbox" data-pfad="ea.modernisierungen.${j}.paket"${m.paket ? " checked" : ""}> als Teil eines Maßnahmenpakets</label>
        </div>`).join("") || '<p class="hinweis">Noch keine Empfehlung.</p>'}
        <datalist id="anlagenteile">${ANLAGENTEILE.map(a => `<option value="${esc(a)}">`).join("")}</datalist>
        <div class="reihe"><button class="knopf" data-aktion="mod-neu">${ICON.plus} Empfehlung</button></div>
        <p class="hinweis">Vorschläge:</p>
        <div class="vorlagen">${MOD_VORSCHLAEGE.map((m, i) => `<button data-aktion="mod-vorschlag" data-i="${i}">${esc(m[1])}</button>`).join("")}</div>`)}`;
  }

  // ---------- Foto
  function seiteFoto(p) {
    kopf("Gebäudefoto", projektName(p), "#/p/" + p.id);
    app.innerHTML = panel("Foto für Seite 1 des Ausweises", `
      ${p.foto ? `<img class="foto" src="${p.foto}" alt="Gebäudefoto">` : '<p class="hinweis">Noch kein Foto. Am besten die Straßenseite, ganzes Gebäude im Bild.</p>'}
      <div class="reihe"><label class="knopf haupt" for="foto-input">${ICON.foto} ${p.foto ? "Neues Foto" : "Foto aufnehmen / wählen"}</label>
        <input id="foto-input" type="file" accept="image/*" capture="environment" hidden>
        ${p.foto ? `<button class="knopf gefahr" data-aktion="foto-weg">${ICON.weg} Entfernen</button>` : ""}</div>
      <p class="hinweis">Das Foto wird verkleinert (max. 1600 px) und mit in die EVEBI-Datei gepackt.</p>`);
  }

  // ---------- Export
  let letzteDatei = null;
  function seiteExport(p) {
    kopf("Export für EVEBI", projektName(p), "#/p/" + p.id);
    const pr = pruefen(p);
    const kw = G.kennwerte(p);
    app.innerHTML = `
      ${panel("Prüfung", `<ul class="pruef">${pr.fehler.map(f => `<li><span class="p-warn">!</span><span>${esc(f)}</span></li>`).join("")}
        ${pr.ok.map(f => `<li><span class="p-ok">✓</span><span>${esc(f)}</span></li>`).join("")}</ul>
        ${pr.fehler.length ? '<p class="hinweis warn">Du kannst trotzdem exportieren und die offenen Punkte in EVEBI ergänzen.</p>' : ""}`)}
      <section class="panel"><h2>Kennwerte</h2><div class="kennkarte">
        <div><b>${de(kw.ve, 1)}</b><span>Ve in m³</span></div><div><b>${de(kw.an, 1)}</b><span>AN in m²</span></div>
        <div><b>${de(kw.huelle, 1)}</b><span>Hüllfläche in m²</span></div><div><b>${p.bauteile.length}</b><span>Bauteile</span></div></div></section>
      ${panel("EVEBI-Datei", `
        <div class="reihe"><button class="knopf haupt" data-aktion="export">${ICON.export} EVEBI-Datei (.evex) erzeugen</button>
        <button class="knopf" data-aktion="teilen" id="teilen" hidden>Teilen …</button></div>
        <div id="export-info"></div>
        <p class="hinweis">Auf dem iPhone landet die Datei in „Dateien“, unter Android im Ordner „Downloads“. Von dort per OneDrive, Mail oder WhatsApp an den PC schicken und mit EVEBI öffnen. In EVEBI dann rechnen, Hinweise prüfen und den Ausweis ausstellen.</p>`)}
      ${panel("Sicherung", `<p class="hinweis">Speichert alle Eingaben dieses Projekts als .json, zum Weiterbearbeiten auf einem anderen Gerät („Sicherung öffnen“ auf der Startseite).</p>
        <div class="reihe"><button class="knopf" data-aktion="sicherung">Sicherung speichern</button></div>`)}`;
  }
  async function exportieren(p) {
    const info = document.getElementById("export-info");
    info.innerHTML = '<p class="hinweis">Datei wird erzeugt …</p>';
    try {
      const r = await G.erzeugeEvex(p, aussteller);
      letzteDatei = r;
      herunterladen(r.bytes, r.dateiname, "application/octet-stream");
      info.innerHTML = `<p class="hinweis"><b>${esc(r.dateiname)}</b> erzeugt (${de(r.bytes.length / 1024, 0)} KB).</p>` +
        (r.warnungen.length ? `<ul class="pruef">${r.warnungen.map(w => `<li><span class="p-warn">!</span><span>${esc(w)}</span></li>`).join("")}</ul>` : "");
      const t = document.getElementById("teilen");
      if (t && dateiTeilbar(r)) t.hidden = false;
      toast("EVEBI-Datei erzeugt");
    } catch (e) {
      info.innerHTML = `<p class="hinweis warn">Export fehlgeschlagen: ${esc(e.message || e)}</p>`;
    }
  }
  function dateiTeilbar(r) {
    try {
      const f = new File([r.bytes], r.dateiname, { type: "application/octet-stream" });
      return !!(navigator.canShare && navigator.canShare({ files: [f] }));
    } catch (e) { return false; }
  }
  function herunterladen(bytes, name, typ) {
    const url = URL.createObjectURL(new Blob([bytes], { type: typ }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  // ------------------------------------------------------------ Foto verkleinern
  function fotoLaden(datei) {
    return new Promise((ok, fehler) => {
      const url = URL.createObjectURL(datei);
      const img = new Image();
      img.onload = () => {
        const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error("Bild konnte nicht gelesen werden")); };
      img.src = url;
    });
  }

  // ------------------------------------------------------------ Toast
  let toastTimer;
  function toast(text) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3200);
  }

  // ------------------------------------------------------------ Eingaben
  app.addEventListener("input", e => {
    const el = e.target;
    if (!el.dataset.pfad) return;
    const wert = el.type === "checkbox" ? el.checked : el.value;
    if (route()[0] === "einstellungen") { setzen({ aussteller }, el.dataset.pfad, wert); speichern(); return; }
    if (!aktuell) return;
    setzen(aktuell, el.dataset.pfad, wert);
    geaendert(aktuell);
    aktualisiereLive(aktuell);
  });
  app.addEventListener("change", async e => {
    const el = e.target;
    const p = aktuell;
    if (el.id === "import") return importieren(el.files[0]);
    if (el.id === "foto-input" && p && el.files[0]) {
      try { p.foto = await fotoLaden(el.files[0]); geaendert(p); speichern(true); render(); toast("Foto übernommen"); }
      catch (err) { toast(err.message); }
      return;
    }
    if (el.dataset.baustoff && p) {
      const sp = el.dataset.baustoff;
      const s = holen(p, sp);
      if (el.value === LUFT) Object.assign(s, { name: "Luftschicht (ruhend)", luft: true, eigen: false, lambda: "", rho: "" });
      else if (el.value === "__eigen") Object.assign(s, { name: "", luft: false, eigen: true });
      else if (BAUSTOFF[el.value]) Object.assign(s, { name: el.value, luft: false, eigen: false, lambda: String(BAUSTOFF[el.value].lambda).replace(".", ","), rho: String(BAUSTOFF[el.value].rho) });
      geaendert(p); render(); return;
    }
    if (!el.dataset.pfad || !p) return;
    // Strukturelle Änderungen neu zeichnen
    if (/(\.art|\.typ|heizung\.preset|heizung\.uebergabe)$/.test(el.dataset.pfad)) {
      if (el.dataset.pfad === "heizung.uebergabe") p.heizung.hkTemp = el.value === "HZK_FLAECHENHZ" ? "HKTEMP_35_28" : "HKTEMP_55_45";
      if (/^bauteile\.\d+\.art$/.test(el.dataset.pfad)) {
        const b = holen(p, el.dataset.pfad.replace(/\.art$/, ""));
        const k = p.konstruktionen.find(x => x.id === b.konstrId);
        if (k && k.typ !== ART[b.art].konstr) b.konstrId = "";
      }
      geaendert(p); render();
    }
  });

  // ------------------------------------------------------------ Aktionen
  async function importieren(datei) {
    if (!datei) return;
    try {
      const d = JSON.parse(await datei.text());
      const liste = Array.isArray(d) ? d : (d.projekt && d.bauteile ? [d] : d.projekte || []);
      if (!liste.length) throw new Error("keine Projekte gefunden");
      for (const p of liste) {
        if (!p.id || projekte.some(x => x.id === p.id)) p.id = neueId();
        projekte.push(p);
      }
      speichern(true); render(); toast(liste.length + " Projekt(e) geöffnet");
    } catch (e) { toast("Sicherung konnte nicht gelesen werden: " + e.message); }
  }
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-aktion]");
    if (!btn) return;
    const a = btn.dataset.aktion;
    const p = aktuell;
    const r = route();
    switch (a) {
      case "neu": { const n = neuesProjekt(); projekte.push(n); speichern(true); location.hash = `#/p/${n.id}/projekt`; break; }
      case "beispiel": { const n = beispielProjekt(); projekte.push(n); speichern(true); location.hash = `#/p/${n.id}`; break; }
      case "projekt-kopieren": { const n = kopie(p); n.id = neueId(); n.projekt.bezeichnung = (projektName(p) + " (Kopie)"); n.geaendert = new Date().toISOString(); projekte.push(n); speichern(true); location.hash = `#/p/${n.id}`; break; }
      case "projekt-loeschen-frage": {
        document.getElementById("loeschen-bereich").outerHTML = `<div class="bestaetigen" id="loeschen-bereich"><span style="flex:1;min-width:12em">„${esc(projektName(p))}“ mit allen Eingaben von diesem Gerät löschen?</span>
          <button class="knopf gefahr" data-aktion="projekt-loeschen">Löschen</button><button class="knopf" data-aktion="abbrechen">Behalten</button></div>`;
        break;
      }
      case "abbrechen": render(); break;
      case "projekt-loeschen": projekte = projekte.filter(x => x.id !== p.id); speichern(true); location.hash = "#/"; toast("Projekt gelöscht"); break;
      case "kunde-wie-objekt": Object.assign(p.kunde, { strasse: p.objekt.strasse, hausnr: p.objekt.hausnr, plz: p.objekt.plz, ort: p.objekt.ort }); geaendert(p); render(); break;
      case "konstr-neu": case "konstr-neu-fuer": {
        const k = { id: neueId(), name: KONSTR_TYP.find(t => t[0] === btn.dataset.typ)[1], typ: btn.dataset.typ, schichten: [] };
        p.konstruktionen.push(k);
        if (a === "konstr-neu-fuer") p.bauteile.find(b => b.id === r[3]).konstrId = k.id;
        geaendert(p); location.hash = `#/p/${p.id}/konstruktion/${k.id}`; break;
      }
      case "konstr-vorlage": { const k = konstrAusVorlage(KONSTR_VORLAGEN[+btn.dataset.i]); p.konstruktionen.push(k); geaendert(p); location.hash = `#/p/${p.id}/konstruktion/${k.id}`; break; }
      case "konstr-kopieren": { const k = kopie(p.konstruktionen.find(x => x.id === r[3])); k.id = neueId(); k.name += " (Kopie)"; p.konstruktionen.push(k); geaendert(p); location.hash = `#/p/${p.id}/konstruktion/${k.id}`; break; }
      case "konstr-weg": {
        const benutzt = p.bauteile.filter(b => b.konstrId === r[3]).length;
        if (benutzt && !btn.dataset.sicher) { btn.dataset.sicher = "1"; btn.textContent = `Wirklich löschen? ${benutzt} Bauteil(e) verlieren die Zuordnung`; break; }
        p.konstruktionen = p.konstruktionen.filter(x => x.id !== r[3]);
        p.bauteile.forEach(b => { if (b.konstrId === r[3]) b.konstrId = ""; });
        geaendert(p); location.hash = `#/p/${p.id}/konstruktionen`; break;
      }
      case "schicht-neu": { p.konstruktionen.find(x => x.id === r[3]).schichten.push({ name: "", dicke: "", lambda: "", rho: "" }); geaendert(p); render(); break; }
      case "schicht-weg": { p.konstruktionen.find(x => x.id === r[3]).schichten.splice(+btn.dataset.j, 1); geaendert(p); render(); break; }
      case "schicht-hoch": { const s = p.konstruktionen.find(x => x.id === r[3]).schichten, j = +btn.dataset.j; [s[j - 1], s[j]] = [s[j], s[j - 1]]; geaendert(p); render(); break; }
      case "fenster-neu": case "fenster-vorlage": {
        const v = a === "fenster-vorlage" ? FENSTER_VORLAGEN[+btn.dataset.i] : { name: "Fenster", art: "FART_STANDARD", rahmen: "RMAT_RAHMEN_KST", uw: "", g: "" };
        const f = { id: neueId(), ...v, baujahr: "" };
        p.fenstertypen.push(f); geaendert(p); location.hash = `#/p/${p.id}/fenstertyp/${f.id}`; break;
      }
      case "fenster-weg": {
        p.fenstertypen = p.fenstertypen.filter(x => x.id !== r[3]);
        p.bauteile.forEach(b => (b.oeffnungen || []).forEach(o => { if (o.fensterId === r[3]) o.fensterId = ""; }));
        geaendert(p); location.hash = `#/p/${p.id}/fenster`; break;
      }
      case "bauteil-neu": {
        const art = btn.dataset.art, x = ART[art];
        const g = p.geo || {};
        const k = p.konstruktionen.filter(k => k.typ === x.konstr);
        const b = { id: neueId(), art, name: x.label, konstrId: k.length === 1 ? k[0].id : "", baujahr: p.allg.baujahr || "", oeffnungen: [],
          laenge: x.btl === "WAND" ? "" : (g.laenge || ""), hoehe: x.btl === "WAND" ? (g.hoehe || "") : (art === "dach" ? "" : (g.breite || "")),
          orient: x.btl === "WAND" || art === "dach" ? 180 : "", neigung: art === "dach" ? "45" : "" };
        p.bauteile.push(b); geaendert(p); location.hash = `#/p/${p.id}/bauteil/${b.id}`; break;
      }
      case "bauteil-kopieren": {
        const b = kopie(p.bauteile.find(x => x.id === r[3])); b.id = neueId(); b.name += " (Kopie)";
        (b.oeffnungen || []).forEach(o => { o.id = neueId(); });
        p.bauteile.push(b); geaendert(p); location.hash = `#/p/${p.id}/bauteil/${b.id}`; break;
      }
      case "bauteil-weg": { p.bauteile = p.bauteile.filter(x => x.id !== r[3]); geaendert(p); location.hash = `#/p/${p.id}/bauteile`; break; }
      case "orient": { p.bauteile.find(x => x.id === r[3]).orient = +btn.dataset.g; geaendert(p); render(); break; }
      case "oeffnung-neu": {
        const b = p.bauteile.find(x => x.id === r[3]);
        const passend = p.fenstertypen.find(f => ART[b.art].btl === "WAND" ? f.art !== "FART_DACHFENSTER" : f.art === "FART_DACHFENSTER") || p.fenstertypen[0];
        (b.oeffnungen = b.oeffnungen || []).push({ id: neueId(), name: "", fensterId: passend ? passend.id : "", breite: "", hoehe: "", anzahl: "1" });
        geaendert(p); render();
        const felder = app.querySelectorAll(".oeffnung input[data-pfad$='.breite']");
        if (felder.length) felder[felder.length - 1].focus();
        break;
      }
      case "oeffnung-weg": { p.bauteile.find(x => x.id === r[3]).oeffnungen.splice(+btn.dataset.j, 1); geaendert(p); render(); break; }
      case "mod-neu": p.ea.modernisierungen.push({ id: neueId(), anlagenteil: "", text: "", paket: false }); geaendert(p); render(); break;
      case "mod-vorschlag": { const [t, m, pk] = MOD_VORSCHLAEGE[+btn.dataset.i]; p.ea.modernisierungen.push({ id: neueId(), anlagenteil: t, text: m, paket: pk }); geaendert(p); render(); break; }
      case "mod-weg": p.ea.modernisierungen.splice(+btn.dataset.j, 1); geaendert(p); render(); break;
      case "foto-weg": p.foto = null; geaendert(p); speichern(true); render(); break;
      case "export": speichern(true); await exportieren(p); break;
      case "teilen": {
        if (!letzteDatei) break;
        try {
          const f = new File([letzteDatei.bytes], letzteDatei.dateiname, { type: "application/octet-stream" });
          await navigator.share({ files: [f], title: letzteDatei.dateiname });
        } catch (err) { if (err && err.name !== "AbortError") toast("Teilen nicht möglich – Datei liegt bei den Downloads."); }
        break;
      }
      case "sicherung": {
        const name = (projektName(p) + " – HK Aufnahme.json").replace(/[\\/:*?"<>|]+/g, " ");
        herunterladen(new TextEncoder().encode(JSON.stringify(p, null, 1)), name, "application/json");
        toast("Sicherung gespeichert"); break;
      }
    }
  });
  zurueckEl.addEventListener("click", () => { location.hash = zurueckEl.dataset.ziel || "#/"; });
  document.getElementById("einstellungen").addEventListener("click", () => { location.hash = "#/einstellungen"; });
  window.addEventListener("hashchange", render);
  window.addEventListener("pagehide", () => speichern(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") speichern(true); });

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  if (!V || !G) { app.innerHTML = '<p class="hinweis warn">App-Dateien unvollständig geladen. Bitte neu laden.</p>'; return; }
  render();
})();

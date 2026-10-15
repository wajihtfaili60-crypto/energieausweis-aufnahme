/* HK Aufnahme – erzeugt aus den Eingaben eine EVEBI-Projektdatei (.evex).
 *
 * Eine .evex ist ein ZIP mit projekt.xml (CRLF, UTF-8), optionalen Bildern
 * blob_{GUID}.jpg und file-hashes (SHA-1 je Datei). Als Gerüst dient ein in
 * EVEBI 14.3.8 geprüftes Projekt (vorlage.js). Bauteile, Konstruktionen,
 * Fenster und Heizung werden aus geprüften Vorlage-Elementen geklont.
 * Läuft im Browser und (für Tests) in Node mit einem DOMParser-Ersatz.
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------ Fachtabellen
  const BAUTEILARTEN = {
    aw:    { label: "Außenwand",                         gruppe: "wand",  btl: "WAND",   ueb: "UEB_W_AUSSEN",      konstr: "wand",  rsi: 0.13, rse: 0.04, flaeche: "tfl", neig: 90, gegWert: 0.24 },
    wu:    { label: "Wand zu unbeheiztem Raum",          gruppe: "wand",  btl: "WAND",   ueb: "UEB_W_UNBEHEIZT",   konstr: "wand",  rsi: 0.13, rse: 0.13, flaeche: "tfl", neig: 90, gegWert: 0.30 },
    we:    { label: "Kellerwand gegen Erdreich",         gruppe: "wand",  btl: "WAND",   ueb: "UEB_W_ERDREICH",    konstr: "wand",  rsi: 0.13, rse: 0.00, flaeche: "tfl", neig: 90, gegWert: 0.30 },
    dach:  { label: "Dachfläche",                        gruppe: "dach",  btl: "DACH",   ueb: "UEB_D_AUSSEN",      konstr: "dach",  rsi: 0.10, rse: 0.04, flaeche: "man", neig: 45, gegWert: 0.24 },
    flach: { label: "Flachdach",                         gruppe: "dach",  btl: "DACH",   ueb: "UEB_D_AUSSEN",      konstr: "dach",  rsi: 0.10, rse: 0.04, flaeche: "man", neig: 0,  gegWert: 0.20 },
    ogd:   { label: "Oberste Geschossdecke",             gruppe: "dach",  btl: "DACH",   ueb: "UEB_D_NAUSG_DACH",  konstr: "dach",  rsi: 0.10, rse: 0.10, flaeche: "man", neig: 0,  gegWert: 0.24 },
    bp:    { label: "Bodenplatte",                       gruppe: "boden", btl: "KELLER", ueb: "UEB_K_BP_OHNE_RD",  konstr: "boden", rsi: 0.17, rse: 0.00, flaeche: "man", neig: 0,  gegWert: 0.30, boden: true },
    kd:    { label: "Kellerdecke",                       gruppe: "boden", btl: "KELLER", ueb: "UEB_K_KELLER_OPM",  konstr: "boden", rsi: 0.17, rse: 0.17, flaeche: "man", neig: 0,  gegWert: 0.30, boden: true },
    dbu:   { label: "Decke über Außenluft",              gruppe: "boden", btl: "KELLER", ueb: "UEB_K_AUSSEN",      konstr: "boden", rsi: 0.17, rse: 0.04, flaeche: "man", neig: 0,  gegWert: 0.24, boden: true },
  };
  const KONSTR_PROTO = { wand: "WAND", dach: "DACH", boden: "KELLER" };
  const BTL_ART = { WAND: "BTL_WAND", DACH: "BTL_DACH", KELLER: "BTL_KELLER", FENSTER: "BTL_FENSTER" };
  const RICHTUNG = { 0: "Nord", 45: "Nordost", 90: "Ost", 135: "Südost", 180: "Süd", 225: "Südwest", 270: "West", 315: "Nordwest" };
  const norm = g => ((Math.round(g) % 360) + 360) % 360;

  function zahl(x, d = 0) {
    const v = typeof x === "string" ? Number(x.replace(/\s/g, "").replace(",", ".")) : Number(x);
    return x === "" || x == null ? d : (Number.isFinite(v) ? v : d);
  }

  /** Wärmedurchlasswiderstand ruhender Luftschichten (DIN EN ISO 6946, horizontal). */
  function rLuft(dickeCm) {
    const mm = dickeCm * 10;
    const tab = [[0, 0], [5, 0.11], [7, 0.13], [10, 0.15], [15, 0.17], [25, 0.18]];
    if (mm >= 25) return 0.18;
    for (let i = 1; i < tab.length; i++) {
      if (mm <= tab[i][0]) {
        const [x0, y0] = tab[i - 1], [x1, y1] = tab[i];
        return y0 + (y1 - y0) * (mm - x0) / (x1 - x0);
      }
    }
    return 0.18;
  }

  /** U-Wert einer Konstruktion für eine Bauteilart (vereinfachtes Schichtverfahren). */
  function uWert(konstr, art) {
    if (konstr && zahl(konstr.uManuell) > 0) return zahl(konstr.uManuell);
    if (!konstr || !konstr.schichten || !konstr.schichten.length) return null;
    const a = BAUTEILARTEN[art] || BAUTEILARTEN.aw;
    let r = a.rsi + a.rse;
    for (const s of konstr.schichten) {
      const d = zahl(s.dicke);
      if (s.luft) r += rLuft(d);
      else if (zahl(s.lambda) > 0) r += (d / 100) / zahl(s.lambda);
    }
    return r > 0 ? 1 / r : null;
  }

  // ---- Bundesland aus der PLZ (Leitregion + bekannte Grenzbereiche; in der App änderbar)
  const BL_2 = { "01": "SN", "02": "SN", "03": "BB", "04": "SN", "06": "ST", "07": "TH", "08": "SN", "09": "SN", "10": "BE", "12": "BE", "13": "BE",
    "14": "BB", "15": "BB", "16": "BB", "17": "MV", "18": "MV", "19": "MV", "20": "HH", "21": "NI", "22": "HH", "23": "SH", "24": "SH", "25": "SH",
    "26": "NI", "27": "NI", "28": "HB", "29": "NI", "30": "NI", "31": "NI", "32": "NW", "33": "NW", "34": "HE", "35": "HE", "36": "HE", "37": "NI",
    "38": "NI", "39": "ST", "40": "NW", "41": "NW", "42": "NW", "44": "NW", "45": "NW", "46": "NW", "47": "NW", "48": "NW", "49": "NI", "50": "NW",
    "51": "NW", "52": "NW", "53": "NW", "54": "RP", "55": "RP", "56": "RP", "57": "NW", "58": "NW", "59": "NW", "60": "HE", "61": "HE", "63": "HE",
    "64": "HE", "65": "HE", "66": "SL", "67": "RP", "68": "BW", "69": "BW", "70": "BW", "71": "BW", "72": "BW", "73": "BW", "74": "BW", "75": "BW",
    "76": "BW", "77": "BW", "78": "BW", "79": "BW", "80": "BY", "81": "BY", "82": "BY", "83": "BY", "84": "BY", "85": "BY", "86": "BY", "87": "BY",
    "88": "BW", "89": "BW", "90": "BY", "91": "BY", "92": "BY", "93": "BY", "94": "BY", "95": "BY", "96": "BY", "97": "BY", "98": "TH", "99": "TH" };
  const BL_AUSNAHMEN = [[4600, 4639, "TH"], [4895, 4938, "BB"], [6556, 6578, "TH"], [7919, 7985, "SN"], [17258, 17337, "BB"], [19300, 19357, "BB"],
    [21029, 21149, "HH"], [21465, 21521, "SH"], [22844, 22885, "SH"], [22926, 22969, "SH"], [23919, 23999, "MV"], [27568, 27580, "HB"],
    [28790, 28879, "NI"], [34346, 34355, "NI"], [36404, 36469, "TH"], [37213, 37299, "HE"], [37308, 37359, "TH"], [38820, 38899, "ST"],
    [48455, 48531, "NI"], [49477, 49549, "NW"], [53424, 53579, "RP"], [57518, 57648, "RP"], [63739, 63939, "BY"], [65558, 65629, "RP"],
    [66482, 66509, "RP"], [66849, 66999, "RP"], [68519, 68649, "HE"], [69479, 69518, "HE"], [88099, 88179, "BY"], [89231, 89359, "BY"], [97877, 97999, "BW"]];
  function bundeslandAusPlz(plz) {
    const s = String(plz || "").replace(/\D/g, "");
    if (s.length !== 5) return null;
    const n = Number(s);
    for (const [a, b, bl] of BL_AUSNAHMEN) if (n >= a && n <= b) return "BL_" + bl;
    return BL_2[s.slice(0, 2)] ? "BL_" + BL_2[s.slice(0, 2)] : null;
  }

  /** Alle Werte, die EVEBI selbst ermittelt („A“) – hier aus den wenigen Eingaben abgeleitet. */
  function auto(p) {
    const a = p.allg || {}, g = p.geo || {};
    const L = zahl(g.laenge), B = zahl(g.breite), H = zahl(g.hoehe);
    const dachBeh = a.dach === "DK_DACH_BEH" || a.dach === "DK_DACH_TEILW_BEH";
    const kellerBeh = a.keller === "KK_KELLER_BEH";
    const alpha = zahl(g.dachneigung, 40) * Math.PI / 180;
    const hk = kellerBeh ? zahl(g.kellerhoehe, 2.5) : 0;
    const geschosse = Math.max(1, Math.round(zahl(a.geschosse, 1)));
    const vollgeschosse = Math.max(1, geschosse - (dachBeh ? 1 : 0) - (kellerBeh ? 1 : 0));   // ohne ausgebautes Dach und Keller
    const dachVolumen = dachBeh ? L * B * B * Math.tan(alpha) / 4 : 0;
    const ve = zahl(g.veManuell) > 0 ? zahl(g.veManuell) : L * B * H + dachVolumen + L * B * hk;
    const geschosshoehe = H > 0 ? (H + hk) / (vollgeschosse + (kellerBeh ? 1 : 0)) : 0;
    const anFaktor = !geschosshoehe || (geschosshoehe >= 2.5 && geschosshoehe <= 3.0) ? 0.32 : (1 / geschosshoehe - 0.04);
    const wfl = zahl(a.wfl);
    const we = Math.max(1, Math.round(zahl(a.we, 1)));
    return {
      L, B, H, alpha, dachBeh, kellerBeh, hk, geschosse, vollgeschosse, dachVolumen, ve, geschosshoehe: geschosshoehe || 2.75,
      an: anFaktor * ve, anFaktor, raumhoehe: 2.5, we, weSelbst: we === 1 ? 1 : 0, wfl, personen: Math.max(1, Math.round(wfl / 40)), wbz: 0.1,
      bundesland: (p.objekt || {}).bundesland || bundeslandAusPlz((p.objekt || {}).plz) || "BL_NI",
    };
  }

  /**
   * Soll-Hülle aus Länge (Traufseite), Breite (Giebelseite), Wandhöhe, Gebäudeart, Keller und Dach.
   * Jedes Bauteil hat einen festen Schlüssel; die App gleicht darüber ab und behält Fenster und Aufbauten.
   */
  function huelleSoll(p) {
    const A = auto(p), a = p.allg || {}, g = p.geo || {};
    const { L, B, H } = A;
    if (!(L > 0 && B > 0 && H > 0)) return [];
    const vorne = norm(zahl(g.vorne, 180));
    const art = a.gebaeudeArt || "GEBV_FREISTEHEND";
    const nachbar = g.nachbar === "links" ? "links" : "rechts";
    const giebelDreieck = A.dachBeh ? B * B * Math.tan(A.alpha) / 4 : 0;
    const giebel = [["links", norm(vorne + 90)], ["rechts", norm(vorne - 90)]];   // von vorne gesehen (Blick auf die Fassade)
    const angebaut = seite => art === "GEBV_REIHENBEBAUUNG" || (art === "GEBV_ANGEBAUT" && seite === nachbar);
    const soll = [
      { key: "aw-vorne", art: "aw", name: `Außenwand vorne (${RICHTUNG[vorne]})`, orient: vorne, laenge: L, hoehe: H },
      { key: "aw-hinten", art: "aw", name: `Außenwand hinten (${RICHTUNG[norm(vorne + 180)]})`, orient: norm(vorne + 180), laenge: L, hoehe: H },
    ];
    for (const [seite, o] of giebel) {
      if (angebaut(seite)) continue;
      soll.push({ key: "aw-giebel-" + seite, art: "aw", name: `Giebelwand ${seite} (${RICHTUNG[o]})`, orient: o, laenge: B, hoehe: H,
        flaeche: giebelDreieck ? B * H + giebelDreieck : 0 });
    }
    if (A.dachBeh) {
      const sparren = (B / 2) / Math.cos(A.alpha);
      const neig = zahl(g.dachneigung, 40);
      soll.push({ key: "dach-vorne", art: "dach", name: `Dachfläche vorne (${RICHTUNG[vorne]})`, orient: vorne, neigung: neig, laenge: L, hoehe: sparren });
      soll.push({ key: "dach-hinten", art: "dach", name: `Dachfläche hinten (${RICHTUNG[norm(vorne + 180)]})`, orient: norm(vorne + 180), neigung: neig, laenge: L, hoehe: sparren });
    } else if (a.dach === "DK_FLACHDACH") {
      soll.push({ key: "flach", art: "flach", name: "Flachdach", laenge: L, hoehe: B });
    } else {
      soll.push({ key: "ogd", art: "ogd", name: "Oberste Geschossdecke", laenge: L, hoehe: B });
    }
    if (A.kellerBeh) {
      soll.push({ key: "bp", art: "bp", name: "Bodenplatte Keller", laenge: L, hoehe: B });
      const umfang = [["vorne", L, vorne], ["hinten", L, norm(vorne + 180)], ...giebel.filter(([s]) => !angebaut(s)).map(([s, o]) => [s, B, o])];
      for (const [seite, l, o] of umfang) soll.push({ key: "we-" + seite, art: "we", name: `Kellerwand ${seite} (${RICHTUNG[o]})`, orient: o, laenge: l, hoehe: A.hk });
    } else if (a.keller === "KK_KELLER_UNBEH" || a.keller === "KK_KELLER_TEILW_BEH") {
      soll.push({ key: "kd", art: "kd", name: "Kellerdecke", laenge: L, hoehe: B });
    } else {
      soll.push({ key: "bp", art: "bp", name: "Bodenplatte", laenge: L, hoehe: B });
    }
    return soll;
  }

  /** Brutto-/Netto-Flächen aller Bauteile und Kennwerte – für Anzeige und Export. */
  function kennwerte(p) {
    const A = auto(p);
    const bauteile = (p.bauteile || []).map(bt => {
      const art = BAUTEILARTEN[bt.art] || BAUTEILARTEN.aw;
      const brutto = zahl(bt.flaeche) > 0 ? zahl(bt.flaeche) : zahl(bt.laenge) * zahl(bt.hoehe);
      const oeff = (bt.oeffnungen || []).reduce((s, o) => s + zahl(o.breite) * zahl(o.hoehe) * Math.max(1, zahl(o.anzahl, 1)), 0);
      const konstr = (p.konstruktionen || []).find(k => k.id === bt.konstrId);
      return { id: bt.id, art, brutto, oeff, netto: Math.max(0, brutto - oeff), u: uWert(konstr, bt.art) };
    });
    let huelle = 0;
    for (const b of bauteile) huelle += b.netto + b.oeff;
    return { ...A, bauteile, huelle, aVe: A.ve > 0 ? huelle / A.ve : null };
  }

  /** Grobe Heizlast (kW) für die Wärmepumpen-Leistung; EVEBI rechnet die genaue Heizlast selbst.
   *  0,8 × (H_T + H_V) × 30 K liegt bei den Tests knapp über EVEBIs Wert – reicht, damit EVEBI die Leistung nicht als zu niedrig meldet. */
  function heizlast(p) {
    const k = kennwerte(p);
    const fx = { aw: 1, wu: 0.5, we: 0.6, dach: 1, flach: 1, ogd: 0.8, bp: 0.45, kd: 0.5, dbu: 1 };
    let ht = 0;
    for (const b of (p.bauteile || [])) {
      const x = k.bauteile.find(y => y.id === b.id);
      if (x && x.u) ht += x.u * x.netto * (fx[b.art] || 1);
      for (const o of (b.oeffnungen || [])) {
        const f = (p.fenstertypen || []).find(t => t.id === o.fensterId);
        if (f) ht += zahl(f.uw, 1.3) * zahl(o.breite) * zahl(o.hoehe) * Math.max(1, zahl(o.anzahl, 1));
      }
    }
    ht += k.wbz * k.huelle;
    const hv = 0.34 * 0.5 * 0.76 * k.ve;
    return 0.8 * (ht + hv) * 30 / 1000;
  }

  /** Modernisierungsempfehlungen wie EVEBIs Vorschlagsliste: aus U-Werten und Anlagendaten abgeleitet. */
  function empfehlungen(p) {
    const k = kennwerte(p), out = [];
    const schlechtester = gruppe => {
      let best = null;
      for (const b of (p.bauteile || [])) {
        const x = k.bauteile.find(y => y.id === b.id);
        if (!x || x.u == null || x.art.gruppe !== gruppe) continue;
        const faktor = x.u / x.art.gegWert;
        if (!best || faktor > best.faktor) best = { b, x, faktor };
      }
      return best;
    };
    const w = schlechtester("wand");
    if (w && w.faktor > 1.5) {
      const konstr = (p.konstruktionen || []).find(c => c.id === w.b.konstrId);
      const hohlschicht = konstr && konstr.schichten.some(s => s.luft && zahl(s.dicke) >= 4);
      out.push(hohlschicht
        ? { key: "aw-kern", anlagenteil: "Außenwand gg. Außenluft", text: "Kerndämmung der Luftschicht im zweischaligen Mauerwerk (Einblasdämmung)", paket: true }
        : { key: "aw-wdvs", anlagenteil: "Außenwand gg. Außenluft", text: "Dämmung der Außenwände gemäß gültiger Verordnung, 14–16 cm", paket: true });
    }
    const d = schlechtester("dach");
    if (d && d.faktor > 1.5) {
      out.push(d.b.art === "ogd"
        ? { key: "ogd", anlagenteil: "Oberste Geschossdecke", text: "Dämmung der obersten Geschossdecke gemäß gültiger Verordnung, 16–20 cm", paket: true }
        : { key: "dach", anlagenteil: "Dach", text: "Dämmung der Dachflächen gemäß gültiger Verordnung", paket: true });
    }
    const f = schlechtester("boden");
    if (f && f.faktor > 1.5) {
      out.push(f.b.art === "kd"
        ? { key: "kd", anlagenteil: "Kellerdecke", text: "Dämmung der Kellerdecke von unten, 10–12 cm", paket: true }
        : { key: "bp", anlagenteil: "Fußboden", text: "Dämmung des Fußbodens zum Erdreich bei Erneuerung des Fußbodenaufbaus", paket: false });
    }
    let fensterSchlecht = false;
    for (const b of (p.bauteile || [])) for (const o of (b.oeffnungen || [])) {
      const t = (p.fenstertypen || []).find(x => x.id === o.fensterId);
      if (t && t.art !== "FART_AUSSENTUER" && zahl(t.uw) > 1.6) fensterSchlecht = true;
    }
    if (fensterSchlecht) out.push({ key: "fenster", anlagenteil: "Fenster", text: "Austausch der Fenster gemäß gültiger Verordnung, Uw ≤ 0,95 W/(m²K)", paket: true });
    const hz = p.heizung || {};
    if (!hz.hydr) out.push({ key: "hydr", anlagenteil: "Heizung", text: "Hydraulischer Abgleich und Optimierung der Regelungstechnik", paket: false });
    const alter = new Date().getFullYear() - zahl(hz.baujahr, new Date().getFullYear());
    if (hz.preset && !/^wp/.test(hz.preset) && (alter >= 20 || hz.preset === "gas_nt_dl")) {
      out.push({ key: "erzeuger", anlagenteil: "Heizung", text: "Erneuerung des Wärmeerzeugers, z. B. durch eine Wärmepumpe", paket: false });
    }
    const aus = new Set(((p.ea || {}).aus) || []);
    return out.map(e => ({ ...e, aktiv: !aus.has(e.key) }));
  }

  // ------------------------------------------------------------ XML-Helfer
  const isEl = n => n && n.nodeType === 1;
  function kids(el, name) {
    const out = [];
    for (let n = el.firstChild; n; n = n.nextSibling) if (isEl(n) && (!name || n.nodeName === name)) out.push(n);
    return out;
  }
  function find(el, path) {
    let cur = el;
    for (const part of path.split("/")) {
      if (!cur) return null;
      cur = kids(cur, part)[0] || null;
    }
    return cur;
  }
  function need(el, path) {
    const n = find(el, path);
    if (!n) throw new Error("EVEBI-Vorlage: Feld fehlt: " + el.nodeName + "/" + path);
    return n;
  }
  function text(el, path) {
    const n = path ? find(el, path) : el;
    return n ? (n.textContent || "").trim() : "";
  }
  function setText(node, value) {
    while (node.firstChild) node.removeChild(node.firstChild);
    if (value !== "") node.appendChild(node.ownerDocument.createTextNode(value));
  }
  const f7 = x => Number(x).toFixed(7);
  function fmt(v) { return typeof v === "number" ? f7(v) : String(v); }

  /** Wert setzen; bei auto/man/calc-Feldern das passende Attribut mitziehen. */
  function setv(el, path, value) {
    const node = need(el, path);
    const v = fmt(value);
    setText(node, v);
    if (node.getAttribute("auto") === "false") node.setAttribute("man", v);
    else if (node.getAttribute("auto") === "true" && node.hasAttribute("calc")) node.setAttribute("calc", v);
    return node;
  }
  function setman(el, path, value) {
    const node = need(el, path);
    const v = fmt(value);
    node.setAttribute("auto", "false");
    node.setAttribute("man", v);
    setText(node, v);
  }
  function setauto(el, path, value) {
    const node = need(el, path);
    const v = fmt(value);
    node.setAttribute("auto", "true");
    if (node.hasAttribute("calc")) node.setAttribute("calc", v);
    setText(node, v);
  }
  function setMemo(el, memo) {
    const m = find(el, "Memo");
    if (!m || !memo) return;
    m.setAttribute("auto", "false");
    m.setAttribute("man", memo);
    setText(m, memo);
  }

  function neueGuid() {
    const c = root.crypto;
    const u = c && c.randomUUID ? c.randomUUID() :
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, ch => {
        const r = Math.random() * 16 | 0; return (ch === "x" ? r : (r & 3 | 8)).toString(16);
      });
    return "{" + u.toUpperCase() + "}";
  }
  function regen(el) {
    const stack = [el];
    while (stack.length) {
      const n = stack.pop();
      if (n.hasAttribute && n.hasAttribute("GUID")) n.setAttribute("GUID", neueGuid());
      for (const k of kids(n)) stack.push(k);
    }
    return el;
  }

  function parseXml(str) {
    const doc = new root.DOMParser().parseFromString(str, "application/xml");
    const err = doc.getElementsByTagName("parsererror");
    if (err && err.length) throw new Error("XML-Fehler in der Vorlage");
    return doc;
  }
  function importiere(doc, xmlString) {
    const frag = parseXml(xmlString).documentElement;
    return doc.importNode ? doc.importNode(frag, true) : frag;
  }
  function leeren(listEl, nurItems = true) {
    for (const k of kids(listEl)) if (!nurItems || k.nodeName === "item") listEl.removeChild(k);
  }

  // ------------------------------------------------------------ ZIP + Hash
  const CRC_TAB = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TAB[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  async function deflateRaw(bytes) {
    if (typeof root.CompressionStream !== "function") return null;
    try {
      const cs = new root.CompressionStream("deflate-raw");
      const stream = new root.Blob([bytes]).stream().pipeThrough(cs);
      return new Uint8Array(await new root.Response(stream).arrayBuffer());
    } catch (e) { return null; }
  }
  async function zip(dateien) {
    const enc = new TextEncoder();
    const teile = [], zentral = [];
    let offset = 0;
    const jetzt = new Date();
    const dosZeit = (jetzt.getHours() << 11) | (jetzt.getMinutes() << 5) | (jetzt.getSeconds() >> 1);
    const dosDatum = ((jetzt.getFullYear() - 1980) << 9) | ((jetzt.getMonth() + 1) << 5) | jetzt.getDate();
    for (const { name, data } of dateien) {
      const nameB = enc.encode(name);
      const crc = crc32(data);
      const def = await deflateRaw(data);
      const methode = def && def.length < data.length ? 8 : 0;
      const inhalt = methode === 8 ? def : data;
      const lokal = new DataView(new ArrayBuffer(30));
      lokal.setUint32(0, 0x04034b50, true); lokal.setUint16(4, 20, true); lokal.setUint16(6, 0x0800, true);
      lokal.setUint16(8, methode, true); lokal.setUint16(10, dosZeit, true); lokal.setUint16(12, dosDatum, true);
      lokal.setUint32(14, crc, true); lokal.setUint32(18, inhalt.length, true); lokal.setUint32(22, data.length, true);
      lokal.setUint16(26, nameB.length, true); lokal.setUint16(28, 0, true);
      teile.push(new Uint8Array(lokal.buffer), nameB, inhalt);
      const z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true);
      z.setUint16(10, methode, true); z.setUint16(12, dosZeit, true); z.setUint16(14, dosDatum, true);
      z.setUint32(16, crc, true); z.setUint32(20, inhalt.length, true); z.setUint32(24, data.length, true);
      z.setUint16(28, nameB.length, true); z.setUint32(42, offset, true);
      zentral.push(new Uint8Array(z.buffer), nameB);
      offset += 30 + nameB.length + inhalt.length;
    }
    const zGroesse = zentral.reduce((s, x) => s + x.length, 0);
    const ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
    ende.setUint32(12, zGroesse, true); ende.setUint32(16, offset, true);
    const alle = [...teile, ...zentral, new Uint8Array(ende.buffer)];
    const out = new Uint8Array(alle.reduce((s, x) => s + x.length, 0));
    let pos = 0;
    for (const x of alle) { out.set(x, pos); pos += x.length; }
    return out;
  }
  async function sha1(bytes) {
    const buf = await root.crypto.subtle.digest("SHA-1", bytes);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function dataUrlBytes(url) {
    const b64 = url.split(",")[1] || "";
    const bin = root.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ------------------------------------------------------------ Hauptfunktion
  /**
   * @param {object} p Projekt aus der App
   * @param {object} aussteller Ausstellerdaten aus den Einstellungen
   * @returns {Promise<{bytes: Uint8Array, dateiname: string, warnungen: string[]}>}
   */
  async function erzeugeEvex(p, aussteller) {
    const V = root.EVEX_VORLAGE;
    if (!V) throw new Error("Vorlage nicht geladen");
    const warnungen = [];
    const doc = parseXml(V.skeleton);
    const prj = doc.documentElement;
    const eing = need(prj, "eing");
    const hdr = need(prj, "hdr");
    const zone = need(eing, "zDListe/item");
    const ZONE = zone.getAttribute("GUID");
    const heute = new Date().toISOString().slice(0, 10);
    const allg = p.allg || {}, geo = p.geo || {}, obj = p.objekt || {}, ku = p.kunde || {}, ea = p.ea || {};
    const kw = kennwerte(p);
    const datum = ea.datum || heute;                       // EVEBI: Ausstellungsdatum = Tag der Erstellung
    const baujahr = String(zahl(allg.baujahr) || "");
    const wfl = kw.wfl;
    // Kunde: ein Namensfeld in der App, Adresse wie Objekt, solange nichts anderes eingetragen ist
    const kName = String(ku.name || [ku.vorname, ku.nachname].filter(Boolean).join(" ")).trim();
    const kAdr = ku.andereAdresse ? ku : obj;

    // ---- Kopfdaten
    const ort = [obj.ort, [obj.strasse, obj.hausnr].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    setv(hdr, "name", "Wohngebäude" + (ort ? " " + ort : ""));
    const oa = need(hdr, "objektAdr");
    for (const [k, v] of [["Plz", obj.plz], ["Ort", obj.ort], ["Strasse", obj.strasse], ["Hausnr", obj.hausnr]]) setv(oa, k, v || "");
    const ka = need(hdr, "kundenAdr");
    for (const [k, v] of [["Anrede", ku.anrede], ["Vorname", ""], ["Nachname", kName], ["Plz", kAdr.plz],
      ["Ort", kAdr.ort], ["Strasse", kAdr.strasse], ["Hausnr", kAdr.hausnr], ["Telefon", ku.telefon], ["eMail", ku.email]]) {
      if (find(ka, k)) setv(ka, k, v || "");
    }
    if (find(ka, "Briefanrede")) {
      const nach = kName.split(" ").pop();
      setv(ka, "Briefanrede", ku.anrede === "Herr" && nach ? `Sehr geehrter Herr ${nach},` : ku.anrede === "Frau" && nach ? `Sehr geehrte Frau ${nach},` : "Sehr geehrte Damen und Herren,");
    }
    const pa = need(hdr, "planerAdr");
    const au = aussteller || {};
    for (const [k, v] of [["Firma", au.firma], ["Anrede", au.anrede], ["Vorname", au.vorname], ["Nachname", au.nachname],
      ["Plz", au.plz], ["Ort", au.ort], ["Strasse", au.strasse], ["Hausnr", au.hausnr], ["Telefon", au.telefon],
      ["eMail", au.email], ["BAFABeraterNr", au.bafaNr]]) {
      if (find(pa, k)) setv(pa, k, v || "");
    }
    if (find(pa, "Briefanrede") && au.nachname) setv(pa, "Briefanrede", `Sehr geehrte${au.anrede === "Frau" ? " Frau" : "r Herr"} ${au.nachname},`);

    const L = kw.L, B = kw.B;
    const hoehe = L * B > 0 ? kw.ve / (L * B) : kw.H;
    for (const [k, v] of [
      ["baujahr", baujahr], ["rechtsstand", datum], ["L_G", L], ["B_G", B],
      ["geschosse", String(kw.geschosse)], ["vollgeschosse", String(kw.vollgeschosse)],
      ["we", String(kw.we)], ["we_selbstgenutzt", String(kw.weSelbst)],
      ["personen", String(kw.personen)], ["beheiztNRF", Math.round(wfl * 110) / 100],
      ["A_NGF_mitbeheizt", Math.round(wfl * 55) / 100], ["BRI", kw.ve], ["Ve", kw.ve],
      ["raumHoehe", kw.raumhoehe], ["dachKurz", allg.dach || "DK_DACH_UNBEH"],
      ["kellerKurz", allg.keller || "KK_KEINKELLER"], ["gebaeudeArt", allg.gebaeudeArt || "GEBV_FREISTEHEND"],
      ["bundesland", kw.bundesland], ["enevRegistriernummer", ""], ["eaKontrolldatei", "DKD_NONE"],
      ["kfwDatumFoerderAntrag", datum], ["bafaDatumFoerderAntrag", datum],
      ["datenErfasserEigentuemer", "false"], ["datenErfasserAussteller", "true"],
    ]) setv(hdr, k, v);
    setauto(hdr, "wfl", wfl);                              // EVEBI: beheizte Fläche = Summe der Zonenflächen

    // ---- Zone
    setv(zone, "geschossHoehe", kw.geschosshoehe);
    setauto(zone, "personen", String(kw.personen));
    setman(zone, "raumHoehe", kw.raumhoehe);
    setman(zone, "flaeche", wfl);
    setauto(zone, "V", wfl * kw.raumhoehe);

    // ---- Wärmebrücken (pauschal wie EVEBI-Standard)
    const wbz = kw.wbz;
    if (find(eing, "wbv/delta_U_WB")) setv(eing, "wbv/delta_U_WB", wbz);

    // ---- Konstruktionen
    const kl = need(eing, "konstruktionenListe");
    leeren(kl);
    const konstrGuid = {};
    for (const k of (p.konstruktionen || [])) {
      const el = regen(importiere(doc, V.proto.konstr[KONSTR_PROTO[k.typ] || "WAND"]));
      const abf = need(el, "abfolgenListe");
      kids(abf, "item").slice(1).forEach(x => abf.removeChild(x));
      setv(abf, "item/anteil", 1.0);
      const sl = need(el, "abfolgenListe/item/schichtenListe");
      leeren(sl);
      for (const s of (k.schichten || [])) {
        const lay = regen(importiere(doc, s.luft ? V.proto.layer.LUFT : V.proto.layer.STD));
        const d = zahl(s.dicke);
        setv(lay, "name", s.name || (s.luft ? "Luftschicht" : "Baustoff"));
        setv(lay, "dicke", d);
        setv(lay, "rohdichte", zahl(s.rho, s.luft ? 1.189 : 1000));
        setv(lay, "lambda", s.luft ? (d / 100) / rLuft(d) : zahl(s.lambda, 1));
        setText(need(lay, "sourceType"), "IMP_SRC_NONE");
        setText(need(lay, "sourceID"), "");
        sl.appendChild(lay);
      }
      setv(el, "name", k.name || "Konstruktion");
      setMemo(el, k.notiz || "");
      setText(need(el, "sourceType"), "IMP_SRC_NONE");
      setText(need(el, "sourceID"), "");
      const art = (p.bauteile || []).find(b => b.konstrId === k.id);
      const u = uWert(k, art ? art.art : (k.typ === "boden" ? "bp" : k.typ === "dach" ? "dach" : "aw"));
      if (zahl(k.uManuell) > 0) setman(el, "UWertStandard", zahl(k.uManuell));
      else setauto(el, "UWertStandard", u || 0);
      kl.appendChild(el);
      konstrGuid[k.id] = el.getAttribute("GUID");
    }

    // ---- Fenstertypen
    const fl = need(eing, "konstrFensterListe");
    leeren(fl);
    const fensterGuid = {};
    for (const f of (p.fenstertypen || [])) {
      const el = regen(importiere(doc, V.proto.fenster[f.art] || V.proto.fenster.FART_STANDARD));
      setman(el, "name", f.name || "Fenster");
      setMemo(el, f.notiz || "");
      setman(el, "UWertStandard", zahl(f.uw, 1.3));
      setv(el, "gWert", zahl(f.g, f.art === "FART_AUSSENTUER" ? 0.5 : 0.6));
      setv(el, "rahmenMaterial", f.rahmen || "RMAT_RAHMEN_KST");
      setText(need(el, "sourceType"), "IMP_SRC_NONE");
      setText(need(el, "sourceID"), "");
      fl.appendChild(el);
      fensterGuid[f.id] = el.getAttribute("GUID");
    }

    // ---- Bauteile + Teilflächen
    const bl = need(eing, "btlListe"), tl = need(eing, "tflListe");
    leeren(bl); leeren(tl);
    let btlId = 0, tflId = 0;
    const neuBtl = (typ, art, ueb, name, konstr, orient, neig, bj, memo) => {
      const b = regen(importiere(doc, V.proto.btl[typ]));
      setv(b, "art", art);
      setv(b, "Waermeuebergang", ueb);
      setman(b, "baujahr", String(bj || baujahr || 0));
      setv(b, "neigGrad", String(Math.round(neig)));
      setv(b, "orientGrad", String(Math.round(orient)));
      setv(b, "zoneID", ZONE);
      setText(need(b, "KonstruktionID"), konstr || "");
      setv(b, "ID", String(++btlId));
      setman(b, "name", name);
      if (find(b, "wbrZuschlag")) setv(b, "wbrZuschlag", wbz);
      setMemo(b, memo);
      bl.appendChild(b);
      return b;
    };
    const neuTfl = (typ, btl, form, funktion, a, bb, c, anzahl, abzug, name, verbund) => {
      const t = regen(importiere(doc, V.proto.tfl[typ]));
      const fl1 = a * bb;
      for (const [k, v] of [["valueA", a], ["valueB", bb], ["valueC", c], ["valueD", 0], ["valueE", 0], ["valueF", 0], ["valueK", 0],
        ["volumen_brutto", form === "TFF_BODEN" ? fl1 * c : 0], ["flaeche_brutto_einzel", fl1], ["flaeche_brutto", fl1 * anzahl],
        ["Azd", fl1 * anzahl], ["nettoA", a], ["nettoB", bb], ["nettoC", 0], ["nettoH", fl1]]) {
        if (find(t, k)) setv(t, k, v);
      }
      setv(t, "anzahl", String(anzahl));
      setv(t, "form", form);
      setv(t, "funktion", funktion);
      setv(t, "istAbzug", abzug ? "true" : "false");
      setText(need(t, "btlID"), btl.getAttribute("GUID"));
      setText(need(t, "parentID"), "");
      setText(need(t, "verbundID"), verbund || "");
      setv(t, "btlArt", text(btl, "art"));
      setv(t, "orientGrad", text(btl, "orientGrad"));
      setv(t, "ID", String(++tflId));
      if (name) setman(t, "name", name);
      tl.appendChild(t);
      return t;
    };

    let volumenGesetzt = false;
    for (const bt of (p.bauteile || [])) {
      const art = BAUTEILARTEN[bt.art] || BAUTEILARTEN.aw;
      const k = kw.bauteile.find(x => x.id === bt.id);
      const orient = bt.orient == null || bt.orient === "" ? 90 : zahl(bt.orient);
      const neig = art.btl === "WAND" ? 90 : (bt.neigung === "" || bt.neigung == null ? art.neig : zahl(bt.neigung));
      if (!konstrGuid[bt.konstrId]) warnungen.push(`„${bt.name || art.label}“ hat keine Konstruktion – in EVEBI zuordnen.`);
      const b = neuBtl(art.btl, BTL_ART[art.btl], art.ueb, bt.name || art.label, konstrGuid[bt.konstrId], orient, neig, bt.baujahr, bt.notiz);
      if (art.flaeche === "tfl") {
        const mitMassen = !(zahl(bt.flaeche) > 0) && zahl(bt.laenge) > 0;
        neuTfl("WAND", b, "TFF_WAND", "TVF_GIEBEL", mitMassen ? zahl(bt.laenge) : k.brutto, mitMassen ? zahl(bt.hoehe) : 1, 0, 1, false, bt.name || art.label);
        setauto(b, "A", k.netto);
      } else {
        setman(b, "A", k.netto);
        if (art.boden && !volumenGesetzt && L * B > 0) {
          neuTfl("BODEN", b, "TFF_BODEN", "TVF_GIEBEL", L, B, hoehe, 1, false, "Grundfläche (Volumen der beheizten Hülle)");
          volumenGesetzt = true;
        }
      }
      if (konstrGuid[bt.konstrId] && k.u) setauto(b, "UWert", k.u);

      // Öffnungen gruppiert je Fenstertyp
      const gruppen = {};
      for (const o of (bt.oeffnungen || [])) (gruppen[o.fensterId] = gruppen[o.fensterId] || []).push(o);
      for (const [fid, liste] of Object.entries(gruppen)) {
        const ftyp = (p.fenstertypen || []).find(f => f.id === fid);
        if (!ftyp) { warnungen.push(`Fenster in „${bt.name}“ ohne Fenstertyp – übersprungen.`); continue; }
        const fneig = art.btl === "WAND" ? 90 : neig;
        const fb = neuBtl("FENSTER", "BTL_FENSTER", "UEB_F_AUSSEN", `${ftyp.name} – ${bt.name || art.label}`,
          fensterGuid[fid], orient, fneig, ftyp.baujahr);
        let summe = 0;
        for (const o of liste) {
          const n = Math.max(1, Math.round(zahl(o.anzahl, 1)));
          const w = zahl(o.breite), h = zahl(o.hoehe);
          const tf = neuTfl("FENSTER", fb, "TFF_FENSTER", "TVF_GIEBEL", w, h, 0, n, false, o.name || ftyp.name);
          if (art.flaeche === "tfl") {
            neuTfl("ABZ", b, "TFF_WAND", "TVF_FENSTER_ABZ", w, h, 0, n, true, "Abzug " + (o.name || ftyp.name), tf.getAttribute("GUID"));
          }
          summe += w * h * n;
        }
        setauto(fb, "A", summe);
        setauto(fb, "UWert", zahl(ftyp.uw, 1.3));
      }
    }
    if (!volumenGesetzt) warnungen.push("Kein Bodenbauteil (Bodenplatte/Kellerdecke) mit Gebäudemaßen – das Volumen fehlt. In EVEBI prüfen.");

    // ---- Heizung, Warmwasser, Lüftung aus Vorlage
    const hz = p.heizung || {};
    const preset = V.heizung[hz.preset] || V.heizung.gas_bw_zentral_speicher;
    for (const lst of V.heizListen) {
      const alt = need(eing, lst);
      const neu = importiere(doc, preset.listen[lst].split("@@ZONE@@").join(ZONE).split("@@PRJ@@").join(prj.getAttribute("GUID")));
      eing.replaceChild(neu, alt);
    }
    const bjHz = String(zahl(hz.baujahr) || baujahr);
    const erz = kids(need(eing, "hzErzListe"), "item");
    if (erz[0]) {
      setv(erz[0], "baujahr", bjHz);
      // Kessel/Thermen: Leistung aus der Vorlage (EVEBI rechnet die Heizlast). Wärmepumpe: an die Heizlast angepasst,
      // sonst meldet EVEBI „Leistung zu niedrig“. Etagenheizung: eine Therme je Wohnung.
      if (/^wp/.test(hz.preset || "")) setv(erz[0], "Leistung", Math.max(6, Math.ceil(heizlast(p))));
      if (find(erz[0], "anzahlGeraete")) setv(erz[0], "anzahlGeraete", String(hz.preset === "gas_bw_etage" ? kw.we : 1));
    }
    for (const e of erz.slice(1)) setv(e, "baujahr", bjHz);
    const hzItem = kids(need(eing, "hzListe"), "item")[0];
    if (hzItem) {
      setv(hzItem, "baujahr", baujahr);
      const ue = find(hzItem, "uebergabeListe/item");
      if (ue) {
        const bjUe = String(zahl(hz.bjUebergabe) || baujahr);
        setv(ue, "baujahr", bjUe);
        setv(ue, "bjRegelung", bjUe);
        setv(ue, "heizKoerperArt", hz.uebergabe || "HZK_HEIZKOERPER");
        setv(ue, "hkTemp", hz.uebergabe === "HZK_FLAECHENHZ" ? "HKTEMP_35_28" : "HKTEMP_55_45");
        setv(ue, "hydrAbgeglichenArt", typeof hz.hydr === "string" ? hz.hydr : (hz.hydr ? "HYA_STATISCH_OHNE_GRUPPE" : "HYA_NONE"));
        if (hz.uebergabe === "HZK_FLAECHENHZ") setv(ue, "flHzSystem", "FHZ_SYS_FB_NASS");
        setv(ue, "name", hz.uebergabe === "HZK_FLAECHENHZ" ? "Fußbodenheizung" : "Heizkörper");
      }
    }
    for (const t of kids(need(eing, "twListe"), "item")) setv(t, "baujahr", baujahr);
    for (const t of kids(need(eing, "twErzListe"), "item")) setv(t, "baujahr", bjHz);
    for (const l of kids(need(eing, "luftListe"), "item")) {
      if (find(l, "kuehlWfl")) setv(l, "kuehlWfl", wfl);
      if (find(l, "bj_Anlage")) setv(l, "bj_Anlage", baujahr);
      setv(l, "baujahr", baujahr);
    }
    const li = find(eing, "lichtListe/item");
    if (li && find(li, "A")) setv(li, "A", Math.round(wfl * 110) / 100);

    // ---- Energieausweis
    const eaEl = need(eing, "ea");
    for (const [k, v] of [["ausstellgrund", ea.anlass || "AG_VERMIETUNG"], ["gebaeudeteil", "GT_GANZES_GEB"],
      ["baujahr", baujahr], ["baujahrHzErz", bjHz], ["ausstelldatum", datum]]) setv(eaEl, k, v);
    const ml = need(eaEl, "modernisierungenListe");
    leeren(ml);
    const liste = [...empfehlungen(p).filter(e => e.aktiv), ...(ea.eigene || []), ...(ea.modernisierungen || [])];
    for (const m of liste) {
      if (!m.text) continue;
      const it = regen(importiere(doc, V.proto.mod));
      setv(it, "anlagenteil", m.anlagenteil || "");
      setv(it, "name", m.text);
      setv(it, "paket", m.paket ? "true" : "false");
      ml.appendChild(it);
    }
    const isfp = find(eing, "iSFP");
    if (isfp) {
      setv(isfp, "ausstelldatum", datum);
      for (const t of ["kellerText", "wandText", "fensterText", "dachText", "heizungText", "verteilungText", "warmwasserText", "lueftungText"]) {
        const n = find(isfp, t);
        if (n) setText(n, "");
      }
    }

    // ---- Foto
    const bilder = [];
    const bs = need(prj, "bilderStreamsListe");
    leeren(bs);
    if (p.foto && /^data:image\/jpe?g;base64,/.test(p.foto)) {
      const g = neueGuid();
      const it = importiere(doc, V.proto.bild.split("{00000000-0000-0000-0000-000000000000}").join(g));
      const d = new Date(datum);
      setText(need(it, "aufnahmedatum"), `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`);
      bs.appendChild(it);
      bilder.push({ guid: g, data: dataUrlBytes(p.foto) });
    }
    setv(prj, "readOnly", "false");

    // ---- Serialisieren, GUIDs neu vergeben, packen
    let xml = new root.XMLSerializer().serializeToString(prj);
    const definiert = new Set();
    xml.replace(/GUID="(\{[0-9A-F-]{36}\})"/g, (_, g) => { definiert.add(g); return _; });
    const map = {};
    for (const g of definiert) map[g] = neueGuid();
    xml = xml.replace(/\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}/g, g => map[g] || g);
    xml = xml.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    const xmlBytes = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?>' + xml);

    const dateien = [{ name: "projekt.xml", data: xmlBytes }];
    for (const b of bilder) dateien.push({ name: `blob_${map[b.guid] || b.guid}.jpg`, data: b.data });
    let hashes = "";
    for (const d of dateien) hashes += `${d.name}=sha1:${await sha1(d.data)}\r\n`;
    dateien.push({ name: "file-hashes", data: new TextEncoder().encode(hashes) });

    const basis = (ort || p.projekt?.bezeichnung || "Projekt").replace(/[\\/:*?"<>|]+/g, " ").trim();
    return { bytes: await zip(dateien), dateiname: basis + ".evex", warnungen };
  }

  root.EvexGen = { erzeugeEvex, kennwerte, auto, huelleSoll, empfehlungen, heizlast, bundeslandAusPlz, uWert, rLuft, BAUTEILARTEN, RICHTUNG };
})(typeof window !== "undefined" ? window : globalThis);

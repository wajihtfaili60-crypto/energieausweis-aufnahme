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
    aw:    { label: "Außenwand gegen Außenluft",          btl: "WAND",   ueb: "UEB_W_AUSSEN",      konstr: "wand",  rsi: 0.13, rse: 0.04, flaeche: "tfl", neig: 90 },
    wu:    { label: "Wand gegen unbeheizten Raum",         btl: "WAND",   ueb: "UEB_W_UNBEHEIZT",   konstr: "wand",  rsi: 0.13, rse: 0.13, flaeche: "tfl", neig: 90 },
    we:    { label: "Wand gegen Erdreich",                 btl: "WAND",   ueb: "UEB_W_ERDREICH",    konstr: "wand",  rsi: 0.13, rse: 0.00, flaeche: "tfl", neig: 90 },
    dach:  { label: "Dachfläche (beheiztes Dach)",         btl: "DACH",   ueb: "UEB_D_AUSSEN",      konstr: "dach",  rsi: 0.10, rse: 0.04, flaeche: "man", neig: 45 },
    flach: { label: "Flachdach",                           btl: "DACH",   ueb: "UEB_D_AUSSEN",      konstr: "dach",  rsi: 0.10, rse: 0.04, flaeche: "man", neig: 0 },
    ogd:   { label: "Oberste Geschossdecke zum unbeheizten Dachraum", btl: "DACH", ueb: "UEB_D_NAUSG_DACH", konstr: "dach", rsi: 0.10, rse: 0.10, flaeche: "man", neig: 0 },
    bp:    { label: "Bodenplatte auf Erdreich",            btl: "KELLER", ueb: "UEB_K_BP_OHNE_RD",  konstr: "boden", rsi: 0.17, rse: 0.00, flaeche: "man", neig: 0, boden: true },
    kd:    { label: "Kellerdecke zum unbeheizten Keller",  btl: "KELLER", ueb: "UEB_K_KELLER_OPM",  konstr: "boden", rsi: 0.17, rse: 0.17, flaeche: "man", neig: 0, boden: true },
    dbu:   { label: "Decke nach unten gegen Außenluft",    btl: "KELLER", ueb: "UEB_K_AUSSEN",      konstr: "boden", rsi: 0.17, rse: 0.04, flaeche: "man", neig: 0, boden: true },
  };
  const KONSTR_PROTO = { wand: "WAND", dach: "DACH", boden: "KELLER" };
  const BTL_ART = { WAND: "BTL_WAND", DACH: "BTL_DACH", KELLER: "BTL_KELLER", FENSTER: "BTL_FENSTER" };

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

  function zahl(x, d = 0) {
    const v = typeof x === "string" ? Number(x.replace(",", ".")) : Number(x);
    return Number.isFinite(v) ? v : d;
  }

  /** Brutto-/Netto-Flächen aller Bauteile und Kennwerte – für Anzeige und Export. */
  function kennwerte(p) {
    const geo = p.geo || {};
    const L = zahl(geo.laenge), B = zahl(geo.breite), H = zahl(geo.hoehe);
    const ve = zahl(geo.veManuell) > 0 ? zahl(geo.veManuell) : L * B * H;
    const an = 0.32 * ve;
    const bauteile = (p.bauteile || []).map(bt => {
      const art = BAUTEILARTEN[bt.art] || BAUTEILARTEN.aw;
      const brutto = zahl(bt.flaeche) > 0 ? zahl(bt.flaeche) : zahl(bt.laenge) * zahl(bt.hoehe);
      const oeff = (bt.oeffnungen || []).reduce((s, o) => s + zahl(o.breite) * zahl(o.hoehe) * Math.max(1, zahl(o.anzahl, 1)), 0);
      const konstr = (p.konstruktionen || []).find(k => k.id === bt.konstrId);
      return { id: bt.id, art, brutto, oeff, netto: Math.max(0, brutto - oeff), u: uWert(konstr, bt.art) };
    });
    let ht = 0, a = 0, fehlt = false;
    const wbz = zahl((p.allg || {}).wbz, 0.1);
    for (const bt of (p.bauteile || [])) {
      const k = bauteile.find(x => x.id === bt.id);
      a += k.netto;
      if (k.u == null) fehlt = true; else ht += k.u * k.netto * fx(bt.art);
      for (const o of (bt.oeffnungen || [])) {
        const f = (p.fenstertypen || []).find(x => x.id === o.fensterId);
        const fl = zahl(o.breite) * zahl(o.hoehe) * Math.max(1, zahl(o.anzahl, 1));
        a += fl;
        if (!f || !zahl(f.uw)) fehlt = true; else ht += zahl(f.uw) * fl;
      }
    }
    ht += wbz * a;
    return { ve, an, bauteile, huelle: a, htStrich: a > 0 ? ht / a : null, unvollstaendig: fehlt, aVe: ve > 0 ? a / ve : null };
  }
  // Temperatur-Korrekturfaktoren nur für die Vorschau (EVEBI rechnet selbst genau)
  function fx(art) {
    return { aw: 1, wu: 0.5, we: 0.6, dach: 1, flach: 1, ogd: 0.8, bp: 0.6, kd: 0.6, dbu: 1 }[art] || 1;
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
    const datum = ea.datum || heute;
    const baujahr = String(zahl(allg.baujahr) || "");
    const wfl = zahl(allg.wfl);

    // ---- Kopfdaten
    const ort = [obj.ort, [obj.strasse, obj.hausnr].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    setv(hdr, "name", "Wohngebäude" + (ort ? " " + ort : ""));
    const oa = need(hdr, "objektAdr");
    for (const [k, v] of [["Plz", obj.plz], ["Ort", obj.ort], ["Strasse", obj.strasse], ["Hausnr", obj.hausnr]]) setv(oa, k, v || "");
    const ka = need(hdr, "kundenAdr");
    for (const [k, v] of [["Anrede", ku.anrede], ["Vorname", ku.vorname], ["Nachname", ku.nachname], ["Plz", ku.plz],
      ["Ort", ku.ort], ["Strasse", ku.strasse], ["Hausnr", ku.hausnr], ["Telefon", ku.telefon], ["eMail", ku.email]]) {
      if (find(ka, k)) setv(ka, k, v || "");
    }
    if (find(ka, "Briefanrede")) {
      const br = ku.nachname ? `Sehr geehrte${ku.anrede === "Herr" ? "r Herr" : ku.anrede === "Frau" ? " Frau" : " Damen und Herren"}${ku.anrede === "Herr" || ku.anrede === "Frau" ? " " + ku.nachname : ""},` : "Sehr geehrte Damen und Herren,";
      setv(ka, "Briefanrede", br);
    }
    const pa = need(hdr, "planerAdr");
    const au = aussteller || {};
    for (const [k, v] of [["Firma", au.firma], ["Anrede", au.anrede], ["Vorname", au.vorname], ["Nachname", au.nachname],
      ["Plz", au.plz], ["Ort", au.ort], ["Strasse", au.strasse], ["Hausnr", au.hausnr], ["Telefon", au.telefon],
      ["eMail", au.email], ["BAFABeraterNr", au.bafaNr]]) {
      if (find(pa, k)) setv(pa, k, v || "");
    }
    if (find(pa, "Briefanrede") && au.nachname) setv(pa, "Briefanrede", `Sehr geehrte${au.anrede === "Frau" ? " Frau" : "r Herr"} ${au.nachname},`);

    const L = zahl(geo.laenge), B = zahl(geo.breite);
    const hoehe = L * B > 0 ? kw.ve / (L * B) : zahl(geo.hoehe);
    for (const [k, v] of [
      ["baujahr", baujahr], ["rechtsstand", datum], ["L_G", L], ["B_G", B],
      ["geschosse", String(zahl(allg.geschosse, 1))], ["vollgeschosse", String(zahl(allg.vollgeschosse, 1))],
      ["we", String(zahl(allg.we, 1))], ["we_selbstgenutzt", String(zahl(allg.weSelbst, 0))],
      ["personen", String(zahl(allg.personen, 0))], ["wfl", wfl], ["beheiztNRF", Math.round(wfl * 110) / 100],
      ["A_NGF_mitbeheizt", Math.round(wfl * 55) / 100], ["BRI", kw.ve], ["Ve", kw.ve],
      ["raumHoehe", zahl(geo.raumhoehe, 2.5)], ["dachKurz", allg.dach || "DK_DACH_UNBEH"],
      ["kellerKurz", allg.keller || "KK_KEINKELLER"], ["gebaeudeArt", allg.gebaeudeArt || "GEBV_FREISTEHEND"],
      ["bundesland", obj.bundesland || "BL_NI"], ["enevRegistriernummer", ""], ["eaKontrolldatei", "DKD_NONE"],
      ["kfwDatumFoerderAntrag", datum], ["bafaDatumFoerderAntrag", datum],
      ["datenErfasserEigentuemer", ea.datenEigentuemer ? "true" : "false"], ["datenErfasserAussteller", "true"],
    ]) setv(hdr, k, v);

    // ---- Zone
    setv(zone, "geschossHoehe", zahl(geo.geschosshoehe, 2.75));
    setv(zone, "personen", String(zahl(allg.personen, 0) || Math.max(1, Math.round(wfl / 35))));
    setman(zone, "raumHoehe", zahl(geo.raumhoehe, 2.5));
    setman(zone, "flaeche", wfl);
    setauto(zone, "V", wfl * zahl(geo.raumhoehe, 2.5));

    // ---- Wärmebrücken
    const wbz = zahl(allg.wbz, 0.1);
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
      if (zahl(hz.leistung) > 0) setv(erz[0], "Leistung", zahl(hz.leistung));
      if (zahl(hz.anzahl) > 0 && find(erz[0], "anzahlGeraete")) setv(erz[0], "anzahlGeraete", String(Math.round(zahl(hz.anzahl))));
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
        setv(ue, "hkTemp", hz.hkTemp || (hz.uebergabe === "HZK_FLAECHENHZ" ? "HKTEMP_35_28" : "HKTEMP_55_45"));
        setv(ue, "hydrAbgeglichenArt", hz.hydr || "HYA_NONE");
        if (hz.uebergabe === "HZK_FLAECHENHZ") setv(ue, "flHzSystem", "FHZ_SYS_FB_NASS");
        setv(ue, "name", hz.uebergabe === "HZK_FLAECHENHZ" ? "Fußbodenheizung" : "Heizkörper");
      }
    }
    for (const t of kids(need(eing, "twListe"), "item")) setv(t, "baujahr", baujahr);
    for (const t of kids(need(eing, "twErzListe"), "item")) setv(t, "baujahr", String(zahl(hz.bjTww) || bjHz));
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
    for (const m of (ea.modernisierungen || [])) {
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

  root.EvexGen = { erzeugeEvex, kennwerte, uWert, rLuft, BAUTEILARTEN };
})(typeof window !== "undefined" ? window : globalThis);

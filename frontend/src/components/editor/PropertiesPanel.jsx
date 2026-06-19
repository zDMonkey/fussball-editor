function Gruppe({ titel, children }) {
  return (
    <div className="pp-gruppe">
      <div className="pp-gruppe-titel">{titel}</div>
      {children}
    </div>
  );
}

function Zeile({ label, children }) {
  return (
    <div className="pp-zeile">
      <label className="pp-label">{label}</label>
      <div className="pp-steuerung">{children}</div>
    </div>
  );
}

function RadioGruppe({ optionen, wert, onChange }) {
  return (
    <div className="pp-radio-gruppe">
      {optionen.map((o) => (
        <button
          key={o.wert}
          className={`pp-radio-btn ${wert === o.wert ? 'aktiv' : ''}`}
          onClick={() => onChange(o.wert)}
          title={o.label}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FarbWaehler({ wert, onChange }) {
  return (
    <div className="pp-farb-wrapper">
      <div className="pp-farb-vorschau" style={{ background: wert }} />
      <input type="color" value={wert} onChange={(e) => onChange(e.target.value)} className="pp-farb-input" />
    </div>
  );
}

function ZahlEingabe({ wert, onChange, min = 1, max = 100 }) {
  return (
    <input
      type="number" value={wert} min={min} max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="pp-zahl-input"
    />
  );
}

// ── Pfeil ─────────────────────────────────────────────────────────────────────

function PfeilPanel({ opts, onChange }) {
  const set = (key, val) => onChange({ ...opts, [key]: val });
  return (
    <>
      <Gruppe titel="Kurve">
        <RadioGruppe
          optionen={[{ wert: 'straight', label: 'Gerade' }, { wert: 'curved', label: 'Gebogen' }]}
          wert={opts.curve} onChange={(v) => set('curve', v)}
        />
      </Gruppe>
      <Gruppe titel="Linientyp">
        <RadioGruppe
          optionen={[
            { wert: 'normal',  label: 'Normal' },
            { wert: 'dashed',  label: 'Gestrichelt' },
            { wert: 'wavy',    label: 'Geschlängelt' },
          ]}
          wert={opts.lineStyle} onChange={(v) => set('lineStyle', v)}
        />
      </Gruppe>
      <Gruppe titel="Linienende">
        <RadioGruppe
          optionen={[{ wert: 'none', label: 'Keine' }, { wert: 'arrow', label: 'Pfeil' }]}
          wert={opts.lineEnd} onChange={(v) => set('lineEnd', v)}
        />
      </Gruppe>
      <Gruppe titel="Darstellung">
        <Zeile label="Farbe"><FarbWaehler wert={opts.color} onChange={(v) => set('color', v)} /></Zeile>
        <Zeile label="Breite"><ZahlEingabe wert={opts.width} min={1} max={20} onChange={(v) => set('width', v)} /></Zeile>
        {opts.lineEnd === 'arrow' && (
          <Zeile label="Pfeilgröße"><ZahlEingabe wert={opts.arrowSize} min={3} max={30} onChange={(v) => set('arrowSize', v)} /></Zeile>
        )}
      </Gruppe>
    </>
  );
}

// ── Text ──────────────────────────────────────────────────────────────────────

function TextPanel({ opts, onChange }) {
  const set = (key, val) => onChange({ ...opts, [key]: val });
  const toggleStil = (stil) => {
    const aktuell = opts.style || [];
    set('style', aktuell.includes(stil) ? aktuell.filter((s) => s !== stil) : [...aktuell, stil]);
  };
  return (
    <>
      <Gruppe titel="Schriftstil">
        <div className="pp-radio-gruppe">
          {[['Fett', 'bold'], ['Kursiv', 'italic']].map(([label, wert]) => (
            <button
              key={wert}
              className={`pp-radio-btn ${(opts.style || []).includes(wert) ? 'aktiv' : ''}`}
              onClick={() => toggleStil(wert)}
            >
              {label}
            </button>
          ))}
        </div>
      </Gruppe>
      <Gruppe titel="Darstellung">
        <Zeile label="Größe"><ZahlEingabe wert={opts.fontSize} min={8} max={96} onChange={(v) => set('fontSize', v)} /></Zeile>
        <Zeile label="Farbe"><FarbWaehler wert={opts.color} onChange={(v) => set('color', v)} /></Zeile>
      </Gruppe>
    </>
  );
}

// ── Rechteck / Ellipse ────────────────────────────────────────────────────────

function FormPanel({ opts, onChange, selectedObject, onUpdateObject }) {
  const set = (key, val) => onChange({ ...opts, [key]: val });
  return (
    <Gruppe titel="Darstellung">
      <Zeile label="Füllfarbe">
        <div className="pp-farb-reihe">
          <FarbWaehler
            wert={opts.fill === 'transparent' ? '#ffffff' : opts.fill}
            onChange={(v) => set('fill', v)}
          />
          <button
            className={`pp-radio-btn ${opts.fill === 'transparent' ? 'aktiv' : ''}`}
            onClick={() => set('fill', opts.fill === 'transparent' ? '#3b82f6' : 'transparent')}
          >
            Keine
          </button>
        </div>
      </Zeile>
      <Zeile label="Randfarbe"><FarbWaehler wert={opts.stroke} onChange={(v) => set('stroke', v)} /></Zeile>
      <Zeile label="Randbreite"><ZahlEingabe wert={opts.strokeWidth} min={0} max={20} onChange={(v) => set('strokeWidth', v)} /></Zeile>
      {selectedObject && (
        <>
          <Zeile label="Breite">
            <ZahlEingabe wert={selectedObject.width || 120} min={10} max={800}
              onChange={(w) => onUpdateObject(selectedObject.id, { width: w })} />
          </Zeile>
          <Zeile label="Höhe">
            <ZahlEingabe wert={selectedObject.height || 80} min={10} max={800}
              onChange={(h) => onUpdateObject(selectedObject.id, { height: h })} />
          </Zeile>
        </>
      )}
    </Gruppe>
  );
}

// ── Objekt-Aktionen (Team / Löschen) ─────────────────────────────────────────

function ObjektPanel({ object, onUpdateObject, onDeleteObject }) {
  const istSpieler = object.type === 'player';
  return (
    <>
      {istSpieler && (
        <Gruppe titel="Team">
          <RadioGruppe
            optionen={[
              { wert: 'a',       label: 'Team A' },
              { wert: 'b',       label: 'Team B' },
              { wert: 'neutral', label: 'Neutral' },
            ]}
            wert={object.team || 'a'}
            onChange={(v) => onUpdateObject(object.id, { team: v })}
          />
        </Gruppe>
      )}
      <Gruppe titel="Objekt">
        <button className="pp-loeschen-btn" onClick={() => onDeleteObject(object.id)}>
          Objekt löschen
        </button>
      </Gruppe>
    </>
  );
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────

export default function PropertiesPanel({
  activeTool,
  selectedObject,
  toolOptions,
  onUpdateToolOptions,
  onUpdateObject,
  onDeleteObject,
}) {
  const pfeilToolAktiv   = activeTool === 'arrow_straight' || activeTool === 'arrow_curved';
  const pfeilSelektiert  = selectedObject?.type === 'arrow';
  const pfeilAktiv       = pfeilToolAktiv || pfeilSelektiert;

  const textSelektiert   = selectedObject?.type === 'text';
  const textAktiv        = activeTool === 'text' || textSelektiert;

  const formSelektiert   = selectedObject?.type === 'rect' || selectedObject?.type === 'ellipse';
  const formAktiv        = activeTool === 'rect' || activeTool === 'ellipse' || formSelektiert;

  const objektGewählt = selectedObject != null;

  if (!pfeilAktiv && !textAktiv && !formAktiv && !objektGewählt) return null;

  // Pfeil-Optionen: aus dem Objekt wenn selektiert, sonst Tool-Einstellungen
  const pfeilOpts = pfeilSelektiert
    ? { curve: selectedObject.curved ? 'curved' : 'straight', ...selectedObject }
    : toolOptions.arrow;

  const handlePfeilChange = (neu) => {
    if (pfeilSelektiert) {
      onUpdateObject(selectedObject.id, {
        curved: neu.curve === 'curved', lineStyle: neu.lineStyle,
        lineEnd: neu.lineEnd, color: neu.color, width: neu.width, arrowSize: neu.arrowSize,
      });
    }
    onUpdateToolOptions('arrow', neu);
  };

  // Text-Optionen: aus dem Objekt wenn selektiert, sonst Tool-Einstellungen
  const textOpts = textSelektiert
    ? {
        fontSize: selectedObject.fontSize ?? 14,
        color:    selectedObject.color    ?? '#1f2937',
        style:    [
          selectedObject.bold   && 'bold',
          selectedObject.italic && 'italic',
        ].filter(Boolean),
      }
    : toolOptions.text;

  // Form-Optionen: aus dem Objekt wenn selektiert, sonst Tool-Einstellungen
  const formOpts = formSelektiert
    ? {
        fill:        selectedObject.fill        ?? 'transparent',
        stroke:      selectedObject.stroke      ?? '#1f2937',
        strokeWidth: selectedObject.strokeWidth ?? 2,
      }
    : toolOptions.shape;

  return (
    <div className="properties-panel">
      <div className="pp-titel">Eigenschaften</div>

      {pfeilAktiv && <PfeilPanel opts={pfeilOpts} onChange={handlePfeilChange} />}

      {textAktiv && (
        <TextPanel
          opts={textOpts}
          onChange={(neu) => onUpdateToolOptions('text', neu)}
        />
      )}

      {formAktiv && (
        <FormPanel
          opts={formOpts}
          onChange={(neu) => onUpdateToolOptions('shape', neu)}
          selectedObject={formSelektiert ? selectedObject : null}
          onUpdateObject={onUpdateObject}
        />
      )}

      {objektGewählt && (
        <ObjektPanel
          object={selectedObject}
          onUpdateObject={onUpdateObject}
          onDeleteObject={onDeleteObject}
        />
      )}
    </div>
  );
}

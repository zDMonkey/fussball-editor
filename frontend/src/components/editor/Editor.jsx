import { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import { useNavigate } from 'react-router-dom';
import Toolbar from './Toolbar';
import ElementPicker from './ElementPicker';
import PlacedObject from './PlacedObject';
import PropertiesPanel from './PropertiesPanel';
import Timeline from './Timeline';
import FieldVollfeldHoch, { getFieldVollfeldHochSvgDataUrl } from './FieldVollfeldHoch';
import { createExercise, updateExercise } from '../../lib/exerciseApi';
import { buildExercisePayload } from '../../lib/exercisePersistence';

const FELD_BREITE  = 680;
const FELD_HOEHE   = 1050;
const THUMBNAIL_BASE_URL = (import.meta.env.VITE_THUMBNAIL_BASE_URL || '').replace(/\/$/, '');

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function leeresKeyframe() {
  return { id: makeId(), positions: {} };
}

function getInitialEditorState(initialTemplate) {
  // Nur der erste Render hydratisiert den Editor aus einem uebergebenen
  // Template. Spaetere Prop-Aenderungen ueberschreiben den Arbeitsstand
  // bewusst nicht automatisch.
  const choreography = initialTemplate?.choreography;
  const objects = Array.isArray(choreography?.objects) ? choreography.objects : [];
  const keyframes =
    Array.isArray(choreography?.keyframes) && choreography.keyframes.length > 0
      ? choreography.keyframes
      : [leeresKeyframe()];

  return { objects, keyframes };
}

function resolveReferenceImage(meta = {}) {
  // Referenzbilder stammen entweder direkt aus thumbnailUrl oder werden
  // aus thumbnailKey + konfigurierbarer Base-URL zusammengesetzt.
  const thumbnailUrl = meta.thumbnailUrl ?? '';
  const thumbnailKey = meta.thumbnailKey ?? '';

  if (thumbnailUrl) return thumbnailUrl;
  if (!thumbnailKey || !THUMBNAIL_BASE_URL) return '';
  if (thumbnailKey.startsWith('http://') || thumbnailKey.startsWith('https://') || thumbnailKey.startsWith('/')) {
    return thumbnailKey;
  }

  return `${THUMBNAIL_BASE_URL}/${thumbnailKey.replace(/^\//, '')}`;
}

const STANDARD_TOOL_OPTIONS = {
  arrow: { curve: 'straight', lineStyle: 'normal', lineEnd: 'arrow', color: '#1f2937', width: 2, arrowSize: 8 },
  text:  { style: [], fontSize: 14, color: '#1f2937' },
  shape: { fill: 'transparent', stroke: '#1f2937', strokeWidth: 2 },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
    image.src = src;
  });
}

async function createEditorThumbnail(stage) {
  if (!stage) return '';

  const exportScale = 0.4;
  const thumbnailWidth = Math.round(FELD_BREITE * exportScale);
  const thumbnailHeight = Math.round(FELD_HOEHE * exportScale);
  const canvas = document.createElement('canvas');
  canvas.width = thumbnailWidth;
  canvas.height = thumbnailHeight;

  const context = canvas.getContext('2d');
  if (!context) return '';

  const [fieldImage, stageImage] = await Promise.all([
    loadImage(getFieldVollfeldHochSvgDataUrl(FELD_BREITE, FELD_HOEHE)),
    loadImage(stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' })),
  ]);

  context.drawImage(fieldImage, 0, 0, thumbnailWidth, thumbnailHeight);
  context.drawImage(stageImage, 0, 0, thumbnailWidth, thumbnailHeight);

  return canvas.toDataURL('image/png');
}

export default function Editor({ initialTemplate = null }) {
  const navigate = useNavigate();
  const initialState = getInitialEditorState(initialTemplate);
  const initialMeta = initialTemplate?.meta ?? {};
  const initialFieldTemplate = initialTemplate?.editor?.fieldTemplate ?? 'vollfeld_hoch';
  const referenceImageUrl = resolveReferenceImage(initialMeta);
  const openedTemplateTitle = initialMeta.title?.trim() ?? '';
  const templateSourceLabel = initialTemplate?.source?.type === 'local-backend'
    ? 'Gespeicherte Übung'
    : initialTemplate?.source?.type === 'external-search'
    ? 'Bibliotheksvorlage'
    : 'Vorlage';

  const [objects, setObjects]         = useState(initialState.objects);
  const [keyframes, setKeyframes]     = useState(initialState.keyframes);
  const [activeFrame, setActiveFrame] = useState(0);
  const [exerciseId, setExerciseId]   = useState(initialTemplate?.id ?? null);
  const [title, setTitle]             = useState(initialMeta.title ?? '');
  const [description, setDescription] = useState(initialMeta.description ?? initialMeta.summary ?? '');
  const [ageGroup, setAgeGroup]       = useState(initialMeta.ageGroups?.[0] ?? '');
  const [focusInput, setFocusInput]   = useState((initialMeta.focus ?? []).join(', '));
  const [durationMinutes, setDurationMinutes] = useState(
    initialMeta.durationMinutes == null ? '' : String(initialMeta.durationMinutes)
  );
  const [fieldTemplate]               = useState(initialFieldTemplate);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError]     = useState('');

  const [activeTool, setActiveTool]             = useState('select');
  const [pickerOpen, setPickerOpen]             = useState(null);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);

  const [toolOptions, setToolOptions] = useState(STANDARD_TOOL_OPTIONS);

  // Pfeil-Zeichenmodus: Startpunkt wartet auf zweiten Klick
  const [pfeilStart, setPfeilStart] = useState(null);

  // Text-Inline-Editor: { id, screenX, screenY, text, fontSize, color, bold, italic }
  const [textBearbeiten, setTextBearbeiten] = useState(null);

  const stageRef = useRef(null);

  const [isPlaying, setIsPlaying]     = useState(false);
  const [livePositions, setLivePositions] = useState(null);
  const animRef = useRef(null);

  const handleToolClick = (tool) => {
    if (tool.kind === 'picker') {
      setPickerOpen(tool.groupSet);
    } else {
      setActiveTool(tool.id);
      setPendingPlacement(null);
      setPfeilStart(null);
    }
  };

  const handlePickerSelect = (item) => {
    setPendingPlacement(item);
    setPickerOpen(null);
  };

  const updateToolOptions = (gruppe, neueWerte) => {
    setToolOptions((prev) => ({ ...prev, [gruppe]: neueWerte }));
    if (!selectedObjectId) return;

    if (gruppe === 'arrow') {
      setObjects((prev) => prev.map((o) =>
        o.id === selectedObjectId && o.type === 'arrow' ? { ...o, ...neueWerte } : o
      ));
    } else if (gruppe === 'text') {
      setObjects((prev) => prev.map((o) => {
        if (o.id !== selectedObjectId || o.type !== 'text') return o;
        return {
          ...o,
          fontSize: neueWerte.fontSize,
          color:    neueWerte.color,
          bold:     (neueWerte.style || []).includes('bold'),
          italic:   (neueWerte.style || []).includes('italic'),
        };
      }));
    } else if (gruppe === 'shape') {
      setObjects((prev) => prev.map((o) => {
        if (o.id !== selectedObjectId || (o.type !== 'rect' && o.type !== 'ellipse')) return o;
        return { ...o, fill: neueWerte.fill, stroke: neueWerte.stroke, strokeWidth: neueWerte.strokeWidth };
      }));
    }
  };

  // Double-Click auf ein Text-Objekt → Textarea-Overlay öffnen
  const handleTextDblClick = (konvaEvent, object) => {
    const textNode  = konvaEvent.target;
    const stage     = textNode.getStage();
    const container = stage.container();
    const cRect     = container.getBoundingClientRect();
    const absPos    = textNode.getAbsolutePosition();
    setTextBearbeiten({
      id:      object.id,
      screenX: cRect.left + absPos.x,
      screenY: cRect.top  + absPos.y,
      text:    object.text || '',
      fontSize: object.fontSize || 14,
      color:   object.color   || '#1f2937',
      bold:    object.bold    || false,
      italic:  object.italic  || false,
    });
  };

  const handleTextBearbeitenBlur = () => {
    if (textBearbeiten) {
      if (textBearbeiten.text.trim()) {
        handleUpdateObject(textBearbeiten.id, { text: textBearbeiten.text });
      } else {
        // Leere Text-Objekte sofort löschen
        handleDeleteObject(textBearbeiten.id);
      }
      setTextBearbeiten(null);
    }
  };

  const handleUpdateObject = (objectId, aenderungen) => {
    setObjects((prev) =>
      prev.map((o) => (o.id === objectId ? { ...o, ...aenderungen } : o))
    );
  };

  const handleDeleteObject = (objectId) => {
    setObjects((prev) => prev.filter((o) => o.id !== objectId));
    setKeyframes((prev) =>
      prev.map((kf) => {
        const pos = { ...kf.positions };
        delete pos[objectId];
        return { ...kf, positions: pos };
      })
    );
    setSelectedObjectId(null);
  };

  // Tastenkürzel: Entf/Backspace löscht das ausgewählte Objekt
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Nicht auslösen wenn der Fokus in einem Eingabefeld liegt
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (selectedObjectId) handleDeleteObject(selectedObjectId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // handleDeleteObject ist stabil genug (keine deps nötig außer selectedObjectId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObjectId]);

  const isPfeilWerkzeug = activeTool === 'arrow_straight' || activeTool === 'arrow_curved';

  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    const pos   = stage.getPointerPosition();

    if (pendingPlacement) {
      const id = makeId();
      const istSpieler = pendingPlacement.pose !== undefined;
      const neuesObjekt = {
        id,
        type:  istSpieler ? 'player' : pendingPlacement.id,
        label: pendingPlacement.label,
        team:  pendingPlacement.team,
        pose:  pendingPlacement.pose,
        role:  pendingPlacement.role,
      };

      setObjects((prev) => [...prev, neuesObjekt]);
      setKeyframes((prev) =>
        prev.map((kf) => ({
          ...kf,
          positions: { ...kf.positions, [id]: { x: pos.x, y: pos.y } },
        }))
      );
      setPendingPlacement(null);
      setActiveTool('select');
      return;
    }

    if (isPfeilWerkzeug) {
      if (!pfeilStart) {
        // Erster Klick: Startpunkt merken
        setPfeilStart({ x: pos.x, y: pos.y });
      } else {
        // Zweiter Klick: Pfeil erzeugen
        const id = makeId();
        const curved = activeTool === 'arrow_curved';
        const opts = toolOptions.arrow;
        // Kontrollpunkt in der Mitte (für gebogene Pfeile verschiebbar)
        const cp = {
          x: (pfeilStart.x + pos.x) / 2,
          y: (pfeilStart.y + pos.y) / 2 - 40,
        };
        const pfeilObjekt = {
          id,
          type:         'arrow',
          points:       [pfeilStart.x, pfeilStart.y, pos.x, pos.y],
          curved,
          controlPoint: curved ? cp : null,
          lineStyle:    opts.lineStyle,
          lineEnd:      opts.lineEnd,
          color:        opts.color,
          width:        opts.width,
          arrowSize:    opts.arrowSize,
        };

        setObjects((prev) => [...prev, pfeilObjekt]);
        // Pfeile haben keine Positions-Keyframe (Position ist in points gespeichert)
        setPfeilStart(null);
        setActiveTool('select');
      }
      return;
    }

    if (activeTool === 'text') {
      const id = makeId();
      const opts = toolOptions.text;
      const neuesObjekt = {
        id, type: 'text', text: '',
        fontSize: opts.fontSize,
        color:    opts.color,
        bold:     (opts.style || []).includes('bold'),
        italic:   (opts.style || []).includes('italic'),
      };
      setObjects((prev) => [...prev, neuesObjekt]);
      setKeyframes((prev) => prev.map((kf, i) => i === activeFrame
        ? { ...kf, positions: { ...kf.positions, [id]: { x: pos.x, y: pos.y } } }
        : kf));
      setSelectedObjectId(id);
      setActiveTool('select');
      // Sofort Text-Editor öffnen
      const container = e.target.getStage().container();
      const cRect = container.getBoundingClientRect();
      setTextBearbeiten({
        id, screenX: cRect.left + pos.x, screenY: cRect.top + pos.y,
        text: '', fontSize: opts.fontSize, color: opts.color,
        bold: (opts.style || []).includes('bold'),
        italic: (opts.style || []).includes('italic'),
      });
      return;
    }

    if (activeTool === 'rect' || activeTool === 'ellipse') {
      const id = makeId();
      const opts = toolOptions.shape;
      setObjects((prev) => [...prev, {
        id, type: activeTool, width: 120, height: 80,
        fill: opts.fill, stroke: opts.stroke, strokeWidth: opts.strokeWidth,
      }]);
      setKeyframes((prev) => prev.map((kf, i) => i === activeFrame
        ? { ...kf, positions: { ...kf.positions, [id]: { x: pos.x, y: pos.y } } }
        : kf));
      setSelectedObjectId(id);
      setActiveTool('select');
      return;
    }

    if (e.target === stage) {
      setSelectedObjectId(null);
    }
  };

  const updateObjectPosition = useCallback(
    (objectId, x, y) => {
      setKeyframes((prev) =>
        prev.map((kf, i) =>
          i === activeFrame
            ? { ...kf, positions: { ...kf.positions, [objectId]: { x, y } } }
            : kf
        )
      );
    },
    [activeFrame]
  );

  const handleAddKeyframe = () => {
    const basePositions = keyframes[activeFrame]?.positions ?? {};
    const neuerFrame = { id: makeId(), positions: { ...basePositions } };
    const insertAt = activeFrame + 1;
    setKeyframes((prev) => [
      ...prev.slice(0, insertAt),
      neuerFrame,
      ...prev.slice(insertAt),
    ]);
    setActiveFrame(insertAt);
  };

  const handleDeleteKeyframe = (index) => {
    setKeyframes((prev) => prev.filter((_, i) => i !== index));
    setActiveFrame((prev) => Math.max(0, prev >= index ? prev - 1 : prev));
  };

  const handlePlay = () => {
    if (isPlaying) {
      cancelAnimationFrame(animRef.current);
      setIsPlaying(false);
      setLivePositions(null);
      return;
    }
    if (keyframes.length < 2) return;

    setIsPlaying(true);
    const segmentDauer = 900;
    const totalSegmente = keyframes.length - 1;
    const start = performance.now();

    const step = (now) => {
      const vergangen = now - start;
      const gesamtDauer = segmentDauer * totalSegmente;

      if (vergangen >= gesamtDauer) {
        setLivePositions(keyframes[keyframes.length - 1].positions);
        setIsPlaying(false);
        return;
      }

      const segmentIndex    = Math.floor(vergangen / segmentDauer);
      const segmentFortschritt = (vergangen % segmentDauer) / segmentDauer;
      const von = keyframes[segmentIndex].positions;
      const bis = keyframes[segmentIndex + 1].positions;

      const interpoliert = {};
      for (const obj of objects) {
        const a = von[obj.id];
        const b = bis[obj.id] ?? a;
        if (!a) continue;
        interpoliert[obj.id] = {
          x: a.x + (b.x - a.x) * segmentFortschritt,
          y: a.y + (b.y - a.y) * segmentFortschritt,
        };
      }

      setLivePositions(interpoliert);
      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const handleSave = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setSaveError('Bitte zuerst einen Titel eingeben.');
      setSaveMessage('');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveMessage('');

    const normalizedFocus = focusInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const stageDataUrl = await createEditorThumbnail(stageRef.current);

    const payload = buildExercisePayload({
      title: trimmedTitle,
      description,
      ageGroup,
      durationMinutes,
      focus: normalizedFocus,
      fieldTemplate,
      objects,
      keyframes,
      thumbnailUrl: stageDataUrl,
    });

    try {
      // Erstes Speichern erzeugt eine neue Uebung im lokalen Backend.
      // Ab dem ersten erfolgreichen Save wird auf Update umgeschaltet.
      const savedExercise = exerciseId
        ? await updateExercise(exerciseId, payload)
        : await createExercise(payload);

      setExerciseId(savedExercise.id);
      setSaveMessage(exerciseId ? 'Änderungen gespeichert.' : 'Übung gespeichert.');
    } catch (error) {
      setSaveError(error.message || 'Speichern fehlgeschlagen.');
    } finally {
      setIsSaving(false);
    }
  };

  const positionenZumRenderr = livePositions ?? keyframes[activeFrame]?.positions ?? {};

  // Ausgewähltes Objekt für das PropertiesPanel
  const ausgewaehltesObjekt = objects.find((o) => o.id === selectedObjectId) ?? null;

  // Cursor-Stil abhängig vom Werkzeug
  const cursorStil = isPfeilWerkzeug
    ? pfeilStart ? 'crosshair' : 'cell'
    : activeTool === 'text'
    ? 'text'
    : activeTool === 'rect' || activeTool === 'ellipse'
    ? 'crosshair'
    : pendingPlacement
    ? 'copy'
    : 'default';

  return (
    <div className="editor-layout">
      <div className="editor-document-bar">
        <div className="editor-document-fields">
          <button className="editor-back-button" type="button" onClick={() => navigate(-1)}>
            Zurück
          </button>
          <input
            className="editor-document-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titel der Übung"
          />
          <input
            className="editor-document-meta"
            type="text"
            value={ageGroup}
            onChange={(event) => setAgeGroup(event.target.value)}
            placeholder="Altersklasse"
          />
          <input
            className="editor-document-title"
            type="text"
            value={focusInput}
            onChange={(event) => setFocusInput(event.target.value)}
            placeholder="Schwerpunkte, z. B. Dribbling, Umschalten"
          />
          <input
            className="editor-document-meta"
            type="number"
            min="0"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            placeholder="Dauer (Min.)"
          />
        </div>

        <div className="editor-document-actions">
          {saveError && <span className="editor-save-state editor-save-state-error">{saveError}</span>}
          {!saveError && saveMessage && <span className="editor-save-state">{saveMessage}</span>}
          <button className="editor-save-button" type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>

      {openedTemplateTitle && (
        <div className="editor-template-banner">
          <span className="editor-template-badge">{templateSourceLabel}</span>
          <span className="editor-template-text">Geöffnet aus: {openedTemplateTitle}</span>
        </div>
      )}

      <div className="editor-description-bar">
        <textarea
          className="editor-description-input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Kurzbeschreibung der Übung"
          rows={2}
        />
      </div>

      <Toolbar activeTool={activeTool} onToolClick={handleToolClick} />

      <div className="editor-haupt-zeile">
        <div className="editor-canvas-wrapper" style={{ cursor: cursorStil }}>
          {pendingPlacement && (
            <div className="placement-hint">
              {pendingPlacement.label} ausgewählt — Klick aufs Feld zum Platzieren
            </div>
          )}
          {isPfeilWerkzeug && pfeilStart && (
            <div className="placement-hint">
              Startpunkt gesetzt — Klick für Endpunkt
            </div>
          )}

          <div className="field-background">
            <FieldVollfeldHoch width={FELD_BREITE} height={FELD_HOEHE} />
          </div>

          <Stage
            ref={stageRef}
            width={FELD_BREITE}
            height={FELD_HOEHE}
            className="editor-stage"
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            <Layer>
              {objects.map((obj) => {
                // Pfeile haben keine Keyframe-Position (eingebettet in points)
                if (obj.type === 'arrow') {
                  return (
                    <PlacedObject
                      key={obj.id}
                      object={{ ...obj, x: 0, y: 0 }}
                      isSelected={selectedObjectId === obj.id}
                      onSelect={setSelectedObjectId}
                      onDragMove={updateObjectPosition}
                      onDragEnd={updateObjectPosition}
                      onUpdateObject={handleUpdateObject}
                    />
                  );
                }
                const pos = positionenZumRenderr[obj.id];
                if (!pos) return null;
                return (
                  <PlacedObject
                    key={obj.id}
                    object={{ ...obj, x: pos.x, y: pos.y }}
                    isSelected={selectedObjectId === obj.id}
                    onSelect={setSelectedObjectId}
                    onDragMove={updateObjectPosition}
                    onDragEnd={updateObjectPosition}
                    onUpdateObject={handleUpdateObject}
                    onTextEdit={handleTextDblClick}
                    isTextEditing={textBearbeiten?.id === obj.id}
                  />
                );
              })}
            </Layer>
          </Stage>

          {pickerOpen && (
            <ElementPicker
              groupSet={pickerOpen}
              onSelect={handlePickerSelect}
              onClose={() => setPickerOpen(null)}
            />
          )}
        </div>

        {referenceImageUrl && (
          <aside className="editor-reference-panel">
            <div className="editor-reference-title">Referenz</div>
            <img
              className="editor-reference-image"
              src={referenceImageUrl}
              alt={`Referenz für ${title || 'die Übung'}`}
            />
          </aside>
        )}

        <PropertiesPanel
          activeTool={activeTool}
          selectedObject={ausgewaehltesObjekt}
          toolOptions={toolOptions}
          onUpdateToolOptions={updateToolOptions}
          onUpdateObject={handleUpdateObject}
          onDeleteObject={handleDeleteObject}
        />
      </div>

      <Timeline
        keyframes={keyframes}
        activeIndex={activeFrame}
        onSelect={setActiveFrame}
        onAddKeyframe={handleAddKeyframe}
        onDeleteKeyframe={handleDeleteKeyframe}
        onPlay={handlePlay}
        isPlaying={isPlaying}
      />

      {/* Text-Inline-Editor: erscheint über dem Canvas an der Klickposition */}
      {textBearbeiten && (
        <textarea
          style={{
            position:   'fixed',
            left:       textBearbeiten.screenX,
            top:        textBearbeiten.screenY,
            minWidth:   120,
            fontSize:   textBearbeiten.fontSize + 'px',
            fontWeight: textBearbeiten.bold   ? 'bold'   : 'normal',
            fontStyle:  textBearbeiten.italic ? 'italic' : 'normal',
            color:      textBearbeiten.color,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            lineHeight: '1.2',
            border:     '1.5px dashed #2563eb',
            background: 'rgba(255,255,255,0.96)',
            padding:    '2px 6px',
            outline:    'none',
            resize:     'none',
            zIndex:     200,
            overflow:   'hidden',
            whiteSpace: 'pre',
          }}
          rows={1}
          value={textBearbeiten.text}
          onChange={(e) =>
            setTextBearbeiten((prev) => ({ ...prev, text: e.target.value }))
          }
          onBlur={handleTextBearbeitenBlur}
          onKeyDown={(e) => {
            e.stopPropagation(); // Entf-Taste soll nicht das Objekt löschen
            if (e.key === 'Escape') {
              setTextBearbeiten(null);
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleTextBearbeitenBlur();
            }
          }}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      )}
    </div>
  );
}

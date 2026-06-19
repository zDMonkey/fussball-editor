import { useRef } from 'react';
import { Group, Image, Rect, Arrow, Shape, Circle, Line, Text, Ellipse } from 'react-konva';
import { useImage } from '../../hooks/useImage';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function spielerIconPfad(object) {
  if (object.role === 'trainer') return '/assets/players/trainer_stehen.svg';
  const team = object.team === 'b' ? 'b' : 'a';
  if (object.role === 'torhueter') return `/assets/players/torhueter_stehen_${team}.svg`;
  return `/assets/players/spieler_${object.pose || 'stehen'}_${team}.svg`;
}

function bezierPunkte(x0, y0, cx, cy, x1, y1, schritte = 16) {
  const pts = [];
  for (let i = 0; i <= schritte; i++) {
    const t = i / schritte, mt = 1 - t;
    pts.push(mt * mt * x0 + 2 * mt * t * cx + t * t * x1);
    pts.push(mt * mt * y0 + 2 * mt * t * cy + t * t * y1);
  }
  return pts;
}

function wellenPunkte(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!len) return [x1, y1, x2, y2];
  const schritte = Math.ceil(len / 2);
  const nx = -dy / len, ny = dx / len;
  const pts = [];
  for (let i = 0; i <= schritte; i++) {
    const t = i / schritte;
    const welle = Math.sin((t * len / 16) * 2 * Math.PI) * 6;
    pts.push(x1 + dx * t + nx * welle);
    pts.push(y1 + dy * t + ny * welle);
  }
  return pts;
}

// ── Pfeil-Handles ─────────────────────────────────────────────────────────────

function PfeilHandle({ x, y, farbe = '#2563eb', onMove }) {
  return (
    <Circle
      x={x} y={y} radius={6}
      fill="#fff" stroke={farbe} strokeWidth={2}
      shadowColor="rgba(0,0,0,0.25)" shadowBlur={4}
      draggable hitStrokeWidth={16}
      onClick={(e) => { e.cancelBubble = true; }}
      onTap={(e) => { e.cancelBubble = true; }}
      onDragMove={(e) => { e.cancelBubble = true; onMove(e.target.x(), e.target.y()); }}
      onDragEnd={(e)  => { e.cancelBubble = true; onMove(e.target.x(), e.target.y()); }}
    />
  );
}

// ── Spieler & Equipment ───────────────────────────────────────────────────────

function SpielerBild({ object, isSelected, common }) {
  const img = useImage(spielerIconPfad(object));
  const w = 40, h = 56;
  return (
    <Group {...common}>
      {img && <Image image={img} width={w} height={h} offsetX={w / 2} offsetY={h / 2} />}
      {isSelected && (
        <Rect width={w+6} height={h+6} offsetX={(w+6)/2} offsetY={(h+6)/2}
          stroke="#fbbf24" strokeWidth={2.5} fill="transparent" cornerRadius={4} listening={false} />
      )}
    </Group>
  );
}

function EquipmentBild({ object, isSelected, common, w, h }) {
  const img = useImage(`/assets/equipment/${object.type}.svg`);
  return (
    <Group {...common}>
      {img && <Image image={img} width={w} height={h} offsetX={w/2} offsetY={h/2} />}
      {isSelected && (
        <Rect width={w+6} height={h+6} offsetX={(w+6)/2} offsetY={(h+6)/2}
          stroke="#fbbf24" strokeWidth={2.5} fill="transparent" cornerRadius={4} listening={false} />
      )}
    </Group>
  );
}

// ── Text-Objekt ───────────────────────────────────────────────────────────────

function TextObjekt({ object, isSelected, common, onDblClick, isEditing }) {
  const textRef = useRef(null);
  const { text = 'Text', fontSize = 14, color = '#1f2937', bold, italic } = object;
  const fontStyle = [bold && 'bold', italic && 'italic'].filter(Boolean).join(' ') || 'normal';

  return (
    <Group {...common}>
      <Text
        ref={textRef}
        text={text || ' '}
        fontSize={fontSize}
        fill={color}
        fontStyle={fontStyle}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        visible={!isEditing}
        onDblClick={(e) => { e.cancelBubble = true; onDblClick?.(e); }}
        onDblTap={(e)   => { e.cancelBubble = true; onDblClick?.(e); }}
      />
      {isSelected && !isEditing && (
        <Rect
          x={-4} y={-4}
          width={(textRef.current?.width()  || fontSize * 4) + 8}
          height={(textRef.current?.height() || fontSize + 4) + 8}
          stroke="#fbbf24" strokeWidth={2} fill="transparent" dash={[4, 4]}
          listening={false}
        />
      )}
    </Group>
  );
}

// ── Form-Objekt (Rechteck / Ellipse) ─────────────────────────────────────────

function FormObjekt({ object, isSelected, common }) {
  const { type, width = 120, height = 80, fill = 'transparent', stroke = '#1f2937', strokeWidth = 2 } = object;
  const pad = 4;

  return (
    <Group {...common}>
      {type === 'rect' ? (
        <Rect
          width={width} height={height}
          offsetX={width / 2} offsetY={height / 2}
          fill={fill} stroke={stroke} strokeWidth={strokeWidth}
          hitStrokeWidth={8}
        />
      ) : (
        <Ellipse
          radiusX={width / 2} radiusY={height / 2}
          fill={fill} stroke={stroke} strokeWidth={strokeWidth}
          hitStrokeWidth={8}
        />
      )}
      {isSelected && (
        <Rect
          x={-width / 2 - pad} y={-height / 2 - pad}
          width={width + pad * 2} height={height + pad * 2}
          stroke="#fbbf24" strokeWidth={2} fill="transparent" dash={[4, 4]}
          listening={false}
        />
      )}
    </Group>
  );
}

// ── Pfeil-Objekt ──────────────────────────────────────────────────────────────

function PfeilObjekt({ object, isSelected, onSelect, onUpdateObject }) {
  const { id, points, curved, lineStyle, lineEnd, color, width: lw, arrowSize, controlPoint } = object;
  if (!points || points.length < 4) return null;

  const farbe    = color || '#1f2937';
  const sw       = lw || 2;
  const hatPfeil = lineEnd === 'arrow';
  const pGr      = hatPfeil ? (arrowSize || 8) : 0;
  const dash     = lineStyle === 'dashed' ? [12, 6] : undefined;

  const klickProps = {
    onClick: (e) => { e.cancelBubble = true; onSelect(id); },
    onTap:   (e) => { e.cancelBubble = true; onSelect(id); },
  };

  const handleGroupDragEnd = (e) => {
    const gx = e.target.x(), gy = e.target.y();
    e.target.position({ x: 0, y: 0 });
    onUpdateObject(id, {
      points: [points[0]+gx, points[1]+gy, points[2]+gx, points[3]+gy],
      controlPoint: controlPoint ? { x: controlPoint.x+gx, y: controlPoint.y+gy } : null,
    });
  };

  const handles = isSelected && (
    <>
      <PfeilHandle x={points[0]} y={points[1]}
        onMove={(nx, ny) => onUpdateObject(id, { points: [nx, ny, points[2], points[3]] })} />
      <PfeilHandle x={points[2]} y={points[3]}
        onMove={(nx, ny) => onUpdateObject(id, { points: [points[0], points[1], nx, ny] })} />
      {curved && controlPoint && (
        <PfeilHandle x={controlPoint.x} y={controlPoint.y} farbe="#f59e0b"
          onMove={(nx, ny) => onUpdateObject(id, { controlPoint: { x: nx, y: ny } })} />
      )}
    </>
  );

  if (curved && controlPoint) {
    const approxPts = bezierPunkte(
      points[0], points[1], controlPoint.x, controlPoint.y, points[2], points[3]
    );
    return (
      <Group x={0} y={0} draggable onDragEnd={handleGroupDragEnd}>
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(points[0], points[1]);
            ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, points[2], points[3]);
            ctx.strokeShape(shape);
          }}
          stroke={farbe} strokeWidth={sw} dash={dash} listening={false}
        />
        <Line points={approxPts} stroke="#000" strokeWidth={1} opacity={0} hitStrokeWidth={24} {...klickProps} />
        {hatPfeil && (
          <Arrow points={[controlPoint.x, controlPoint.y, points[2], points[3]]}
            pointerLength={pGr} pointerWidth={pGr} fill={farbe} stroke={farbe} strokeWidth={0} listening={false} />
        )}
        {isSelected && (
          <Line points={[points[0], points[1], controlPoint.x, controlPoint.y, points[2], points[3]]}
            stroke="#f59e0b" strokeWidth={1} dash={[4, 4]} opacity={0.5} listening={false} />
        )}
        {handles}
      </Group>
    );
  }

  if (lineStyle === 'wavy') {
    const wellePts = wellenPunkte(points[0], points[1], points[2], points[3]);
    return (
      <Group x={0} y={0} draggable onDragEnd={handleGroupDragEnd}>
        <Line points={wellePts} stroke={farbe} strokeWidth={sw} listening={false} />
        <Line points={points} stroke="#000" strokeWidth={1} opacity={0} hitStrokeWidth={24} {...klickProps} />
        {hatPfeil && (
          <Arrow points={points} pointerLength={pGr} pointerWidth={pGr}
            fill={farbe} stroke={farbe} strokeWidth={0} listening={false} />
        )}
        {handles}
      </Group>
    );
  }

  return (
    <Group x={0} y={0} draggable onDragEnd={handleGroupDragEnd}>
      <Arrow points={points} pointerLength={pGr} pointerWidth={pGr}
        fill={farbe} stroke={farbe} strokeWidth={sw} dash={dash}
        hitStrokeWidth={24} {...klickProps} />
      {handles}
    </Group>
  );
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────

const EQUIPMENT_GROESSEN = {
  tor:       { w: 80, h: 52 },
  minitor:   { w: 56, h: 38 },
  hallentor: { w: 80, h: 64 },
  huetchen:  { w: 40, h: 32 },
  pylon:     { w: 32, h: 56 },
  fahne:     { w: 28, h: 52 },
  leiter:    { w: 100, h: 28 },
  stange:    { w: 16, h: 60 },
  ring:      { w: 48, h: 24 },
  ball:      { w: 40, h: 40 },
};

export default function PlacedObject({
  object, isSelected, onSelect, onDragMove, onDragEnd,
  onUpdateObject, onTextEdit, isTextEditing,
}) {
  const handleDrag    = (e) => onDragMove?.(object.id, e.target.x(), e.target.y());
  const handleDragEnd = (e) => onDragEnd?.(object.id, e.target.x(), e.target.y());

  const common = {
    x: object.x, y: object.y,
    draggable: true,
    onClick:    (e) => { e.cancelBubble = true; onSelect?.(object.id); },
    onTap:      (e) => { e.cancelBubble = true; onSelect?.(object.id); },
    onDragMove: handleDrag,
    onDragEnd:  handleDragEnd,
  };

  if (object.type === 'player') {
    return <SpielerBild object={object} isSelected={isSelected} common={common} />;
  }

  if (object.type === 'arrow') {
    return (
      <PfeilObjekt
        object={object} isSelected={isSelected}
        onSelect={onSelect} onUpdateObject={onUpdateObject}
      />
    );
  }

  if (object.type === 'text') {
    return (
      <TextObjekt
        object={object} isSelected={isSelected} common={common}
        isEditing={isTextEditing}
        onDblClick={(e) => onTextEdit?.(e, object)}
      />
    );
  }

  if (object.type === 'rect' || object.type === 'ellipse') {
    return <FormObjekt object={object} isSelected={isSelected} common={common} />;
  }

  const g = EQUIPMENT_GROESSEN[object.type] || { w: 40, h: 40 };
  return <EquipmentBild object={object} isSelected={isSelected} common={common} w={g.w} h={g.h} />;
}

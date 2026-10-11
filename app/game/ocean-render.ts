import { organZones, worldBodyPose } from './body-geometry';
import { tissue, pigment, livingEye } from './life-art';
import { drawMigration, drawOceanLandmarks } from './migration-render';
import type { BodyFormation } from './evolution-presentation';
import { evolutionFrame } from './evolution-presentation';
import { drawOrganism } from './organism-render';
import type { BodyDesign } from './body-design';
import { SPECIMENS } from './body-design';
import { renderTidal } from './tidal/render';
import {
  listOrgans,
  hasOrgan,
  localOrganAnchor,
  mountAngle,
} from './body-layout';
import { bodyRadius, growthScale, sizeRelation } from './food-chain';
import { cachedGlow, drawDepth, drawFeedback } from './atmosphere';
import { getView } from './camera';
import type { World, TraitId } from './simulation';
import type { BodyForm } from './forms';
import { FORMS } from './forms';
import {
  OCEAN_MAP,
  OCEAN_ROCKS,
  OCEAN_ZONES,
  oceanFlow,
  oceanTarget,
} from './ocean';
type C = CanvasRenderingContext2D;
function oval(
  c: C,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient,
  stroke?: string,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
const glow = cachedGlow;
/** Silhouettes, propulsion and organ marks share the same body renderer in play and the lineage. */
export function drawBody(
  c: C,
  form: BodyForm,
  x: number,
  y: number,
  size: number,
  angle: number,
  t: number,
  traits: TraitId[] = [],
  enemy = false,
  tint?: string,
  body?: BodyDesign,
  landOrgan?: 'crest' | 'plates',
  emergence = 1,
  adaptation?: 'reservoir' | 'skin',
  formation?: BodyFormation,
) {
  const f = FORMS[form],
    limbs = formation?.limbs ?? emergence;
  const covering = formation?.adaptation ?? emergence;
  const crown = formation?.landOrgan ?? 1;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(size / 36, size / 36);
  if (body) c.scale(body.length, body.width);
  c.lineWidth = 1.4;
  const color =
    tint ?? (enemy ? '#efb18d' : (body?.appearance?.base ?? f.color));
  // A small grounded shadow and opaque skin separate overlapping living bodies.
  oval(c, -3, 6, 37, 20, '#153b4433');
  const skin = tissue(c, color);
  const cellular = form === 'colony' || form === 'microbe';
  if (cellular) {
    // The same cells, pigment and inherited structures as the pond, not generic bubbles.
    if (form === 'colony' && limbs > 0)
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        drawOrganism(
          c,
          Math.cos(a) * 27 * limbs,
          Math.sin(a) * 23 * limbs,
          9 * limbs,
          0,
          t,
          traits,
          enemy,
        );
      }
    drawOrganism(
      c,
      0,
      0,
      form === 'microbe' ? 36 : 36 - 20 * limbs,
      0,
      t,
      traits,
      enemy,
    );
  } else if (form === 'radial') {
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9;
      const r = 17 + (38 + Math.sin(t * 4 + i) * 7) * limbs;
      c.strokeStyle = pigment(color, -0.23);
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(Math.cos(a) * 17, Math.sin(a) * 17);
      c.quadraticCurveTo(
        Math.cos(a + 0.1) * (17 + 21 * limbs),
        Math.sin(a + 0.1) * (17 + 21 * limbs),
        Math.cos(a + 0.2) * r,
        Math.sin(a + 0.2) * r,
      );
      c.stroke();
    }
    oval(c, 0, 0, 27, 27, skin, '#385569');
    oval(c, 0, 0, 10, 10, '#76597d', '#f2d8d2');
    livingEye(c, 10, -10, 5);
    livingEye(c, 10, 10, 5);
  } else if (form === 'jelly') {
    const pulse = 1 + Math.sin(t * 5) * 0.1;
    c.save();
    c.scale(pulse, 1 / pulse);
    for (let i = 0; i < 9; i++) {
      const y0 = (i - 4) * 7;
      c.strokeStyle = `${color}${i % 2 ? 'b0' : '68'}`;
      c.lineWidth = i % 2 ? 1.5 : 2.7;
      c.beginPath();
      c.moveTo(-8, y0);
      c.bezierCurveTo(
        -8 - 35 * limbs,
        y0 + Math.sin(t * 3 + i) * 18 * limbs,
        -8 - 65 * limbs,
        y0 + Math.cos(t * 3 + i) * 23 * limbs,
        -8 - (98 + (i % 3) * 9) * limbs,
        y0 + Math.sin(t * 3 + i + 1) * 22 * limbs,
      );
      c.stroke();
    }
    const g = c.createLinearGradient(-10, 0, 40, 0);
    g.addColorStop(0, '#977fc6bf');
    g.addColorStop(1, '#ead7ffe8');
    c.beginPath();
    c.moveTo(-10, -38);
    c.bezierCurveTo(57, -42, 57, 42, -10, 38);
    c.quadraticCurveTo(0, 0, -10, -38);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.stroke();
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(-5, i * 26);
      c.quadraticCurveTo(48, 0, -5, -i * 14);
      c.strokeStyle = `${color}66`;
      c.lineWidth = 0.7;
      c.stroke();
    }
    oval(c, 9, 0, 10, 13, '#dfb6ef80');
    livingEye(c, 22, -11, 5);
    livingEye(c, 22, 11, 5);
    c.restore();
  } else if (form === 'strider' || form === 'stalker') {
    const tall = form === 'strider';
    // Distinct limb proportions and trunk silhouettes, retained in lineage portraits.
    for (const side of [-1, 1])
      for (let leg = 0; leg < 2; leg++) {
        const x = 12 - leg * 37,
          stride = Math.sin(t * 8 + leg * Math.PI + side) * 12;
        const reach = (body?.legs ?? 1) * limbs,
          knee = 10 + ((tall ? 39 : 27) - 10) * reach,
          foot = 10 + ((tall ? 64 : 40) - 10) * reach;
        c.beginPath();
        c.moveTo(x, side * 10);
        c.lineTo(x - 12 + stride, side * knee);
        c.lineTo(x + 13 + stride, side * foot);
        c.strokeStyle = '#172b24';
        c.lineWidth = tall ? 8 : 14;
        c.lineCap = 'round';
        c.stroke();
        c.strokeStyle = color;
        c.lineWidth = tall ? 5 : 10;
        c.stroke();
        oval(c, x + 13 + stride, side * foot, 7, 4, color, '#f3ebcb');
      }
    c.beginPath();
    c.moveTo(-22, -10);
    c.quadraticCurveTo(
      -25 - 40 * limbs,
      -7,
      -25 - 58 * limbs,
      Math.sin(t * 5) * 16,
    );
    c.quadraticCurveTo(-25 - 34 * limbs, 16, -22, 10);
    c.fillStyle = color;
    c.fill();
    const g = c.createLinearGradient(0, -23, 0, 23);
    g.addColorStop(0, color);
    g.addColorStop(1, tall ? '#647b49' : '#856a42');
    oval(c, -4, 0, tall ? 31 : 40, tall ? 15 : 23, g, color);
    oval(c, tall ? 32 : 29, 0, tall ? 15 : 24, tall ? 13 : 18, skin, '#31564f');
    for (const side of [-1, 1]) {
      livingEye(c, tall ? 37 : 40, side * 8, tall ? 4.5 : 5.5, !tall);
      if (!tall) {
        c.beginPath();
        c.moveTo(46, side * 5);
        c.lineTo(54, side * 9);
        c.lineTo(47, side * 11);
        c.fillStyle = '#f5e8c3';
        c.fill();
      }
    }
    for (let i = 0; i < 4; i++)
      oval(c, -24 + i * 11, 0, 3, tall ? 7 : 14, '#f5edb740');
  } else {
    const walking = form === 'crawler' || form === 'skipper';
    if (walking) {
      for (const side of [-1, 1])
        for (let leg = 0; leg < 2; leg++) {
          const x = 12 - leg * 29,
            stride = Math.sin(t * 8 + leg * Math.PI + side) * 10;
          c.beginPath();
          c.moveTo(x, side * 9);
          c.lineTo(x - 7 + stride * limbs, side * (9 + 19 * limbs));
          c.lineTo(x + 5 + stride * limbs, side * (9 + 35 * limbs));
          c.strokeStyle = '#162f24aa';
          c.lineWidth = 9;
          c.lineCap = 'round';
          c.stroke();
          c.strokeStyle = color;
          c.lineWidth = 5;
          c.stroke();
          oval(
            c,
            x + 5 + stride * limbs,
            side * (9 + 35 * limbs),
            (form === 'skipper' ? 11 : 6) * limbs,
            (form === 'skipper' ? 8 : 4) * limbs,
            `${color}bb`,
            '#edf4bf',
          );
        }
      oval(c, 0, 0, 29, 18, skin, '#31564f');
    }
    const fish = form === 'fish';
    const tail = Math.sin(t * 8) * 10;
    c.fillStyle = tissue(c, body?.appearance?.accent ?? '#69c5c6', 30);
    c.strokeStyle = '#375c68';
    if (fish) {
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(4, side * 10);
        c.quadraticCurveTo(
          -4,
          side * (10 + (28 + Math.sin(t * 6) * 4) * limbs),
          -24,
          side * (10 + 19 * limbs),
        );
        c.lineTo(-14, side * 8);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.beginPath();
      c.moveTo(-33, 0);
      c.lineTo(-33 - 31 * limbs, (-25 + tail) * limbs);
      c.quadraticCurveTo(
        -33 - 20 * limbs,
        tail * limbs,
        -33 - 31 * limbs,
        (25 + tail) * limbs,
      );
      c.closePath();
      c.fill();
      c.stroke();
    } else {
      for (let i = 4; i >= 0; i--)
        oval(
          c,
          -i * 12 + 10,
          Math.sin(t * 7 - i * 0.65) * i * 1.5,
          18 - i * 1.8,
          15 - i * 1.8,
          skin,
          pigment(color, -0.45),
        );
    }
    if (fish) {
      const g = c.createLinearGradient(0, -18, 0, 18);
      g.addColorStop(0, pigment(color, 0.5));
      g.addColorStop(0.42, color);
      g.addColorStop(1, pigment(color, -0.4));
      c.beginPath();
      c.moveTo(42, 0);
      c.bezierCurveTo(18, -29, -9, -23, -40, 0);
      c.bezierCurveTo(-8, 23, 18, 29, 42, 0);
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#305c66';
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.moveTo(10, -14);
      c.quadraticCurveTo(0, 0, 10, 14);
      c.strokeStyle = `${color}80`;
      c.stroke();
    }
    const hunter = !!body && hasOrgan(body, 'jaw');
    livingEye(c, fish ? 25 : 18, -8, 5.8, hunter);
    livingEye(c, fish ? 25 : 18, 8, 5.2, hunter);
    // Stable freckles make this lineage recognizable across water and land.
    for (let i = 0; i < 3; i++) oval(c, -17 + i * 8, -5, 2.2, 3, '#eaf8b3a6');
  }
  if (body) {
    if (body.appearance && body.appearance.pattern !== 'plain') {
      c.save();
      c.globalAlpha *= 0.55;
      for (let j = -1; j <= 1; j++) {
        if (body.appearance.pattern === 'spots')
          oval(c, j * 14, 0, 4, 5, body.appearance.accent);
        else {
          c.beginPath();
          c.moveTo(j * 14 - 3, -10);
          c.lineTo(j * 14 + 3, 10);
          c.lineWidth = 4;
          c.strokeStyle = body.appearance.accent;
          c.stroke();
        }
      }
      c.restore();
    }
    for (const part of listOrgans(body)) {
      const organ = part.organ;
      const anchor = localOrganAnchor(part);
      c.save();
      c.translate(anchor.x, anchor.y);
      c.rotate(mountAngle(part.mount));
      c.translate(
        -(organ === 'spine'
          ? 18
          : organ === 'filter'
            ? 13
            : organ === 'jaw' || organ === 'fin'
              ? 4
              : 0),
        0,
      );
      const organScale =
        formation?.placements[part.id] ??
        formation?.organs[part.mount as keyof BodyFormation['organs']] ??
        1;
      c.scale(Math.max(0.001, organScale), Math.max(0.001, organScale));
      c.globalAlpha *= organScale;
      if (organ === 'spine') {
        c.beginPath();
        c.moveTo(-6, -7);
        c.lineTo(29, 0);
        c.lineTo(-6, 7);
        c.closePath();
        c.fillStyle = '#f9d58b';
        c.fill();
        c.strokeStyle = '#fff4cf';
        c.stroke();
      } else if (organ === 'jaw') {
        oval(c, 4, 0, 11, 8, tissue(c, '#bfaa8d', 9), '#385864');
        oval(c, 7, 0, 7, 4.5, '#3b3749');
        c.beginPath();
        c.moveTo(6, -6);
        c.lineTo(2, -2);
        c.moveTo(6, 6);
        c.lineTo(2, 2);
        c.strokeStyle = '#ffffff';
        c.stroke();
      } else if (organ === 'fin') {
        c.beginPath();
        c.moveTo(-9, -6);
        c.quadraticCurveTo(21, Math.sin(t * 5) * 5, -9, 13);
        c.closePath();
        c.fillStyle = tissue(c, '#84d5d1', 15);
        c.fill();
        c.strokeStyle = '#c0fbf6';
        c.stroke();
      } else if (organ === 'shell') {
        oval(c, 0, 0, 16, 11, tissue(c, '#a79bc9', 12), '#6b607d');
        c.beginPath();
        c.moveTo(-10, 0);
        c.quadraticCurveTo(0, -12, 10, 0);
        c.stroke();
      } else if (organ === 'glow') {
        oval(c, 0, 0, 9, 9, '#e1ed9a99', '#f8ffba');
      } else if (organ === 'ink') {
        oval(c, 0, 0, 11, 8, tissue(c, '#796598', 10), '#554668');
      } else if (organ === 'sail') {
        c.beginPath();
        c.moveTo(-12, 0);
        c.lineTo(18, -25);
        c.lineTo(22, 24);
        c.closePath();
        c.fillStyle = '#b5d8c488';
        c.fill();
        c.stroke();
      } else if (organ === 'anchor') {
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(22, 12, 10, 32);
        c.moveTo(0, 0);
        c.quadraticCurveTo(-22, 12, -10, 32);
        c.strokeStyle = '#d8bfaa';
        c.stroke();
      } else if (organ === 'reserve') {
        oval(c, 0, 0, 12, 9, tissue(c, '#efb966', 10), '#946d57');
        oval(c, 2, -2, 5, 3, '#e0fff080');
      } else if (organ === 'grasp') {
        c.beginPath();
        c.moveTo(-4, -6);
        c.quadraticCurveTo(15, -14, 20, -4);
        c.moveTo(-4, 6);
        c.quadraticCurveTo(15, 14, 20, 4);
        c.strokeStyle = '#efc5a4';
        c.lineWidth = 3;
        c.stroke();
      } else if (organ === 'lateral') {
        for (let j = -2; j <= 2; j++) oval(c, 0, j * 4, 2, 1.5, '#a7ecff');
      } else {
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(17, -25, 22, -21);
        c.quadraticCurveTo(33, 0, 22, 21);
        c.quadraticCurveTo(17, 25, 0, 0);
        c.fillStyle = tissue(c, '#d5b1df', 23);
        c.fill();
        for (let j = -3; j <= 3; j++) {
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(15, j * 4, 22, j * 7);
          c.strokeStyle = '#f5e5d2';
          c.stroke();
        }
      }
      c.restore();
    }
  }
  c.save();
  c.scale(Math.max(0.001, crown), Math.max(0.001, crown));
  c.globalAlpha *= crown;
  if (landOrgan === 'crest') {
    c.beginPath();
    c.moveTo(18, -8);
    c.lineTo(8, -34);
    c.lineTo(34, -16);
    c.fillStyle = '#e7bc78';
    c.fill();
    c.strokeStyle = '#ffdfab';
    c.stroke();
  }
  if (landOrgan === 'plates')
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(0, side * 18, 17, 10, side * 0.4, 0, Math.PI * 2);
      c.fillStyle = '#a8b9a0';
      c.fill();
      c.strokeStyle = '#e1e5bd';
      c.stroke();
    }
  c.restore();
  if (!cellular && traits.includes('shell'))
    oval(
      c,
      0,
      0,
      form === 'fish' ? 47 : 39,
      form === 'fish' ? 25 : 37,
      '#c8bafa0c',
      '#d9c6f590',
    );
  if (!cellular && traits.includes('spikes')) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.beginPath();
      c.moveTo(Math.cos(a - 0.12) * 30, Math.sin(a - 0.12) * 27);
      c.lineTo(Math.cos(a) * 48, Math.sin(a) * 43);
      c.lineTo(Math.cos(a + 0.12) * 30, Math.sin(a + 0.12) * 27);
      c.fillStyle = '#edcd9870';
      c.fill();
    }
  }
  if (!cellular && traits.includes('cilia')) {
    c.strokeStyle = '#b6f1c77a';
    c.lineWidth = 0.8;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      c.beginPath();
      c.moveTo(Math.cos(a) * 34, Math.sin(a) * 29);
      c.lineTo(Math.cos(a + 0.03) * 44, Math.sin(a + 0.03) * 39);
      c.stroke();
    }
  }
  if (!cellular && traits.includes('flagellum')) {
    c.beginPath();
    c.moveTo(-27, 0);
    c.bezierCurveTo(
      -53,
      Math.sin(t * 6) * 25,
      -74,
      -Math.sin(t * 6) * 25,
      -95,
      Math.sin(t * 6 + 1) * 16,
    );
    c.strokeStyle = '#b6f1ecaa';
    c.lineWidth = 2;
    c.stroke();
  }
  if (!cellular && traits.includes('chloroplast'))
    for (let i = 0; i < 4; i++)
      oval(c, -12 + i * 7, 7 + Math.sin(i) * 5, 3, 5, '#c5ed84bb');
  if (adaptation === 'reservoir') {
    oval(c, -10, 1, 10 * covering, 13 * covering, '#70ced5b0', '#d4fbe9');
    oval(c, -12, -3, 3 * covering, 5 * covering, '#e1ffffaa');
  } else if (adaptation === 'skin') {
    c.lineWidth = 2;
    oval(c, 0, 0, 49 * covering, 34 * covering, '#b8e4ac10', '#b8e4ac99');
  }
  if (!cellular && traits.includes('vacuole'))
    oval(c, -6, -8, 8, 6, '#edd9a933', '#edd9a9bb');
  c.restore();
}
const reefSprites = new Map<number, HTMLCanvasElement>();
export function drawReef(
  main: C,
  worldRock: { x: number; y: number; radius: number },
) {
  let tile = reefSprites.get(worldRock.radius);
  const margin = worldRock.radius * 1.6;
  if (!tile) {
    tile = document.createElement('canvas');
    tile.width = Math.ceil(margin * 2);
    tile.height = tile.width;
    const c = tile.getContext('2d');
    if (!c) return;
    const rock = { x: margin, y: margin, radius: worldRock.radius };
    glow(c, rock.x, rock.y, rock.radius * 1.5, '#b1789520');
    oval(c, rock.x + 5, rock.y + 8, rock.radius, rock.radius, '#24475955');
    oval(
      c,
      rock.x,
      rock.y,
      rock.radius,
      rock.radius,
      tissue(c, '#8892b1', margin),
      '#59697e',
    );
    for (let j = 0; j < 22; j++) {
      const a = j * 2.399,
        r = Math.sqrt((j + 0.5) / 22) * rock.radius * 0.9,
        x = rock.x + Math.cos(a) * r,
        y = rock.y + Math.sin(a) * r;
      const coral = ['#d7a2b4', '#b9ade3', '#8cd3c4'][j % 3];
      c.strokeStyle = coral;
      c.lineWidth = 5;
      c.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        c.beginPath();
        c.moveTo(x, y + 12);
        c.quadraticCurveTo(x + k * 6, y - 3, x + k * 15, y - 20 - (j % 3) * 5);
        c.stroke();
        oval(c, x + k * 15, y - 20 - (j % 3) * 5, 4, 6, coral);
      }
    }

    reefSprites.set(worldRock.radius, tile);
  }
  main.drawImage(tile, worldRock.x - margin, worldRock.y - margin);
}
export function renderOcean(
  c: C,
  w: World,
  width: number,
  height: number,
  dpr: number,
) {
  if (w.ocean?.tidal?.compat.mode === 'active') {
    renderTidal(c, w, width, height, dpr);
    return;
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = c.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0a3043');
  bg.addColorStop(0.5, '#082838');
  bg.addColorStop(1, '#071828');
  c.fillStyle = bg;
  c.fillRect(0, 0, width, height);
  const v = getView(w, width, height),
    t = w.time;
  drawDepth(c, v, t, true);
  c.save();
  c.translate(width / 2, height / 2);
  c.scale(v.zoom, v.zoom);
  c.translate(-v.cx, -v.cy);
  drawOceanLandmarks(c);
  drawMigration(c, w, v);
  for (const z of OCEAN_ZONES) {
    glow(c, z.x, z.y, z.radius * 1.55, `${z.color}18`);
    c.strokeStyle = `${z.color}36`;
    c.lineWidth = 1;
    c.setLineDash([4, 13]);
    c.beginPath();
    c.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = `${z.color}b0`;
    c.font = '14px sans-serif';
    c.textAlign = 'center';
    c.fillText(z.name, z.x, z.y - z.radius - 22);
  }
  // Drifting streaks reveal the actual field that moves the player.
  for (let i = 0; i < 360; i++) {
    const x = (i * 331.79) % OCEAN_MAP.width,
      y = (i * 719.33) % OCEAN_MAP.height;
    if (
      Math.abs(x - v.cx) > (width / v.zoom) * 0.7 ||
      Math.abs(y - v.cy) > (height / v.zoom) * 0.7
    )
      continue;
    const flow = oceanFlow({ x, y }, t);
    c.beginPath();
    c.moveTo(x + Math.sin(t * 0.4 + i) * 12, y);
    c.lineTo(
      x + flow.x * 0.4 + Math.sin(t * 0.4 + i) * 12,
      y + flow.y * 0.4 + 1,
    );
    c.strokeStyle = i % 7 === 0 ? '#aedbea35' : '#90c8d618';
    c.lineWidth = i % 7 === 0 ? 1.5 : 0.8;
    c.stroke();
  }
  // Sea grass surrounds the refuge, with a clear playable center.
  for (let i = 0; i < 65; i++) {
    const a = i * 2.399,
      r = 260 + (i % 7) * 18,
      x = 460 + Math.cos(a) * r,
      y = 1770 + Math.sin(a) * r;
    for (let j = 0; j < 3; j++) {
      c.beginPath();
      c.moveTo(x + j * 4, y);
      c.quadraticCurveTo(
        x - 13 + Math.sin(t * 1.4 + i) * 12,
        y - 28,
        x + j * 8 + Math.sin(t * 1.4 + i) * 12,
        y - 48 - (i % 4) * 8,
      );
      c.strokeStyle = ['#4b9d9266', '#5daeaa77', '#76b4a755'][j];
      c.lineWidth = 3;
      c.stroke();
    }
  }
  for (const rock of OCEAN_ROCKS) {
    if (
      Math.abs(rock.x - v.cx) > (width / v.zoom) * 0.6 + 160 ||
      Math.abs(rock.y - v.cy) > (height / v.zoom) * 0.6 + 160
    )
      continue;
    drawReef(c, rock);
  }
  for (const food of w.foods) {
    if (
      food.cooldown > 0 ||
      Math.abs(food.x - v.cx) > (width / v.zoom) * 0.65 ||
      Math.abs(food.y - v.cy) > (height / v.zoom) * 0.65
    )
      continue;
    const pulse = 1 + Math.sin(t * 3 + food.id) * 0.16;
    oval(
      c,
      food.x,
      food.y,
      food.rich ? 4.5 * pulse : 3,
      food.rich ? 3 : 3,
      food.rich ? '#d9eab6cc' : '#9be3d0bb',
    );
    if (food.rich) {
      c.strokeStyle = '#d9eab650';
      c.beginPath();
      c.moveTo(food.x - 8, food.y - 5);
      c.lineTo(food.x + 5, food.y + 4);
      c.stroke();
    }
  }
  const nearestSwimmer = [
    ...w.ocean!.shoal.filter((f) => f.cooldown === 0),
    ...w.predators.filter((e) => (e.respawn ?? 0) === 0),
  ].sort(
    (a, b) =>
      Math.hypot(a.x - w.player.x, a.y - w.player.y) -
      Math.hypot(b.x - w.player.x, b.y - w.player.y),
  )[0];
  const drawSwimmer = (e: {
    x: number;
    y: number;
    radius: number;
    angle: number;
    stun: number;
    bite?: number;
    id?: number;
  }) => {
    if (
      Math.abs(e.x - v.cx) > (width / v.zoom) * 0.6 + e.radius * 2 ||
      Math.abs(e.y - v.cy) > (height / v.zoom) * 0.6 + e.radius * 2
    )
      return;
    const relation = sizeRelation(w, e.radius),
      color =
        relation === 'prey'
          ? '#9ff0be'
          : relation === 'danger'
            ? '#ffab88'
            : '#bfc3e9';
    c.globalAlpha = e.stun > 0 ? 0.55 : 1;
    drawBody(
      c,
      'fish',
      e.x,
      e.y,
      e.radius,
      e.angle,
      t,
      [],
      relation === 'danger',
      color,
    );
    c.globalAlpha = 1;
    const d = Math.hypot(w.player.x - e.x, w.player.y - e.y);
    if (d < 240 + e.radius && e.id === nearestSwimmer?.id) {
      c.font = `${12 / v.zoom}px sans-serif`;
      c.textAlign = 'center';
      c.fillStyle = color;
      c.fillText(
        relation === 'prey'
          ? hasOrgan(w.ocean!.body, 'jaw')
            ? '＋ 对准嘴吞食'
            : '◇ 较小 · 滤食口不捕食'
          : relation === 'danger'
            ? e.id === 3
              ? '▲ 礁隙伏击者'
              : e.id === 4
                ? '▲ 护巢者 · 绕开领地'
                : '▲ 危险'
            : '◇ 体型相近',
        e.x,
        e.y - e.radius - 15 / v.zoom,
      );
    }
    if (d < 340 + e.radius && e.id !== nearestSwimmer?.id) {
      c.font = `${12 / v.zoom}px sans-serif`;
      c.textAlign = 'center';
      c.fillStyle = color;
      c.fillText(
        relation === 'danger' ? '▲' : relation === 'prey' ? '＋' : '◇',
        e.x,
        e.y - e.radius - 10 / v.zoom,
      );
    }
    if ((e.bite ?? 0) > 0) {
      c.strokeStyle = '#ff987bb0';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(
        e.x,
        e.y,
        e.radius + 13,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.min(1, e.bite! / 0.5),
      );
      c.stroke();
      c.save();
      c.translate(e.x, e.y);
      c.rotate(e.angle);
      oval(
        c,
        e.radius * 0.85,
        0,
        e.radius * 0.25,
        e.radius * 0.2,
        '#38171e',
        '#ffba9b',
      );
      c.restore();
    }
  };
  for (const f of w.ocean!.shoal) if (f.cooldown === 0) drawSwimmer(f);
  for (const e of w.predators)
    if ((e.respawn ?? 0) === 0) drawSwimmer({ ...e, radius: e.radius ?? 36 });
  const p = w.player,
    o = w.ocean!;
  for (const specimen of SPECIMENS) {
    const known = o.discovered.includes(specimen.organ);
    const sample: BodyDesign = {
      length: 1.2,
      width: 0.85,
      organs:
        specimen.organ === 'spine'
          ? { front: 'jaw', tail: 'spine' }
          : { front: 'filter' },
    };
    drawBody(
      c,
      'bilateral',
      specimen.x,
      specimen.y + Math.sin(t * 2) * 5,
      26,
      -0.3,
      t,
      [],
      false,
      '#f4d68f',
      sample,
    );
    c.strokeStyle = known ? '#a4e2c955' : '#f4d68f99';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(
      specimen.x,
      specimen.y,
      55,
      -Math.PI / 2,
      -Math.PI / 2 +
        Math.PI *
          2 *
          (known
            ? 1
            : Math.max(0.03, (o.observation[specimen.organ] ?? 0) / 2)),
    );
    c.stroke();
    c.font = '13px sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#f9e6b7';
    c.fillText(
      known ? specimen.name + ' · 已记录' : specimen.name + ' · 靠近观察 2 秒',
      specimen.x,
      specimen.y - 65,
    );
  }
  if (o.defenseFlash > 0) {
    glow(c, p.x, p.y, bodyRadius(w) * 3, '#ffe2a180');
    c.fillStyle = '#ffe4ac';
    c.textAlign = 'center';
    c.font = 'bold 17px sans-serif';
    c.fillText('长刺命中 · 设计有效', p.x, p.y - bodyRadius(w) - 30);
  }
  if (o.skillActive > 0 || p.invulnerable > 0) {
    c.strokeStyle = o.skillActive > 0 ? '#d9c7ffb0' : '#d0f4ed50';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(
      p.x,
      p.y,
      bodyRadius(w) +
        (o.skillActive > 0 && FORMS[w.form].branch === 'radial' ? 105 : 22),
      0,
      Math.PI * 2,
    );
    c.stroke();
  }
  if (o.morph) {
    const frame = evolutionFrame(w);
    const mix = Math.min(1, o.morph.elapsed / o.morph.duration);
    glow(c, p.x, p.y, 170, '#d0c4fa40');
    c.globalAlpha = frame?.parentOpacity ?? 1 - mix;
    drawBody(
      c,
      o.morph.from,
      p.x,
      p.y,
      FORMS[o.morph.from].radius * growthScale(w),
      p.angle,
      t,
      w.evolution?.before.traits ?? w.traits,
      false,
      undefined,
      w.evolution?.before.body,
    );
    c.globalAlpha = frame?.childOpacity ?? mix;
    drawBody(
      c,
      w.form,
      p.x,
      p.y,
      bodyRadius(w),
      p.angle,
      t,
      w.traits,
      false,
      undefined,
      frame?.body ?? o.body,
      undefined,
      1,
      undefined,
      frame?.formation,
    );
    c.globalAlpha = 1;
  } else
    drawBody(
      c,
      w.form,
      p.x,
      p.y,
      bodyRadius(w) * (1 + Math.sin((o.gulp / 0.38) * Math.PI) * 0.12),
      p.angle,
      t,
      w.traits,
      false,
      undefined,
      o.body,
    );
  for (const meal of o.meals) {
    const eater =
      meal.eaterId === null
        ? p
        : meal.eaterId < 100
          ? w.predators.find((e) => e.id === meal.eaterId)
          : o.shoal.find((f) => f.id === meal.eaterId);
    if (!eater) continue;
    const mix = Math.min(1, meal.elapsed / meal.duration),
      ease = 1 - (1 - mix) ** 2;
    const mouth =
      meal.eaterId === null
        ? organZones(worldBodyPose(w), 'jaw').sort(
            (a, b) =>
              Math.hypot(a.x - meal.x, a.y - meal.y) -
              Math.hypot(b.x - meal.x, b.y - meal.y),
          )[0]
        : undefined;
    const tx = mouth?.x ?? eater.x,
      ty = mouth?.y ?? eater.y;
    c.globalAlpha = 1 - mix;
    drawBody(
      c,
      'fish',
      meal.x + (tx - meal.x) * ease,
      meal.y + (ty - meal.y) * ease,
      Math.max(0.1, meal.radius * (1 - mix)),
      meal.angle + mix * 1.4,
      t,
      [],
      false,
      '#b2f5c2',
    );
    c.globalAlpha = 1;
  }
  if (o.gulp > 0) {
    for (const mouth of organZones(worldBodyPose(w), 'jaw')) {
      oval(
        c,
        mouth.x,
        mouth.y,
        mouth.radius * 0.8,
        Math.max(0.1, mouth.radius * 0.6 * Math.sin((o.gulp / 0.38) * Math.PI)),
        '#082c32',
        '#c7ffe3',
      );
    }
    c.font = `${15 / v.zoom}px sans-serif`;
    c.textAlign = 'center';
    c.fillStyle = '#c3ffda';
    c.fillText('吞食！体型 +', p.x, p.y - bodyRadius(w) - 28 / v.zoom);
  }
  c.font = `${12 / v.zoom}px sans-serif`;
  c.textAlign = 'center';
  c.fillStyle = '#d8f7ee';
  c.fillText(
    `你 · ${growthScale(w).toFixed(1)} 倍体型`,
    p.x,
    p.y + bodyRadius(w) + 25 / v.zoom,
  );
  c.strokeStyle = '#6492a44d';
  c.strokeRect(0, 0, OCEAN_MAP.width, OCEAN_MAP.height);
  c.restore();
  drawFeedback(c, w, v);
  const target = oceanTarget(w);
  const px = (p.x - v.cx) * v.zoom + width / 2,
    py = (p.y - v.cy) * v.zoom + height / 2;
  const a = Math.atan2(target.point.y - p.y, target.point.x - p.x);
  c.save();
  c.translate(px + Math.cos(a) * 104, py + Math.sin(a) * 104);
  c.rotate(a);
  c.beginPath();
  c.moveTo(9, 0);
  c.lineTo(-5, -5);
  c.lineTo(-5, 5);
  c.closePath();
  c.fillStyle = '#b4e6dcc0';
  c.fill();
  c.restore();
}

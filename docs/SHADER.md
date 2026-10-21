# Procedural shader

`pixel_shader` is a procedural pixel-art renderer modelled on
[oy-pixel](https://github.com/Fantety/oy-pixel)'s `pixel_run_shader` tool. The
host language is a **Lua subset**, not a full Lua VM; the drawing contract,
canvas semantics and animation uniforms intentionally match oy-pixel.

## Design mapping

| oy-pixel `pixel_run_shader` | `dsh-pixel-studio` `pixel_shader` |
| --- | --- |
| Lua script | Lua-subset script (no functions/metatables/host access) |
| active cel framebuffer | one framebuffer per generated frame |
| `width`, `height` | same |
| `time`, `phase`, `frame_index`, `frame_count` | same |
| `pal(i)` 1-based | same |
| `hex`, `mix`, `hsv`, `alpha` | same |
| `rand`, `noise` seeded | same, seeded per frame |
| `canvas.*` drawing API | same method set, including `stamp` |
| `animate=true` on document frames | `frameCount > 1` with `fps` |
| `~20M` instructions, 5s, changed pixels | same instruction/wall-clock budgets, plus a 10s total cap |
| errors carry script line | same |

## Language

Supported statements:

```lua
local name = value
name = value
if condition then ... elseif ... else ... end
for i = start, stop[, step] do ... end
while condition do ... end
break
canvas.pset(0, 0, pal(1))
```

Supported expressions: numbers, strings, `true`/`false`/`nil`, variables,
property access, `[key]` indexing, function calls, arithmetic, comparison,
concatenation, `and`/`or`/`not`, table constructors. No user-defined functions,
generic-for, `repeat`, metatables, `require`, or host globals.

## Globals

| Name | Meaning |
| --- | --- |
| `width`, `height` | canvas size in pixels |
| `time` | frame start time in seconds |
| `phase` | frame position in the timeline, `0..1` |
| `frame_index` | zero-based frame index |
| `frame_count` | total frames |
| `seed` | per-frame deterministic seed |

For a single frame: `time = 0`, `phase = 0`, `frame_index = 0`,
`frame_count = 1`.

## Canvas API

```text
canvas.pset(x, y, c)             canvas.pget(x, y)
canvas.line(x0, y0, x1, y1, c)
canvas.rect(x, y, w, h, c)       canvas.rectfill(x, y, w, h, c)
canvas.circle(cx, cy, r, c)      canvas.circfill(cx, cy, r, c)
canvas.ellipse(cx, cy, rx, ry, c)
canvas.ellipsefill(cx, cy, rx, ry, c)
canvas.flood(x, y, c)
canvas.replace(old, c)
canvas.outline(c)                canvas.clear(c)
canvas.stamp(rows, legend, x, y)
```

- Colours are `#RRGGBB` or `#RRGGBBAA`; `nil` erases.
- `pset`/`pget` reject out-of-bounds coordinates with an error.
- Shapes clip at the canvas edge.
- `stamp` rows must be non-empty and share one width; the grid must fit;
  every non-`.` symbol needs a legend entry.
- `flood` is 4-neighbour; `outline` adds a 4-neighbour border around opaque
  pixels.

## Helpers

```lua
pal(i)                 -- 1-based palette entry
hex('#RRGGBBAA')       -- validated colour
mix(c1, c2, t)         -- RGBA interpolation
hsv(h, s, v[, a])      -- hue degrees, s/v/a in 0..1
alpha(c, a)            -- replace alpha
rand() / rand(a, b)    -- deterministic float / integer
noise(x, y[, scale])   -- deterministic value noise
clamp(v, min, max)
step(edge, v)
smoothstep(a, b, v)
math.*                 -- abs, ceil, floor, sqrt, sin, cos, tan, atan2,
                       -- min, max, round, pi, huge, ...
string.*               -- format, len, lower, upper, sub, rep
```

`math.random` is disabled; use `rand()`.

## Example: static

```json
{
  "name": "shader-horizon",
  "width": 32,
  "height": 32,
  "palette": "studio",
  "seed": 12,
  "code": "local top = hex('#0B1026')\nlocal low = hex('#FF8A5C')\nfor y = 0, height - 1 do\n  local t = y / (height - 1)\n  for x = 0, width - 1 do canvas.pset(x, y, mix(top, low, t * t)) end\nend\ncanvas.circfill(width * 0.7, height * 0.72, 7, hex('#FFEC27'))"
}
```

## Example: animation

```json
{
  "name": "bouncing-orb",
  "width": 32,
  "height": 32,
  "palette": "sweetie16",
  "frameCount": 8,
  "fps": 12,
  "code": "canvas.clear(hex('#10121E'))\nlocal arc = math.sin(phase * math.pi)\ncanvas.circfill(width / 2, height - 6 - arc * (height - 12), 3, pal(4))\ncanvas.circfill(width / 2, height - 3, 4, alpha(pal(1), 0.35))"
}
```

Each frame is rendered with `time = index / fps`, `phase = index / frameCount`
and a derived seed. GIF, PNG, spritesheet and OYPX use the shared output
pipeline.

## Budgets and security

- 64 KiB code limit.
- 20M interpreter instructions and 5s per frame; 10s total.
- 65,536+ changed-pixel budget per frame.
- No host globals, modules, filesystem, network, `require`, `eval` or
  `Function`; dangerous table keys (`constructor`, `__proto__`, prototypes,
  `bind`/`call`/`apply`, etc.) are rejected.
- The interpreter is synchronous and tree-walking; it is deliberately not a
  general-purpose scripting environment.

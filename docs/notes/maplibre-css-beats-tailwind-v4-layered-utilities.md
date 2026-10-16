# A MapLibre container sized with Tailwind `absolute inset-0` renders at height 0 in web/

Measured 2026-10-16 in `web/` (Tailwind 4.1, maplibre-gl 5.6), on the hike-submission review map
([submission-map.tsx](../../web/src/components/hike-submissions/submission-map.tsx)).

**Symptom:** the map area is empty. In dark mode it is the same colour as the page, so it looks like
nothing rendered. Absolutely positioned overlays in the same wrapper, like the legend, still show, so
the component looks mounted and the obvious suspects are the tile URL, the MapTiler key or the style.
None of those is the cause.

**Mechanism:** `new maplibregl.Map({ container })` adds the class `maplibregl-map` to the container.
`maplibre-gl.css` gives that class `position: relative`, and it is **unlayered** CSS. Tailwind v4
emits its utilities inside `@layer utilities`, and unlayered rules win over layered ones whatever
their order or specificity. So `absolute` loses, `inset-0` positions nothing, the div collapses to
height 0, and MapLibre draws a 0-pixel canvas.

**Fix:** give the container a size that maplibre's CSS does not set: `h-full w-full` inside a parent
with an explicit height (`relative h-[620px]` here). Do not counter with `!absolute`; the explicit
size is the robust form.

The same collision hits any third-party stylesheet that sets `position`, `display` or `overflow` on
an element that Tailwind classes also style.

/**
 * Colour handling shared by the turtle engine, the UI and the CLI.
 *
 * A Logo colour is a palette index (0-15), a colour name (Logo / CSS name) or
 * an [r g b] list (0-255 each, or 0-100 percent in UCBLogo's SETPALETTE).
 */

/** A resolved colour: palette index or CSS colour string. */
export type LogoColor = number | string

/** Standard Logo colour palette (0-15), as in UCBLogo and Terrapin Logo. */
export const LOGO_COLORS: Record<number, string> = {
  0: '#000000', // black
  1: '#0000ff', // blue
  2: '#00ff00', // green
  3: '#00ffff', // cyan
  4: '#ff0000', // red
  5: '#ff00ff', // magenta
  6: '#ffff00', // yellow
  7: '#ffffff', // white
  8: '#a52a2a', // brown
  9: '#d2b48c', // tan
  10: '#228b22', // forest
  11: '#7fffd4', // aqua
  12: '#fa8072', // salmon
  13: '#800080', // purple
  14: '#ffa500', // orange
  15: '#808080', // gray
}

/** Names of the palette colours, by index. */
export const PALETTE_NAMES = [
  'BLACK', 'BLUE', 'GREEN', 'CYAN', 'RED', 'MAGENTA', 'YELLOW', 'WHITE',
  'BROWN', 'TAN', 'FOREST', 'AQUA', 'SALMON', 'PURPLE', 'ORANGE', 'GRAY',
]

/** CSS named colours (lower-case name -> hex). */
export const CSS_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4', azure: '#f0ffff',
  beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000', blanchedalmond: '#ffebcd', blue: '#0000ff',
  blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00',
  chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b', darkgray: '#a9a9a9',
  darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f',
  darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1',
  darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22', fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520', gray: '#808080',
  green: '#008000', greenyellow: '#adff2f', grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4',
  indianred: '#cd5c5c', indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080',
  lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3', lightgreen: '#90ee90', lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1', lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899',
  lightslategrey: '#778899', lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd',
  mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585', midnightblue: '#191970',
  mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
  oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500',
  orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093',
  papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd',
  powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399', red: '#ff0000', rosybrown: '#bc8f8f',
  royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57',
  seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
  slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f', steelblue: '#4682b4',
  tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347', turquoise: '#40e0d0',
  violet: '#ee82ee', wheat: '#f5deb3', white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00',
  yellowgreen: '#9acd32',
  // Logo palette names that are not CSS names.
  forest: '#228b22',
}

/** All colour names known to SETPC / SETBG (upper-case). */
export const COLOR_NAMES: string[] = Object.keys(CSS_COLORS).map((n) => n.toUpperCase())

/** Resolve a Logo colour to a CSS colour string. */
export function colorToCss(c: LogoColor): string {
  if (typeof c === 'number') {
    const idx = Math.trunc(c)
    return LOGO_COLORS[idx] ?? LOGO_COLORS[((idx % 16) + 16) % 16] ?? '#000000'
  }
  const key = c.toLowerCase()
  if (CSS_COLORS[key]) return CSS_COLORS[key]
  return c
}

/** Resolve a Logo colour to [r, g, b] (0-255). */
export function colorToRgb(c: LogoColor): [number, number, number] {
  const css = colorToCss(c)
  const hex = css.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const v = parseInt(hex[1], 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const short = css.match(/^#([0-9a-f]{3})$/i)
  if (short) {
    const [r, g, b] = short[1].split('').map((h) => parseInt(h + h, 16))
    return [r, g, b]
  }
  const rgb = css.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)
  if (rgb) return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])]
  return [0, 0, 0]
}

/** True if the word names a colour. */
export function isColorName(w: string): boolean {
  return CSS_COLORS[w.toLowerCase()] !== undefined
}

/** Build a CSS colour from an [r g b] triple (0-255). */
export function rgbToCss(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
}

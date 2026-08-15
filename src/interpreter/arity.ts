/**
 * Default arity (argument count) for every primitive procedure.
 *
 * The Logo parser needs to know how many arguments each procedure consumes so
 * it can parse a call correctly. User-defined procedures register their arity
 * when their `TO ... END` block is parsed; primitives use this table.
 *
 * For variable-arity primitives (usable as `(SUM 1 2 3)`), the value here is
 * the default arity used without parentheses; the parser reads all arguments
 * up to `)` when parentheses are present.
 */

export const PRIMITIVE_ARITY: Record<string, number> = {
  // --- Turtle graphics ---
  FORWARD: 1, FD: 1, BACK: 1, BK: 1, LEFT: 1, LT: 1, RIGHT: 1, RT: 1,
  SETXY: 2, SETPOS: 1, SETX: 1, SETY: 1, SETHEADING: 1, SETH: 1, HOME: 0,
  PENUP: 0, PU: 0, PENDOWN: 0, PD: 0, SETPENCOLOR: 1, SETPC: 1,
  SETBACKGROUND: 1, SETBG: 1, CLEARSCREEN: 0, CS: 0, CLEAN: 0,
  HIDETURTLE: 0, HT: 0, SHOWTURTLE: 0, ST: 0, ARC: 2, LABEL: 1,
  GETXY: 0, XCOR: 0, YCOR: 0, HEADING: 0, PENCOLOR: 0, PC: 0,
  BACKGROUND: 0, BG: 0, PENSIZE: 0, PENMODE: 0, WINDOW: 0, WRAP: 0,
  FENCE: 0, SETPEN: 1, SETPENSIZE: 1, SETPALETTE: 2, PALETTE: 1,
  SETSCRUNCH: 1, SCRUNCH: 0, SHOWNP: 0, TURTLEP: 0, PENDOWNP: 0,
  FILL: 0, SETLABELHEIGHT: 1, LABELSIZE: 0, SETPENPATTERN: 1,
  PENPATTERN: 0, TEXTSCREEN: 0, SPLITSCREEN: 0, FULLSCREENS: 0,
  DRAW: 0, SAVEPICT: 1, LOADPICT: 1,

  // --- Control ---
  IF: 2, IFELSE: 3, TEST: 1, IFTRUE: 1, IFFALSE: 1, REPEAT: 2,
  WHILE: 2, UNTIL: 2, 'DO.WHILE': 2, 'DO.UNTIL': 2, FOR: 4, DOTIMES: 3,
  FOREVER: 1, CATCH: 2, THROW: 1, STOP: 0, OUTPUT: 1, OP: 1, RUN: 1,
  REPCOUNT: 0, CASE: 2, GO: 1, RETURN: 1, BREAK: 0, CONTINUE: 0,

  // --- Arithmetic ---
  SUM: 2, DIFFERENCE: 2, PRODUCT: 2, QUOTIENT: 2, REMAINDER: 2,
  MODULO: 2, POWER: 2, SQRT: 1, SIN: 1, COS: 1, ARCTAN: 1, RADSIN: 1,
  RADCOS: 1, RADARCTAN: 1, INT: 1, ROUND: 1, ABS: 1, MINUS: 1, EXP: 1,
  LN: 1, LOG10: 1, RANDOM: 1, RRANDOM: 1, SEEDRANDOM: 1, LESSP: 2,
  GREATERP: 2, LESSEQUALP: 2, GREATEREQUALP: 2, EQUALP: 2, NOTEQUALP: 2,
  AND: 2, OR: 2, NOT: 1, BITAND: 2, BITOR: 2, BITXOR: 2, BITNOT: 1,
  ASHIFT: 2, LSHIFT: 2, RSHIFT: 2,

  // --- Lists ---
  FIRST: 1, LAST: 1, BUTFIRST: 1, BF: 1, BUTLAST: 1, BL: 1, ITEM: 2,
  FPUT: 2, LPUT: 2, SENTENCE: 2, SE: 2, LIST: 2, REVERSE: 1, COUNT: 1,
  MEMBERP: 2, MEMBER: 2, REMDUP: 1, PICK: 1, EMPTYP: 1, LISTP: 1,
  COMBINE: 2, FIRSTS: 1, BUTFIRSTS: 1, BUTLASTS: 1,

  // --- Words ---
  WORD: 2, CHAR: 1, ASCII: 1, LOWERCASE: 1, UPPERCASE: 1, FORM: 2,
  PARSE: 1, UNPARSE: 1, BACKSLASHEDP: 1, SUBSTRING: 2, SUBSTRINGP: 2,
  BEFOREP: 2, WORDP: 1, NUMBERP: 1,

  // --- I/O ---
  PRINT: 1, SHOW: 1, TYPE: 1, READLIST: 0, READWORD: 0, READCHAR: 0,
  OPENREAD: 1, OPENWRITE: 1, OPENAPPEND: 1, CLOSE: 1, ALLOPEN: 0,
  CLOSEALL: 0, SAVE: 1, LOAD: 1, ERASE: 1, SETREAD: 1, SETWRITE: 1,
  EOFP: 0, SETPREFIX: 1, PREFIX: 0, READPOS: 0, SETREADPOS: 1,
  SETWRITEPOS: 1, WRITEPOS: 0,

  // --- Higher-order ---
  MAP: 2, MAPSE: 2, FILTER: 2, FIND: 2, REDUCE: 2, APPLY: 2, INVOKE: 2,
  CASCADE: 3, CASCADE2: 4, FOREACH: 2, CROSSMAP: 2, TRANSFER: 2, TEXT: 1,
  DEFINE: 2, DEF: 2, COPYDEF: 2, MACROEXPAND: 1, MACROP: 1, DEFINEDP: 1,

  // --- Workspace ---
  MAKE: 2, NAME: 2, THING: 1, BURY: 1, BURIED: 1, BURIEDP: 1, BURYALL: 0,
  BURYNAME: 1, UNBURY: 1, UNBURYALL: 0, CONTENTS: 0, PROCEDUREP: 1,
  PRIMITIVEP: 1, PO: 1, POPS: 1, POT: 1, POTS: 0, PLIST: 1, ALLOWGETSET: 0,

  // --- Arrays ---
  ARRAY: 1, ARRAYTOLIST: 1, LISTTOARRAY: 1, SETITEM: 3, ARRAYDIMS: 1,
  ARRAYP: 1,

  // --- Properties ---
  GPROP: 2, PPROP: 3, REMPROP: 2, PLISTS: 0, PROPS: 1,

  // --- Misc ---
  TIME: 0, TIMEFORMAT: 1, SETTIMEFORMAT: 1, HELP: 1,
}

/** Variable-arity primitives that accept 2+ args when parenthesized. */
export const VARIABLE_ARITY: Record<string, true> = {
  SUM: true, DIFFERENCE: true, PRODUCT: true, QUOTIENT: true,
  SENTENCE: true, SE: true, LIST: true, WORD: true, FPUT: true, LPUT: true,
  AND: true, OR: true,
}

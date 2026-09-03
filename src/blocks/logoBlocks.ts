/**
 * Logo-specific Blockly block definitions and the toolbox.
 *
 * Standard Blockly blocks (control flow, logic, math, text, lists, variables,
 * procedures) are reused; these blocks add turtle graphics, pen control and
 * Logo I/O. The Logo code generator lives in ./logoGenerator.ts.
 */

import * as Blockly from 'blockly'
import { PALETTE_NAMES } from '../turtle/colors'

export const TURTLE_HUE = 160
export const PEN_HUE = 20
export const IO_HUE = 290
export const LOGO_LIST_HUE = 260

const colorOptions: [string, string][] = PALETTE_NAMES.map((n, i) => [`${n.toLowerCase()} (${i})`, String(i)])

let defined = false

/** Register the Logo blocks with Blockly (idempotent). */
export function defineLogoBlocks(): void {
  if (defined) return
  defined = true
  Blockly.defineBlocksWithJsonArray([
    // --- Turtle ---
    {
      type: 'logo_move',
      message0: 'move %1 %2',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: [['forward', 'FORWARD'], ['back', 'BACK']] },
        { type: 'input_value', name: 'DISTANCE', check: 'Number' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Move the turtle forward or back by a number of steps (FORWARD / BACK).',
    },
    {
      type: 'logo_turn',
      message0: 'turn %1 %2 degrees',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: [['right ↻', 'RIGHT'], ['left ↺', 'LEFT']] },
        { type: 'input_value', name: 'ANGLE', check: 'Number' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Turn the turtle right or left (RIGHT / LEFT).',
    },
    {
      type: 'logo_home',
      message0: 'go home',
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Move the turtle to the centre, heading up (HOME).',
    },
    {
      type: 'logo_setxy',
      message0: 'go to x %1 y %2',
      args0: [
        { type: 'input_value', name: 'X', check: 'Number' },
        { type: 'input_value', name: 'Y', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Move the turtle to a position (SETXY).',
    },
    {
      type: 'logo_setheading',
      message0: 'point in direction %1',
      args0: [{ type: 'input_value', name: 'ANGLE', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Set the heading in degrees, 0 = up (SETHEADING).',
    },
    {
      type: 'logo_arc',
      message0: 'draw arc angle %1 radius %2',
      args0: [
        { type: 'input_value', name: 'ANGLE', check: 'Number' },
        { type: 'input_value', name: 'RADIUS', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Draw an arc around the turtle (ARC).',
    },
    {
      type: 'logo_visibility',
      message0: '%1 turtle',
      args0: [{ type: 'field_dropdown', name: 'MODE', options: [['show', 'SHOWTURTLE'], ['hide', 'HIDETURTLE']] }],
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Show or hide the turtle (SHOWTURTLE / HIDETURTLE).',
    },
    {
      type: 'logo_clearscreen',
      message0: 'clear screen',
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Erase the drawing and send the turtle home (CLEARSCREEN).',
    },
    {
      type: 'logo_label',
      message0: 'write %1',
      args0: [{ type: 'input_value', name: 'TEXT' }],
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Draw text at the turtle position (LABEL).',
    },
    {
      type: 'logo_wait',
      message0: 'wait %1 ms',
      args0: [{ type: 'input_value', name: 'MS', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: TURTLE_HUE,
      tooltip: 'Pause (WAIT).',
    },
    {
      type: 'logo_query',
      message0: '%1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'WHAT',
          options: [['x position', 'XCOR'], ['y position', 'YCOR'], ['heading', 'HEADING'], ['pen colour', 'PENCOLOR'], ['repeat count', 'REPCOUNT']],
        },
      ],
      output: 'Number',
      colour: TURTLE_HUE,
      tooltip: 'The turtle position, heading, pen colour, or the current REPEAT count.',
    },
    {
      type: 'logo_towards',
      message0: 'direction to x %1 y %2',
      args0: [
        { type: 'input_value', name: 'X', check: 'Number' },
        { type: 'input_value', name: 'Y', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: TURTLE_HUE,
      tooltip: 'Heading from the turtle towards a point (TOWARDS).',
    },

    // --- Pen ---
    {
      type: 'logo_pen',
      message0: 'pen %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [['down', 'PENDOWN'], ['up', 'PENUP'], ['erase', 'PENERASE'], ['reverse', 'PENREVERSE'], ['paint', 'PENPAINT']],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Lift or lower the pen, or change how it draws.',
    },
    {
      type: 'logo_setpencolor',
      message0: 'set pen colour %1',
      args0: [{ type: 'field_dropdown', name: 'COLOR', options: colorOptions }],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Choose one of the 16 Logo colours (SETPENCOLOR).',
    },
    {
      type: 'logo_setpencolor_value',
      message0: 'set pen colour to %1',
      args0: [{ type: 'input_value', name: 'COLOR' }],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Set the pen colour from a number 0-15, a colour name, or an [r g b] list.',
    },
    {
      type: 'logo_rgb',
      message0: 'colour r %1 g %2 b %3',
      args0: [
        { type: 'input_value', name: 'R', check: 'Number' },
        { type: 'input_value', name: 'G', check: 'Number' },
        { type: 'input_value', name: 'B', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Array',
      colour: PEN_HUE,
      tooltip: 'An [r g b] colour, each 0-255.',
    },
    {
      type: 'logo_setbackground',
      message0: 'set background %1',
      args0: [{ type: 'field_dropdown', name: 'COLOR', options: colorOptions }],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Set the background colour (SETBACKGROUND).',
    },
    {
      type: 'logo_setpensize',
      message0: 'set pen width %1',
      args0: [{ type: 'input_value', name: 'SIZE', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Set the line width (SETPENSIZE).',
    },
    {
      type: 'logo_stamp',
      message0: 'stamp %1 width %2 height %3 filled %4',
      args0: [
        { type: 'field_dropdown', name: 'SHAPE', options: [['oval', 'STAMPOVAL'], ['rectangle', 'STAMPRECT']] },
        { type: 'input_value', name: 'W', check: 'Number' },
        { type: 'input_value', name: 'H', check: 'Number' },
        { type: 'field_checkbox', name: 'FILLED', checked: false },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Draw an oval or rectangle centred on the turtle (STAMPOVAL / STAMPRECT).',
    },
    {
      type: 'logo_dot',
      message0: 'draw dot size %1',
      args0: [{ type: 'input_value', name: 'SIZE', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Draw a dot at the turtle position (DOT).',
    },

    // --- I/O ---
    {
      type: 'logo_print',
      message0: '%1 %2',
      args0: [
        { type: 'field_dropdown', name: 'MODE', options: [['print', 'PRINT'], ['show', 'SHOW'], ['type', 'TYPE']] },
        { type: 'input_value', name: 'VALUE' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: IO_HUE,
      tooltip: 'Write a value to the text output. PRINT strips outer brackets, SHOW keeps them, TYPE adds no newline.',
    },
    {
      type: 'logo_cleartext',
      message0: 'clear text',
      previousStatement: null,
      nextStatement: null,
      colour: IO_HUE,
      tooltip: 'Clear the text output (CLEARTEXT).',
    },
    {
      type: 'logo_read',
      message0: 'ask for %1',
      args0: [{ type: 'field_dropdown', name: 'MODE', options: [['a word', 'READWORD'], ['a list', 'READLIST'], ['a line', 'READ']] }],
      output: null,
      colour: IO_HUE,
      tooltip: 'Read input typed by the user.',
    },
    {
      type: 'logo_stop',
      message0: 'stop this procedure',
      previousStatement: null,
      colour: 120,
      tooltip: 'Leave the current procedure (STOP).',
    },
    {
      type: 'logo_word',
      message0: 'word %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'hello' }],
      output: 'String',
      colour: IO_HUE,
      tooltip: 'A Logo word ("hello).',
    },

    // --- Lists ---
    {
      type: 'logo_list_part',
      message0: '%1 of %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PART',
          options: [['first', 'FIRST'], ['last', 'LAST'], ['all but first', 'BUTFIRST'], ['all but last', 'BUTLAST']],
        },
        { type: 'input_value', name: 'LIST' },
      ],
      output: null,
      colour: LOGO_LIST_HUE,
      tooltip: 'FIRST / LAST / BUTFIRST / BUTLAST of a list or word.',
    },
    {
      type: 'logo_list_add',
      message0: 'put %1 at %2 of %3',
      args0: [
        { type: 'input_value', name: 'ITEM' },
        { type: 'field_dropdown', name: 'WHERE', options: [['front', 'FPUT'], ['end', 'LPUT']] },
        { type: 'input_value', name: 'LIST' },
      ],
      inputsInline: true,
      output: 'Array',
      colour: LOGO_LIST_HUE,
      tooltip: 'A new list with the item added (FPUT / LPUT).',
    },
    {
      type: 'logo_pick',
      message0: 'random item of %1',
      args0: [{ type: 'input_value', name: 'LIST' }],
      output: null,
      colour: LOGO_LIST_HUE,
      tooltip: 'A random member of a list (PICK).',
    },
    {
      type: 'logo_sentence',
      message0: 'sentence %1 %2',
      args0: [
        { type: 'input_value', name: 'A' },
        { type: 'input_value', name: 'B' },
      ],
      inputsInline: true,
      output: 'Array',
      colour: LOGO_LIST_HUE,
      tooltip: 'Join two words or lists into one flat list (SENTENCE).',
    },
    {
      type: 'logo_run',
      message0: 'run %1',
      args0: [{ type: 'input_value', name: 'LIST' }],
      previousStatement: null,
      nextStatement: null,
      colour: LOGO_LIST_HUE,
      tooltip: 'Run a list as Logo instructions (RUN).',
    },
  ])
}

/** Shadow number helper for toolbox entries. */
const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } })
const txt = (t: string) => ({ shadow: { type: 'logo_word', fields: { TEXT: t } } })

/** The block palette shown next to the workspace. */
export const LOGO_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Turtle',
      colour: String(TURTLE_HUE),
      contents: [
        { kind: 'block', type: 'logo_move', inputs: { DISTANCE: num(100) } },
        { kind: 'block', type: 'logo_turn', inputs: { ANGLE: num(90) } },
        { kind: 'block', type: 'logo_home' },
        { kind: 'block', type: 'logo_setxy', inputs: { X: num(0), Y: num(0) } },
        { kind: 'block', type: 'logo_setheading', inputs: { ANGLE: num(0) } },
        { kind: 'block', type: 'logo_arc', inputs: { ANGLE: num(360), RADIUS: num(50) } },
        { kind: 'block', type: 'logo_visibility' },
        { kind: 'block', type: 'logo_clearscreen' },
        { kind: 'block', type: 'logo_label', inputs: { TEXT: txt('hello') } },
        { kind: 'block', type: 'logo_wait', inputs: { MS: num(500) } },
        { kind: 'block', type: 'logo_query' },
        { kind: 'block', type: 'logo_towards', inputs: { X: num(0), Y: num(0) } },
      ],
    },
    {
      kind: 'category',
      name: 'Pen',
      colour: String(PEN_HUE),
      contents: [
        { kind: 'block', type: 'logo_pen' },
        { kind: 'block', type: 'logo_setpencolor', fields: { COLOR: '4' } },
        { kind: 'block', type: 'logo_setpencolor_value', inputs: { COLOR: { shadow: { type: 'logo_rgb', inputs: { R: num(255), G: num(128), B: num(0) } } } } },
        { kind: 'block', type: 'logo_rgb', inputs: { R: num(255), G: num(128), B: num(0) } },
        { kind: 'block', type: 'logo_setbackground', fields: { COLOR: '7' } },
        { kind: 'block', type: 'logo_setpensize', inputs: { SIZE: num(3) } },
        { kind: 'block', type: 'logo_stamp', inputs: { W: num(60), H: num(40) } },
        { kind: 'block', type: 'logo_dot', inputs: { SIZE: num(10) } },
      ],
    },
    {
      kind: 'category',
      name: 'Control',
      colour: '120',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: num(4) } },
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'controls_whileUntil' },
        {
          kind: 'block',
          type: 'controls_for',
          fields: { VAR: { name: 'i' } },
          inputs: { FROM: num(1), TO: num(10), BY: num(1) },
        },
        { kind: 'block', type: 'logo_stop' },
        { kind: 'block', type: 'logo_run' },
      ],
    },
    {
      kind: 'category',
      name: 'Logic',
      colour: '210',
      contents: [
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '230',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: num(1), B: num(1) } },
        { kind: 'block', type: 'math_single', inputs: { NUM: num(9) } },
        { kind: 'block', type: 'math_trig', inputs: { NUM: num(45) } },
        { kind: 'block', type: 'math_constant' },
        { kind: 'block', type: 'math_round', inputs: { NUM: num(3.1) } },
        { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: num(64), DIVISOR: num(10) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: num(1), TO: num(100) } },
        { kind: 'block', type: 'math_random_float' },
      ],
    },
    {
      kind: 'category',
      name: 'Words & Lists',
      colour: String(LOGO_LIST_HUE),
      contents: [
        { kind: 'block', type: 'logo_word' },
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length', inputs: { VALUE: txt('abc') } },
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'logo_list_part' },
        { kind: 'block', type: 'logo_list_add' },
        { kind: 'block', type: 'logo_sentence' },
        { kind: 'block', type: 'logo_pick' },
      ],
    },
    {
      kind: 'category',
      name: 'Text output',
      colour: String(IO_HUE),
      contents: [
        { kind: 'block', type: 'logo_print', inputs: { VALUE: txt('hello') } },
        { kind: 'block', type: 'logo_cleartext' },
        { kind: 'block', type: 'logo_read' },
      ],
    },
    { kind: 'sep' },
    { kind: 'category', name: 'Variables', colour: '330', custom: 'VARIABLE' },
    { kind: 'category', name: 'Procedures', colour: '290', custom: 'PROCEDURE' },
  ],
}

/** A starter program: a colourful square spiral. */
export const STARTER_WORKSPACE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'logo_clearscreen',
        x: 40,
        y: 40,
        next: {
          block: {
            type: 'logo_setpensize',
            inputs: { SIZE: { shadow: { type: 'math_number', fields: { NUM: 2 } } } },
            next: {
              block: {
                type: 'controls_repeat_ext',
                inputs: {
                  TIMES: { shadow: { type: 'math_number', fields: { NUM: 36 } } },
                  DO: {
                    block: {
                      type: 'logo_setpencolor_value',
                      inputs: { COLOR: { block: { type: 'logo_query', fields: { WHAT: 'REPCOUNT' } } } },
                      next: {
                        block: {
                          type: 'logo_move',
                          fields: { DIR: 'FORWARD' },
                          inputs: { DISTANCE: { block: { type: 'math_arithmetic', fields: { OP: 'MULTIPLY' }, inputs: { A: { block: { type: 'logo_query', fields: { WHAT: 'REPCOUNT' } } }, B: { shadow: { type: 'math_number', fields: { NUM: 6 } } } } } } },
                          next: {
                            block: {
                              type: 'logo_turn',
                              fields: { DIR: 'RIGHT' },
                              inputs: { ANGLE: { shadow: { type: 'math_number', fields: { NUM: 91 } } } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
}

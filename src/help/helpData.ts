/** Searchable help for the browser's Help panel and HELP primitive. */

export interface HelpEntry {
  name: string
  aliases: string[]
  category: string
  description: string
  example?: string
}

export const HELP_DATA: HelpEntry[] = [
  { name: 'FORWARD', aliases: ['FD'], category: 'Turtle', description: 'Move the turtle forward by the given distance.', example: 'FD 100' },
  { name: 'BACK', aliases: ['BK'], category: 'Turtle', description: 'Move the turtle backward by the given distance.', example: 'BK 50' },
  { name: 'RIGHT', aliases: ['RT'], category: 'Turtle', description: 'Turn the turtle clockwise by the given degrees.', example: 'RT 90' },
  { name: 'LEFT', aliases: ['LT'], category: 'Turtle', description: 'Turn the turtle counterclockwise by the given degrees.', example: 'LT 45' },
  { name: 'SETXY', aliases: [], category: 'Turtle', description: 'Move the turtle to an absolute x,y position.', example: 'SETXY 50 50' },
  { name: 'HOME', aliases: [], category: 'Turtle', description: 'Move the turtle to the center facing up.', example: 'HOME' },
  { name: 'PENUP', aliases: ['PU'], category: 'Turtle', description: 'Lift the pen so movement does not draw.', example: 'PU' },
  { name: 'PENDOWN', aliases: ['PD'], category: 'Turtle', description: 'Lower the pen so movement draws.', example: 'PD' },
  { name: 'SETPENCOLOR', aliases: ['SETPC'], category: 'Turtle', description: 'Set the pen color using the Logo palette (0-15).', example: 'SETPC 4' },
  { name: 'CLEARSCREEN', aliases: ['CS'], category: 'Turtle', description: 'Clear the drawing and return the turtle home.', example: 'CS' },
  { name: 'CLEAN', aliases: [], category: 'Turtle', description: 'Clear the drawing without moving the turtle.', example: 'CLEAN' },
  { name: 'ARC', aliases: [], category: 'Turtle', description: 'Draw an arc with angle and radius.', example: 'ARC 180 50' },
  { name: 'LABEL', aliases: [], category: 'Turtle', description: 'Draw a word at the turtle position.', example: 'LABEL [HELLO]' },
  { name: 'SUM', aliases: [], category: 'Arithmetic', description: 'Add two or more numbers.', example: 'SUM 2 3' },
  { name: 'DIFFERENCE', aliases: [], category: 'Arithmetic', description: 'Subtract the second number from the first.', example: 'DIFFERENCE 10 3' },
  { name: 'PRODUCT', aliases: [], category: 'Arithmetic', description: 'Multiply two or more numbers.', example: 'PRODUCT 4 5' },
  { name: 'QUOTIENT', aliases: [], category: 'Arithmetic', description: 'Divide numbers from left to right.', example: 'QUOTIENT 10 2' },
  { name: 'REMAINDER', aliases: [], category: 'Arithmetic', description: 'Return the integer remainder.', example: 'REMAINDER 7 3' },
  { name: 'SQRT', aliases: [], category: 'Arithmetic', description: 'Return the square root.', example: 'SQRT 16' },
  { name: 'POWER', aliases: [], category: 'Arithmetic', description: 'Raise a number to a power.', example: 'POWER 2 8' },
  { name: 'RANDOM', aliases: [], category: 'Arithmetic', description: 'Return a random integer from 0 up to the bound.', example: 'RANDOM 10' },
  { name: 'EQUALP', aliases: [], category: 'Predicates', description: 'Test whether two Logo values are equal.', example: 'EQUALP 2 2' },
  { name: 'LESSP', aliases: [], category: 'Predicates', description: 'Test whether the first number is less than the second.', example: 'LESSP 2 3' },
  { name: 'NOT', aliases: [], category: 'Predicates', description: 'Logical negation.', example: 'NOT TRUE' },
  { name: 'FIRST', aliases: [], category: 'Lists', description: 'Return the first item or character.', example: 'FIRST [A B C]' },
  { name: 'LAST', aliases: [], category: 'Lists', description: 'Return the last item or character.', example: 'LAST [A B C]' },
  { name: 'BUTFIRST', aliases: ['BF'], category: 'Lists', description: 'Return all but the first item or character.', example: 'BF [A B C]' },
  { name: 'BUTLAST', aliases: ['BL'], category: 'Lists', description: 'Return all but the last item or character.', example: 'BL [A B C]' },
  { name: 'SENTENCE', aliases: ['SE'], category: 'Lists', description: 'Combine inputs into a flat list.', example: 'SE [A B] [C D]' },
  { name: 'LIST', aliases: [], category: 'Lists', description: 'Create a list from its inputs.', example: 'LIST "A "B' },
  { name: 'ITEM', aliases: [], category: 'Lists', description: 'Return the item at a one-based index.', example: 'ITEM 2 [A B C]' },
  { name: 'MEMBERP', aliases: [], category: 'Lists', description: 'Test whether an item is a member of a sequence.', example: 'MEMBERP "B [A B C]' },
  { name: 'REVERSE', aliases: [], category: 'Lists', description: 'Reverse a word or list.', example: 'REVERSE [A B C]' },
  { name: 'WORD', aliases: [], category: 'Words', description: 'Concatenate inputs into one word.', example: 'WORD "HEL "LO' },
  { name: 'CHAR', aliases: [], category: 'Words', description: 'Return the character for an ASCII code.', example: 'CHAR 65' },
  { name: 'ASCII', aliases: [], category: 'Words', description: 'Return the ASCII code for the first character.', example: 'ASCII "A' },
  { name: 'LOWERCASE', aliases: [], category: 'Words', description: 'Convert a word to lowercase.', example: 'LOWERCASE "HELLO' },
  { name: 'UPPERCASE', aliases: [], category: 'Words', description: 'Convert a word to uppercase.', example: 'UPPERCASE "hello' },
  { name: 'PRINT', aliases: [], category: 'I/O', description: 'Print a value followed by a newline.', example: 'PRINT [HELLO WORLD]' },
  { name: 'SHOW', aliases: [], category: 'I/O', description: 'Print a value in Logo-readable form.', example: 'SHOW [HELLO WORLD]' },
  { name: 'TYPE', aliases: [], category: 'I/O', description: 'Print a value without a newline.', example: 'TYPE "HELLO' },
  { name: 'REPEAT', aliases: [], category: 'Control', description: 'Repeat an instruction list a number of times.', example: 'REPEAT 4 [FD 100 RT 90]' },
  { name: 'IF', aliases: [], category: 'Control', description: 'Run an instruction list when a condition is true.', example: 'IF :X > 0 [PRINT [POSITIVE]]' },
  { name: 'IFELSE', aliases: [], category: 'Control', description: 'Choose between two instruction lists.', example: 'IFELSE :X > 0 [PRINT [YES]] [PRINT [NO]]' },
  { name: 'WHILE', aliases: [], category: 'Control', description: 'Repeat while a condition is true.', example: 'WHILE :X < 10 [MAKE "X SUM :X 1]' },
  { name: 'RUN', aliases: [], category: 'Control', description: 'Run a list of instructions or a word containing code.', example: 'RUN [PRINT 2 + 2]' },
  { name: 'TO', aliases: [], category: 'Workspace', description: 'Define a named procedure; terminate with END.', example: 'TO SQUARE :N REPEAT 4 [FD :N RT 90] END' },
  { name: 'MAKE', aliases: [], category: 'Workspace', description: 'Set a named variable to a value.', example: 'MAKE "X 10' },
  { name: 'THING', aliases: [], category: 'Workspace', description: 'Return the value of a named variable.', example: 'THING "X' },
  { name: 'ARRAY', aliases: [], category: 'Arrays', description: 'Create a mutable array.', example: 'ARRAY 10' },
  { name: 'GPROP', aliases: [], category: 'Properties', description: 'Get a property from a property list.', example: 'GPROP "PERSON "NAME' },
  { name: 'PPROP', aliases: [], category: 'Properties', description: 'Set a property on a property list.', example: 'PPROP "PERSON "NAME "ADA' },
]

export function findHelp(query: string): HelpEntry[] {
  const q = query.toUpperCase()
  return HELP_DATA.filter((entry) => entry.name.includes(q) || entry.aliases.some((a) => a.includes(q)) || entry.description.toUpperCase().includes(q))
}

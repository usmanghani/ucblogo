/**
 * The Logo course. This file is plain data shared by the page (the lesson path) and
 * the agent (its teaching brief), so the two can never drift apart.
 */
export interface Lesson {
  id: string
  title: string
  /** One line for the student. */
  blurb: string
  /** What the student should be able to do afterwards. Written for the teacher. */
  goal: string
  /** New words this lesson introduces. */
  commands: string[]
  /** A small program the teacher can start from. */
  starter: string
  /** The exercise that proves the idea has landed. */
  challenge: string
}

export const lessons: Lesson[] = [
  {
    id: 'meet-the-turtle',
    title: 'Meet the turtle',
    blurb: 'Move, turn, and draw your first line.',
    goal: 'Understand that the turtle has a position and a heading, and that FORWARD draws while RIGHT and LEFT only turn.',
    commands: ['FORWARD (FD)', 'BACK (BK)', 'RIGHT (RT)', 'LEFT (LT)', 'CLEARSCREEN (CS)'],
    starter: 'CS\nFD 100\nRT 90\nFD 100',
    challenge: 'Draw a square by hand: four sides, four turns.',
  },
  {
    id: 'repeat',
    title: 'Say it once: REPEAT',
    blurb: 'Let the turtle do the boring part.',
    goal: 'Replace copied commands with REPEAT, and discover that the turns of a closed shape add up to 360.',
    commands: ['REPEAT'],
    starter: 'CS\nREPEAT 4 [FD 100 RT 90]',
    challenge: 'Draw a triangle, then a hexagon. What angle does each one need?',
  },
  {
    id: 'pen-and-color',
    title: 'Pen and color',
    blurb: 'Lift the pen, change color, draw thicker.',
    goal: 'Move without drawing using PENUP, and style lines with SETPENCOLOR and SETPENSIZE.',
    commands: ['PENUP (PU)', 'PENDOWN (PD)', 'SETPENCOLOR (SETPC)', 'SETPENSIZE', 'HIDETURTLE (HT)'],
    starter: 'CS\nSETPC 4\nSETPENSIZE 3\nREPEAT 4 [FD 60 RT 90]\nPU RT 90 FD 100 LT 90 PD\nSETPC 1\nREPEAT 4 [FD 60 RT 90]',
    challenge: 'Draw three squares in a row, each a different color, without a line joining them.',
  },
  {
    id: 'procedures',
    title: 'Teach a new word',
    blurb: 'Write your own commands with TO … END.',
    goal: 'Define a procedure, call it, and reuse it to build a bigger picture.',
    commands: ['TO', 'END'],
    starter: 'TO square\n  REPEAT 4 [FD 80 RT 90]\nEND\n\nCS\nsquare',
    challenge: 'Write TRIANGLE, then use SQUARE and TRIANGLE together to draw a house.',
  },
  {
    id: 'inputs',
    title: 'Words that take inputs',
    blurb: 'One procedure, any size.',
    goal: 'Give a procedure an input with :name and call it with different values.',
    commands: [':name inputs', 'arithmetic (+ - * /)'],
    starter: 'TO square :size\n  REPEAT 4 [FD :size RT 90]\nEND\n\nCS\nsquare 40\nsquare 80\nsquare 120',
    challenge: 'Write POLYGON :sides :size that draws any regular polygon. Hint: the turn is 360 / :sides.',
  },
  {
    id: 'variables',
    title: 'Remembering things',
    blurb: 'Store a value with MAKE and change it as you go.',
    goal: 'Create and update a variable with MAKE, read it with a colon, and print values to check your thinking.',
    commands: ['MAKE', 'PRINT', 'RANDOM'],
    starter: 'CS\nMAKE "side 10\nREPEAT 20 [FD :side RT 90 MAKE "side :side + 10]\nPRINT :side',
    challenge: 'Change the growing spiral so it turns 91 degrees, then try making the step grow faster.',
  },
  {
    id: 'decisions',
    title: 'Making decisions',
    blurb: 'Do different things with IF and IFELSE.',
    goal: 'Compare values and branch with IF and IFELSE.',
    commands: ['IF', 'IFELSE', '< > =', 'REPCOUNT'],
    starter: 'CS\nREPEAT 12 [\n  IFELSE (REMAINDER REPCOUNT 2) = 0 [SETPC 4] [SETPC 1]\n  FD 60 BK 60 RT 30\n]',
    challenge: 'Draw a row of 6 squares where every third square is green.',
  },
  {
    id: 'recursion',
    title: 'A procedure that calls itself',
    blurb: 'Spirals and trees from one short idea.',
    goal: 'Write a recursive procedure with a stopping rule, and explain why the rule is needed.',
    commands: ['STOP', 'recursion'],
    starter: 'TO spiral :size\n  IF :size > 200 [STOP]\n  FD :size RT 91\n  spiral :size + 4\nEND\n\nCS\nspiral 4',
    challenge: 'Write TREE :size that draws a branch, then two smaller trees, and stops when the branch is tiny.',
  },
]

export const lessonById = (id: string | undefined | null): Lesson | undefined => lessons.find(lesson => lesson.id === id)

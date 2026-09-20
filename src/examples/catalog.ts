import farm from '../../examples/farm.lgo?raw'
import rocket from '../../examples/rocket.lgo?raw'
import soccer from '../../examples/soccer.lgo?raw'
import cat from '../../examples/cat.lgo?raw'

// Import the source files directly so the menu and downloadable examples stay identical.
export const examples = [
  { id: 'cat', title: 'Cat with whiskers', source: cat },
  { id: 'farm', title: 'Farm', source: farm },
  { id: 'rocket', title: 'Rocket ship', source: rocket },
  { id: 'soccer', title: 'Soccer ball', source: soccer },
] as const
export type Example = typeof examples[number]

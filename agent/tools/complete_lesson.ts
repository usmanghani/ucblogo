import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { lessons } from '../../src/teacher/lessons'

export default defineTool({
  description: "Record that the student has met a lesson's goal. Call it only after they completed the lesson's challenge or clearly showed they can.",
  inputSchema: z.object({
    lesson_id: z.enum(lessons.map(lesson => lesson.id) as [string, ...string[]]).describe('The id of the finished lesson.'),
  }),
  label: { start: () => 'Marking the lesson complete', complete: () => 'Lesson complete' },
  execute({ lesson_id }) {
    const index = lessons.findIndex(lesson => lesson.id === lesson_id)
    const next = lessons[index + 1]
    return { completed: lesson_id, next: next ? { id: next.id, title: next.title } : null }
  },
})

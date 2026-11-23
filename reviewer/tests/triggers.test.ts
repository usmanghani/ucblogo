import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isTrusted, reviewCommand, shouldReviewComment, shouldReviewPullRequest } from '../agent/lib/triggers.ts'

const pr = (over: Record<string, unknown> = {}) => ({ draft: false, author_association: 'OWNER', user: { type: 'User' }, ...over })

test('only owners, members and collaborators are trusted', () => {
  for (const who of ['OWNER', 'MEMBER', 'COLLABORATOR']) assert.equal(isTrusted(who), true)
  for (const who of ['CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'NONE', '', undefined, 5]) assert.equal(isTrusted(who), false)
})

test('/review is a command only at the start of a line', () => {
  assert.equal(reviewCommand('/review'), '')
  assert.equal(reviewCommand('  /Review  '), '')
  assert.equal(reviewCommand('/review the auth changes'), 'the auth changes')
  assert.equal(reviewCommand('thanks!\n/review security\nmore'), 'security')
  assert.equal(reviewCommand('please do not /review this yet'), null)
  assert.equal(reviewCommand('/reviewer'), null)
  assert.equal(reviewCommand('see docs/review.md'), null)
  assert.equal(reviewCommand(''), null)
})

test('a pull request is reviewed when a trusted author opens it or marks it ready', () => {
  for (const action of ['opened', 'ready_for_review', 'reopened']) assert.equal(shouldReviewPullRequest(action, pr()), true)
  for (const action of ['synchronize', 'edited', 'closed', 'labeled']) assert.equal(shouldReviewPullRequest(action, pr()), false)
})

test('drafts, bots and outside authors do not start a review', () => {
  assert.equal(shouldReviewPullRequest('opened', pr({ draft: true })), false)
  assert.equal(shouldReviewPullRequest('opened', pr({ user: { type: 'Bot' } })), false)
  assert.equal(shouldReviewPullRequest('opened', pr({ author_association: 'NONE' })), false)
  assert.equal(shouldReviewPullRequest('opened', {}), false)
})

test('/review starts a review only from a trusted person on a pull request', () => {
  const comment = { author_association: 'COLLABORATOR', user: { type: 'User' } }
  assert.equal(shouldReviewComment('/review', comment, true), true)
  assert.equal(shouldReviewComment('/review', comment, false), false)
  assert.equal(shouldReviewComment('looks fine', comment, true), false)
  assert.equal(shouldReviewComment('/review', { ...comment, author_association: 'NONE' }, true), false)
  assert.equal(shouldReviewComment('/review', { ...comment, user: { type: 'Bot' } }, true), false)
})

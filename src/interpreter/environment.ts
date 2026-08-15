/**
 * Logo environment with dynamic scoping.
 *
 * Logo uses dynamic scoping: a variable is looked up by walking the call stack,
 * not the lexical structure. Each procedure call creates a new Environment whose
 * parent is the caller's environment. Variable lookup walks up the chain.
 *
 * Procedures and property lists are stored globally (they are not scoped).
 */

import type { LogoProc, LogoValue } from './types'
import { LogoError } from './errors'

export class Environment {
  /** Local variable bindings for this frame. */
  private vars = new Map<string, LogoValue>()
  /** Parent environment (the caller's frame). */
  parent: Environment | null

  /** Global procedure store (shared across all frames). */
  private static procs = new Map<string, LogoProc>()
  /** Global property-list store. */
  private static props = new Map<string, Map<string, LogoValue>>()
  /** Buried names (variables/procedures hidden from CONTENTS). */
  private static buried = new Set<string>()

  constructor(parent: Environment | null = null) {
    this.parent = parent
  }

  /** Create a fresh global environment. */
  static global(): Environment {
    return new Environment(null)
  }

  // --- Variable bindings (dynamic scoping) ---

  set(name: string, value: LogoValue): void {
    this.vars.set(name, value)
  }

  get(name: string): LogoValue {
    let env: Environment | null = this
    while (env) {
      if (env.vars.has(name)) return env.vars.get(name)!
      env = env.parent
    }
    throw new LogoError(`${name} has no value`, 'NO_HOW')
  }

  has(name: string): boolean {
    let env: Environment | null = this
    while (env) {
      if (env.vars.has(name)) return true
      env = env.parent
    }
    return false
  }

  /** Set a variable in the global (root) environment. */
  setGlobal(name: string, value: LogoValue): void {
    let env: Environment | null = this
    while (env.parent) env = env.parent
    env.vars.set(name, value)
  }

  /** Erase a variable binding (from the frame that defines it). */
  erase(name: string): void {
    let env: Environment | null = this
    while (env) {
      if (env.vars.has(name)) {
        env.vars.delete(name)
        return
      }
      env = env.parent
    }
  }

  // --- Procedure storage (global) ---

  static setProc(name: string, proc: LogoProc): void {
    Environment.procs.set(name.toUpperCase(), proc)
  }

  static getProc(name: string): LogoProc | undefined {
    return Environment.procs.get(name.toUpperCase())
  }

  static hasProc(name: string): boolean {
    return Environment.procs.has(name.toUpperCase())
  }

  static eraseProc(name: string): void {
    Environment.procs.delete(name.toUpperCase())
  }

  static allProcs(): LogoProc[] {
    return Array.from(Environment.procs.values())
  }

  static clearProcs(): void {
    Environment.procs.clear()
  }

  // --- Property lists (global) ---

  static getProp(plist: string, prop: string): LogoValue {
    const pl = Environment.props.get(plist.toUpperCase())
    if (!pl) return ''
    return pl.get(prop.toUpperCase()) ?? ''
  }

  static setProp(plist: string, prop: string, value: LogoValue): void {
    const key = plist.toUpperCase()
    let pl = Environment.props.get(key)
    if (!pl) {
      pl = new Map()
      Environment.props.set(key, pl)
    }
    pl.set(prop.toUpperCase(), value)
  }

  static remProp(plist: string, prop: string): void {
    const pl = Environment.props.get(plist.toUpperCase())
    if (pl) pl.delete(prop.toUpperCase())
  }

  static propNames(plist: string): string[] {
    const pl = Environment.props.get(plist.toUpperCase())
    return pl ? Array.from(pl.keys()) : []
  }

  static allProps(): string[] {
    return Array.from(Environment.props.keys())
  }

  static clearProps(): void {
    Environment.props.clear()
  }

  // --- Bury tracking ---

  static bury(name: string): void {
    Environment.buried.add(name.toUpperCase())
  }

  static unbury(name: string): void {
    Environment.buried.delete(name.toUpperCase())
  }

  static isBuried(name: string): boolean {
    return Environment.buried.has(name.toUpperCase())
  }

  static buriedNames(): string[] {
    return Array.from(Environment.buried)
  }

  static clearBuried(): void {
    Environment.buried.clear()
  }
}

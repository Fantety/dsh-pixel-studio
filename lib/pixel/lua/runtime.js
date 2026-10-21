/**
 * Tree-walking interpreter for the pixel_shader Lua subset. It is deliberately
 * synchronous and bounded: every statement and expression consumes an
 * instruction, and wall-clock time is checked periodically. There is no access
 * to Node globals, modules, or user-defined functions.
 */

export class LuaRuntimeError extends Error {
  constructor(message, line = 1) {
    super(message);
    this.name = 'LuaRuntimeError';
    this.line = line;
  }
}

class BreakSignal extends Error {}

const BREAK = new BreakSignal('break');
const FORBIDDEN_KEYS = new Set([
  'constructor', '__proto__', 'prototype', 'caller', 'callee', 'arguments',
  'bind', 'call', 'apply', 'eval', 'Function',
]);
const CANVAS_API = new Set([
  'pset', 'pget', 'line', 'rect', 'rectfill', 'circle', 'circfill',
  'ellipse', 'ellipsefill', 'flood', 'replace', 'outline', 'clear', 'stamp',
]);

class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.values = new Map();
  }

  declare(name, value) {
    this.values.set(name, value);
  }

  find(name) {
    for (let scope = this; scope !== null; scope = scope.parent) {
      if (scope.values.has(name)) return scope;
    }
    return null;
  }

  get(name, line) {
    const owner = this.find(name);
    if (owner === null) throw new LuaRuntimeError(`unknown variable '${name}'`, line);
    return owner.values.get(name);
  }

  assign(name, value, line) {
    const owner = this.find(name);
    if (owner === null) {
      let root = this;
      while (root.parent !== null) root = root.parent;
      root.values.set(name, value);
      return;
    }
    owner.values.set(name, value);
  }
}

function typeName(value) {
  if (value === null) return 'nil';
  if (Array.isArray(value)) return 'table';
  if (typeof value === 'object') return 'table';
  return typeof value;
}

function requireNumber(value, line, what = 'value') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LuaRuntimeError(`${what} must be a finite number, got ${typeName(value)}`, line);
  }
  return value;
}

function toConcatString(value, line) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new LuaRuntimeError('cannot concatenate a non-finite number', line);
    return Number.isInteger(value) ? String(value) : String(value);
  }
  throw new LuaRuntimeError(`cannot concatenate ${typeName(value)}`, line);
}

function truthy(value) {
  return value !== null && value !== false;
}

class Interpreter {
  constructor(globals, limits) {
    this.globals = globals;
    this.limits = {
      maxInstructions: limits?.maxInstructions ?? 5_000_000,
      maxMilliseconds: limits?.maxMilliseconds ?? 5_000,
    };
    this.instructions = 0;
    this.startedAt = Date.now();
  }

  tick(line) {
    this.instructions += 1;
    if (this.instructions > this.limits.maxInstructions) {
      throw new LuaRuntimeError(`shader exceeded its instruction budget of ${this.limits.maxInstructions}`, line);
    }
    if ((this.instructions & 0xfff) === 0 && Date.now() - this.startedAt > this.limits.maxMilliseconds) {
      throw new LuaRuntimeError(`shader exceeded its ${this.limits.maxMilliseconds}ms wall-clock budget`, line);
    }
  }

  executeChunk(ast) {
    const scope = new Scope();
    for (const [name, value] of Object.entries(this.globals)) scope.declare(name, value);
    try {
      this.executeBlock(ast.body, scope);
    } catch (error) {
      if (error === BREAK) throw new LuaRuntimeError("'break' outside a loop", ast.line ?? 1);
      throw error;
    }
  }

  executeBlock(body, scope) {
    for (const statement of body) this.executeStatement(statement, scope);
  }

  executeStatement(statement, scope) {
    this.tick(statement.line);
    switch (statement.type) {
      case 'local': {
        for (let index = 0; index < statement.names.length; index += 1) {
          const value = statement.values[index] === undefined
            ? null
            : this.evaluate(statement.values[index], scope);
          scope.declare(statement.names[index], value);
        }
        return;
      }
      case 'assign':
        scope.assign(statement.name, this.evaluate(statement.value, scope), statement.line);
        return;
      case 'callstmt':
        this.evaluate(statement.expression, scope);
        return;
      case 'if':
        for (const clause of statement.clauses) {
          if (truthy(this.evaluate(clause.test, scope))) {
            this.executeBlock(clause.body, new Scope(scope));
            return;
          }
        }
        if (statement.elseBody !== null) this.executeBlock(statement.elseBody, new Scope(scope));
        return;
      case 'for': {
        const start = requireNumber(this.evaluate(statement.start, scope), statement.line, 'for start');
        const end = requireNumber(this.evaluate(statement.end, scope), statement.line, 'for end');
        const step = statement.step === null
          ? 1
          : requireNumber(this.evaluate(statement.step, scope), statement.line, 'for step');
        if (step === 0) throw new LuaRuntimeError('for step cannot be 0', statement.line);
        for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
          this.tick(statement.line);
          const loopScope = new Scope(scope);
          loopScope.declare(statement.name, value);
          try {
            this.executeBlock(statement.body, new Scope(loopScope));
          } catch (error) {
            if (error === BREAK) break;
            throw error;
          }
        }
        return;
      }
      case 'while':
        while (truthy(this.evaluate(statement.test, scope))) {
          this.tick(statement.line);
          try {
            this.executeBlock(statement.body, new Scope(scope));
          } catch (error) {
            if (error === BREAK) break;
            throw error;
          }
        }
        return;
      case 'do':
        this.executeBlock(statement.body, new Scope(scope));
        return;
      case 'break':
        throw BREAK;
      default:
        throw new LuaRuntimeError(`unsupported statement ${JSON.stringify(statement.type)}`, statement.line);
    }
  }

  evaluate(node, scope) {
    this.tick(node.line);
    switch (node.type) {
      case 'number':
      case 'string':
      case 'boolean':
        return node.value;
      case 'nil':
        return null;
      case 'name':
        return scope.get(node.name, node.line);
      case 'index': {
        const object = this.evaluate(node.object, scope);
        if (object === null || (typeof object !== 'object' && typeof object !== 'function')) {
          throw new LuaRuntimeError(`attempt to index ${typeName(object)}`, node.line);
        }
        const key = this.evaluate(node.key, scope);
        if (typeof key !== 'string' && typeof key !== 'number') {
          throw new LuaRuntimeError('table index must be a string or number', node.line);
        }
        if (typeof key === 'string' && (FORBIDDEN_KEYS.has(key) || key.startsWith('__'))) {
          throw new LuaRuntimeError(`table key '${key}' is not available in the shader sandbox`, node.line);
        }
        if (object.kind === 'shader-canvas' && !CANVAS_API.has(key)) {
          throw new LuaRuntimeError(`canvas.${key} is not part of the shader API`, node.line);
        }
        if (!(key in object)) return null;
        const value = object[key];
        return typeof value === 'function' ? value.bind(object) : value;
      }
      case 'table': {
        const table = [];
        let arrayIndex = 0;
        for (const field of node.fields) {
          const value = this.evaluate(field.value, scope);
          if (field.key === null) {
            table[arrayIndex] = value;
            arrayIndex += 1;
          } else {
            const key = this.evaluate(field.key, scope);
            table[key] = value;
            if (typeof key === 'number' && Number.isInteger(key) && key >= 1 && key > arrayIndex) {
              arrayIndex = key;
            }
          }
        }
        return table;
      }
      case 'unary': {
        const value = this.evaluate(node.arg, scope);
        if (node.op === 'not') return !truthy(value);
        return -requireNumber(value, node.line, 'unary minus');
      }
      case 'binary':
        return this.evaluateBinary(node, scope);
      case 'call': {
        const callee = this.evaluate(node.callee, scope);
        if (typeof callee !== 'function') {
          throw new LuaRuntimeError(`attempt to call ${typeName(callee)}`, node.line);
        }
        const args = node.args.map((argument) => this.evaluate(argument, scope));
        try {
          return callee(...args);
        } catch (error) {
          if (error instanceof LuaRuntimeError) throw error;
          throw new LuaRuntimeError(error instanceof Error ? error.message : String(error), node.line);
        }
      }
      default:
        throw new LuaRuntimeError(`unsupported expression ${JSON.stringify(node.type)}`, node.line);
    }
  }

  evaluateBinary(node, scope) {
    if (node.op === 'and') {
      const left = this.evaluate(node.left, scope);
      return truthy(left) ? this.evaluate(node.right, scope) : left;
    }
    if (node.op === 'or') {
      const left = this.evaluate(node.left, scope);
      return truthy(left) ? left : this.evaluate(node.right, scope);
    }
    const left = this.evaluate(node.left, scope);
    const right = this.evaluate(node.right, scope);
    switch (node.op) {
      case '+':
        return requireNumber(left, node.line) + requireNumber(right, node.line);
      case '-':
        return requireNumber(left, node.line) - requireNumber(right, node.line);
      case '*':
        return requireNumber(left, node.line) * requireNumber(right, node.line);
      case '/':
        return requireNumber(left, node.line) / requireNumber(right, node.line);
      case '%':
        return requireNumber(left, node.line) % requireNumber(right, node.line);
      case '^':
        return requireNumber(left, node.line) ** requireNumber(right, node.line);
      case '..':
        return toConcatString(left, node.line) + toConcatString(right, node.line);
      case '==':
        return left === right;
      case '~=':
        return left !== right;
      case '<':
        return typeof left === 'number' && typeof right === 'number' ? left < right : String(left) < String(right);
      case '<=':
        return typeof left === 'number' && typeof right === 'number' ? left <= right : String(left) <= String(right);
      case '>':
        return typeof left === 'number' && typeof right === 'number' ? left > right : String(left) > String(right);
      case '>=':
        return typeof left === 'number' && typeof right === 'number' ? left >= right : String(left) >= String(right);
      default:
        throw new LuaRuntimeError(`unsupported operator ${node.op}`, node.line);
    }
  }
}

/**
 * Execute a parsed shader chunk with a flat global environment.
 * @param {object} ast
 * @param {Record<string, any>} globals
 * @param {{maxInstructions?:number,maxMilliseconds?:number}} [limits]
 */
export function executeLua(ast, globals, limits) {
  new Interpreter(globals, limits).executeChunk(ast);
}

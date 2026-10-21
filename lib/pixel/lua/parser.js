import { LuaSyntaxError, tokenize } from './lexer.js';

/**
 * Parser for the pixel_shader Lua subset.
 *
 * Supported statements: local declarations, assignment, function calls,
 * if/elseif/else, numeric for, while, break. Supported expressions: numbers,
 * strings, booleans, nil, variables, property access, calls, arithmetic,
 * comparison, concat, and/or/not. No user functions, tables, metatables,
 * method calls, generic-for, repeat, or return.
 */
class Parser {
  constructor(source) {
    this.tokens = tokenize(source);
    this.index = 0;
    this.depth = 0;
  }

  guard(parse) {
    this.depth += 1;
    if (this.depth > 256) {
      throw new LuaSyntaxError('expression nesting is too deep (limit 256)', this.current.line);
    }
    try {
      return parse();
    } finally {
      this.depth -= 1;
    }
  }

  get current() {
    return this.tokens[this.index];
  }

  peek(offset = 1) {
    return this.tokens[Math.min(this.tokens.length - 1, this.index + offset)];
  }

  is(value) {
    return this.current.value === value;
  }

  isKeyword(value) {
    return this.current.type === 'keyword' && this.current.value === value;
  }

  match(value) {
    if (this.is(value)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  expect(value) {
    if (!this.is(value)) {
      throw new LuaSyntaxError(`expected ${JSON.stringify(value)}, got ${JSON.stringify(this.current.value)}`, this.current.line);
    }
    this.index += 1;
  }

  expectKeyword(value) {
    if (!this.isKeyword(value)) {
      throw new LuaSyntaxError(`expected '${value}', got ${JSON.stringify(this.current.value)}`, this.current.line);
    }
    this.index += 1;
  }

  expectName() {
    if (this.current.type !== 'name') {
      throw new LuaSyntaxError(`expected a name, got ${JSON.stringify(this.current.value)}`, this.current.line);
    }
    const token = this.current;
    this.index += 1;
    return token.value;
  }

  parse() {
    const body = this.parseBlock(new Set());
    if (this.current.type !== 'eof') {
      throw new LuaSyntaxError(`unexpected ${JSON.stringify(this.current.value)}`, this.current.line);
    }
    return { type: 'chunk', body, line: 1 };
  }

  parseBlock(stops) {
    const body = [];
    while (this.current.type !== 'eof' && !stops.has(this.current.value)) {
      if (this.match(';')) continue;
      body.push(this.parseStatement());
    }
    return body;
  }

  parseStatement() {
    const line = this.current.line;
    if (this.isKeyword('local')) {
      this.index += 1;
      const names = [this.expectName()];
      while (this.match(',')) names.push(this.expectName());
      const values = [];
      if (this.match('=')) {
        values.push(this.parseExpression());
        while (this.match(',')) values.push(this.parseExpression());
      }
      return { type: 'local', names, values, line };
    }
    if (this.isKeyword('if')) {
      this.index += 1;
      const clauses = [];
      const test = this.parseExpression();
      this.expectKeyword('then');
      clauses.push({ test, body: this.parseBlock(new Set(['elseif', 'else', 'end'])) });
      while (this.isKeyword('elseif')) {
        this.index += 1;
        const elseifTest = this.parseExpression();
        this.expectKeyword('then');
        clauses.push({ test: elseifTest, body: this.parseBlock(new Set(['elseif', 'else', 'end'])) });
      }
      let elseBody = null;
      if (this.isKeyword('else')) {
        this.index += 1;
        elseBody = this.parseBlock(new Set(['end']));
      }
      this.expectKeyword('end');
      return { type: 'if', clauses, elseBody, line };
    }
    if (this.isKeyword('for')) {
      this.index += 1;
      const name = this.expectName();
      this.expect('=');
      const start = this.parseExpression();
      this.expect(',');
      const end = this.parseExpression();
      let step = null;
      if (this.match(',')) step = this.parseExpression();
      this.expectKeyword('do');
      const body = this.parseBlock(new Set(['end']));
      this.expectKeyword('end');
      return { type: 'for', name, start, end, step, body, line };
    }
    if (this.isKeyword('while')) {
      this.index += 1;
      const test = this.parseExpression();
      this.expectKeyword('do');
      const body = this.parseBlock(new Set(['end']));
      this.expectKeyword('end');
      return { type: 'while', test, body, line };
    }
    if (this.isKeyword('break')) {
      this.index += 1;
      return { type: 'break', line };
    }
    if (this.isKeyword('do')) {
      this.index += 1;
      const body = this.parseBlock(new Set(['end']));
      this.expectKeyword('end');
      return { type: 'do', body, line };
    }
    const expression = this.parseExpression();
    if (this.match('=')) {
      if (expression.type !== 'name') {
        throw new LuaSyntaxError('assignment target must be a variable name', line);
      }
      return { type: 'assign', name: expression.name, value: this.parseExpression(), line };
    }
    if (expression.type !== 'call') {
      throw new LuaSyntaxError('expression statement is not a function call', line);
    }
    return { type: 'callstmt', expression, line };
  }

  parseExpression() {
    return this.guard(() => this.parseOr());
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.isKeyword('or')) {
      const line = this.current.line;
      this.index += 1;
      left = { type: 'binary', op: 'or', left, right: this.parseAnd(), line };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseCompare();
    while (this.isKeyword('and')) {
      const line = this.current.line;
      this.index += 1;
      left = { type: 'binary', op: 'and', left, right: this.parseCompare(), line };
    }
    return left;
  }

  parseCompare() {
    let left = this.parseConcat();
    while (['==', '~=', '<', '<=', '>', '>='].includes(this.current.value)) {
      const op = this.current.value;
      const line = this.current.line;
      this.index += 1;
      left = { type: 'binary', op, left, right: this.parseConcat(), line };
    }
    return left;
  }

  parseConcat() {
    return this.guard(() => {
      const left = this.parseAdd();
      if (this.match('..')) {
        return {
          type: 'binary',
          op: '..',
          left,
          right: this.parseConcat(),
          line: left.line,
        };
      }
      return left;
    });
  }

  parseAdd() {
    let left = this.parseMul();
    while (this.is('+') || this.is('-')) {
      const op = this.current.value;
      const line = this.current.line;
      this.index += 1;
      left = { type: 'binary', op, left, right: this.parseMul(), line };
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const op = this.current.value;
      const line = this.current.line;
      this.index += 1;
      left = { type: 'binary', op, left, right: this.parseUnary(), line };
    }
    return left;
  }

  parseUnary() {
    return this.guard(() => {
      if (this.isKeyword('not')) {
        const line = this.current.line;
        this.index += 1;
        return { type: 'unary', op: 'not', arg: this.parseUnary(), line };
      }
      if (this.is('-')) {
        const line = this.current.line;
        this.index += 1;
        return { type: 'unary', op: '-', arg: this.parseUnary(), line };
      }
      return this.parsePower();
    });
  }

  parsePower() {
    const left = this.parsePostfix();
    if (this.match('^')) {
      return {
        type: 'binary',
        op: '^',
        left,
        right: this.parseUnary(),
        line: left.line,
      };
    }
    return left;
  }

  parsePostfix() {
    let expression = this.parsePrimary();
    while (true) {
      if (this.match('.')) {
        const name = this.expectName();
        expression = {
          type: 'index',
          object: expression,
          key: { type: 'string', value: name, line: expression.line },
          line: expression.line,
        };
        continue;
      }
      if (this.match('[')) {
        const key = this.parseExpression();
        this.expect(']');
        expression = { type: 'index', object: expression, key, line: expression.line };
        continue;
      }
      if (this.is('(')) {
        const line = this.current.line;
        this.index += 1;
        const args = [];
        if (!this.is(')')) {
          args.push(this.parseExpression());
          while (this.match(',')) args.push(this.parseExpression());
        }
        this.expect(')');
        expression = { type: 'call', callee: expression, args, line };
        continue;
      }
      break;
    }
    return expression;
  }

  parsePrimary() {
    const token = this.current;
    if (token.type === 'number') {
      this.index += 1;
      return { type: 'number', value: token.value, line: token.line };
    }
    if (token.type === 'string') {
      this.index += 1;
      return { type: 'string', value: token.value, line: token.line };
    }
    if (token.type === 'name') {
      this.index += 1;
      return { type: 'name', name: token.value, line: token.line };
    }
    if (this.isKeyword('true') || this.isKeyword('false')) {
      this.index += 1;
      return { type: 'boolean', value: token.value === 'true', line: token.line };
    }
    if (this.isKeyword('nil')) {
      this.index += 1;
      return { type: 'nil', line: token.line };
    }
    if (this.match('(')) {
      const expression = this.parseExpression();
      this.expect(')');
      return expression;
    }
    if (this.match('{')) {
      const fields = [];
      while (!this.is('}')) {
        if (this.match('[')) {
          const key = this.parseExpression();
          this.expect(']');
          this.expect('=');
          fields.push({ key, value: this.parseExpression() });
        } else if (this.current.type === 'name' && this.peek().value === '=') {
          const key = { type: 'string', value: this.current.value, line: this.current.line };
          this.index += 2;
          fields.push({ key, value: this.parseExpression() });
        } else {
          fields.push({ key: null, value: this.parseExpression() });
        }
        if (!this.match(',') && !this.match(';')) break;
      }
      this.expect('}');
      return { type: 'table', fields, line: token.line };
    }
    throw new LuaSyntaxError(`unexpected ${JSON.stringify(token.value)} in expression`, token.line);
  }
}

/**
 * @param {string} source
 * @returns {object}
 */
export function parseLua(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new LuaSyntaxError('shader code must be a non-empty string', 1);
  }
  return new Parser(source).parse();
}

export { LuaSyntaxError };

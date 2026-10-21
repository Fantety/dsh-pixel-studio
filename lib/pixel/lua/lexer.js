/**
 * Lexer for the deliberately small Lua subset used by pixel_shader. It is not
 * a general Lua implementation: no metatables, user functions, generic-for,
 * tables, or host access. That keeps the shader deterministic and bounded.
 */

export class LuaSyntaxError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'LuaSyntaxError';
    this.line = line;
  }
}

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'if',
  'local', 'nil', 'not', 'or', 'then', 'true', 'while',
]);

const TWO_CHAR = new Set(['==', '~=', '<=', '>=', '..']);
const SINGLE = new Set(['+', '-', '*', '/', '%', '^', '(', ')', '{', '}', '[', ']', ',', ';', '.', '=', '<', '>']);

function isDigit(char) {
  return char >= '0' && char <= '9';
}

function isNameStart(char) {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
}

function isNamePart(char) {
  return isNameStart(char) || isDigit(char);
}

/**
 * @param {string} source
 * @returns {Array<{type:'name'|'number'|'string'|'keyword'|'op'|'eof', value:string|number, line:number}>}
 */
export function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  const length = source.length;

  while (index < length) {
    const char = source[index];
    if (char === '\n') {
      line += 1;
      index += 1;
      continue;
    }
    if (char === ' ' || char === '\t' || char === '\r') {
      index += 1;
      continue;
    }
    if (char === '-' && source[index + 1] === '-') {
      index += 2;
      while (index < length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      const startLine = line;
      index += 1;
      let value = '';
      let closed = false;
      while (index < length) {
        const current = source[index];
        if (current === quote) {
          closed = true;
          index += 1;
          break;
        }
        if (current === '\n') throw new LuaSyntaxError('unterminated string literal', startLine);
        if (current === '\\') {
          index += 1;
          const escaped = source[index];
          if (escaped === undefined) throw new LuaSyntaxError('unterminated string escape', startLine);
          if (escaped === 'n') value += '\n';
          else if (escaped === 't') value += '\t';
          else if (escaped === 'r') value += '\r';
          else if (escaped === '\\') value += '\\';
          else if (escaped === '"' || escaped === "'") value += escaped;
          else value += escaped;
          index += 1;
          continue;
        }
        value += current;
        index += 1;
      }
      if (!closed) throw new LuaSyntaxError('unterminated string literal', startLine);
      tokens.push({ type: 'string', value, line: startLine });
      continue;
    }
    if (isDigit(char) || (char === '.' && isDigit(source[index + 1]))) {
      const start = index;
      const startLine = line;
      while (index < length && isDigit(source[index])) index += 1;
      if (source[index] === '.') {
        index += 1;
        while (index < length && isDigit(source[index])) index += 1;
      }
      if (source[index] === 'e' || source[index] === 'E') {
        const exponentStart = index;
        index += 1;
        if (source[index] === '+' || source[index] === '-') index += 1;
        if (!isDigit(source[index])) {
          index = exponentStart;
        } else {
          while (index < length && isDigit(source[index])) index += 1;
        }
      }
      tokens.push({ type: 'number', value: Number(source.slice(start, index)), line: startLine });
      continue;
    }
    if (isNameStart(char)) {
      const start = index;
      const startLine = line;
      while (index < length && isNamePart(source[index])) index += 1;
      const value = source.slice(start, index);
      tokens.push({
        type: KEYWORDS.has(value) ? 'keyword' : 'name',
        value,
        line: startLine,
      });
      continue;
    }
    const two = source.slice(index, index + 2);
    if (TWO_CHAR.has(two)) {
      tokens.push({ type: 'op', value: two, line });
      index += 2;
      continue;
    }
    if (SINGLE.has(char)) {
      tokens.push({ type: 'op', value: char, line });
      index += 1;
      continue;
    }
    throw new LuaSyntaxError(`unexpected character ${JSON.stringify(char)}`, line);
  }
  tokens.push({ type: 'eof', value: '', line });
  return tokens;
}

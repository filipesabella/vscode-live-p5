import * as recast from 'recast';
import * as types from 'ast-types';
const typeBuilders = types.builders;

// the name of the global that holds all the values in the
// injected script
const AllVarsVariableName = '__AllVars';

let previousCode = null;

export function codeHasChanged(userCode: string): boolean {
  return detectCodeChanges(recast.parse(userCode).program.body, previousCode.program.body);
}

/**
 * Receives:
 * let a = 1;
 *
 * and returns:
 * const __AllVars = {
 *   aHash: 1
 * }
 * let a = __AllVars['aHash'];
 */
export function parseCode(userCode: string): string {
  const vars = {};
  const ast = recast.parse(userCode);
  types.visit(ast, {
    visitLiteral: (path) => {
      const key = nodeToKey(path);
      vars[key] = path.value.value;

      path.replace(
        typeBuilders.memberExpression(
          typeBuilders.identifier(AllVarsVariableName),
          typeBuilders.identifier(key)));

      return false;
    }
  });

  const modifiedUserCode = recast.prettyPrint(ast).code;
  previousCode = recast.parse(userCode);

  return `const ${AllVarsVariableName} = ${JSON.stringify(vars)}; ${modifiedUserCode}`;
}

/**
 * Receives:
 * let a = 1;
 *
 * and returns:
 * {
 *   aHash: 1
 * }
 */
export function getVars(userCode: string): any {
  const vars = {};
  const ast = recast.parse(userCode);
  types.visit(ast, {
    visitLiteral: (path) => {
      const key = nodeToKey(path);
      vars[key] = path.value.value;

      return false;
    }
  });

  return vars;
}

/**
 * Returns a uniquely identifiable key given an AST node.
 */
function nodeToKey(path: any): string {
  const parent = path.parentPath;

  if (parent.value.type === 'VariableDeclarator') {
    const line = parent.value.id.loc.start.line;
    const varName = parent.value.id.name;
    return keyFrom('line:' + line + ',varName:' + varName);
  } else if (parent.name === 'arguments') {
    const pathLoc = path.value.loc.start;
    const allArguments = path.parentPath.value;
    // tries to find the argument position in order to uniquely identify this path
    let argPosition = -1;
    for (let i = 0; i < allArguments.length; i++) {
      if ((!allArguments[i].object || allArguments[i].object.name !== AllVarsVariableName) &&
        allArguments[i].loc.start.line === pathLoc.line && allArguments[i].loc.start.column === pathLoc.column) {
        argPosition = i;
        break;
      }
    }
    return keyFrom('value:' + path.raw + ',index:' + argPosition + ',line:' + pathLoc.line);
  } else {
    return keyFrom(JSON.stringify(path.value.loc.start));
  }
}

function detectCodeChanges(actual, expected): boolean {
  if (Object(actual) !== actual) {
    // ignore differences in literals
    return false;
  }

  if (Array.isArray(actual)) {
    if (actual.length !== expected.length) {
      return true;
    }
    for (let i = 0; i < actual.length; i++) {
      if (detectCodeChanges(actual[i], expected[i])) {
        return true;
      }
    }
    return false;
  }

  for (let attr in actual) {
    if (expected && attr in expected) {
      if (detectCodeChanges(actual[attr], expected[attr])) {
        return true;
      }
    } else {
      return true;
    }
  }

  return false;
}

function keyFrom(s: string): string {
  return 'a' + Math.abs(hashCode(s));
}

function hashCode(s: string): number {
  let hash = 0;
  if (s.length === 0) return hash;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

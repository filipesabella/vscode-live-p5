const recast = require('recast');
const types = require('ast-types');
const typeBuilders = require('ast-types').builders;

// the name of the global that holds all the values in the
// injected script
const AllVarsVariableName = '__AllVars';

let previousCode = null;

export function codeHasChanged(userCode: string): boolean {
  return detectCodeChanges(
    astFromUserCode(userCode).program.body,
    previousCode.program.body);
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
  try {
    const vars = {};
    const ast = astFromUserCode(userCode);

    types.visit(ast, {
      visitLiteral: (path) => {
        const key = nodeToKey(path, vars);
        vars[key] = path.value.value;

        path.replace(
          typeBuilders.memberExpression(
            typeBuilders.identifier(AllVarsVariableName),
            typeBuilders.identifier(key)));

        return false;
      }
    });

    const modifiedUserCode = recast.prettyPrint(ast).code;

    previousCode = astFromUserCode(userCode);

    const jsonVars = JSON.stringify(vars);
    return `const ${AllVarsVariableName} = ${jsonVars}; ${modifiedUserCode}`;
  } catch (e) {
    return parseCode(recast.prettyPrint(previousCode));
  }
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
  const ast = astFromUserCode(userCode);

  types.visit(ast, {
    visitLiteral: (path) => {
      const key = nodeToKey(path, vars);
      vars[key] = path.value.value;

      return false;
    }
  });

  return vars;
}

/**
 * Returns the normalised ast ignoring user formatting.
 */
function astFromUserCode(userCode: string): any {
  return recast.parse(recast.prettyPrint(recast.parse(userCode)).code);
}

/**
 * Returns a uniquely identifiable key given an AST node.
 */
function nodeToKey(path: any, vars: any): string {
  let key = 'a' + path.value.loc.start.line;
  let count = 1;
  while (key in vars) {
    key = 'a' + path.value.loc.start.line + '_' + count++;
  }

  return key;
}

/**
 * Here be dragons.
 * Tries to detect recursively if one AST is different from another, ignoring
 * literal value changes.
 */
function detectCodeChanges(actual: any, expected: any): boolean {
  // this returns true when comparing base types (strings, numbers, booleans)
  // we reach this case in many properties like an function's name.
  if (Object(actual) !== actual) {
    return actual !== expected;
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

  const actualIsLiteral = actual.type === 'Literal';
  const expectedIsLiteral = expected.type === 'Literal';

  if (actualIsLiteral && expectedIsLiteral) {
    return false;
  } else if (!actualIsLiteral && !expectedIsLiteral) {
    for (let attr in actual) {
      /**
       * Sadly there's no other way to compare AST nodes without treating each
       * type specifically, as there's no common interface.
       *
       * This code simply iterates through all object properties and compares
       * them. `loc`, however is a property that nodes have that can differ
       * between `actual` and `expected`, but we don't * necessarily care for
       * this change as it might just be a literal value changing.
       */
      if (expected && attr in expected) {
        if (attr !== 'loc' && detectCodeChanges(actual[attr], expected[attr])) {
          return true;
        }
      } else {
        return true;
      }
    }
  } else {
    return true;
  }

  return false;
}

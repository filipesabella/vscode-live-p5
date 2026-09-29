import { transform } from 'sucrase';

export function transpile(text: string, languageId: string): string {
  return languageId === 'typescript'
    ? transform(text, { transforms: ['typescript'] }).code
    : text;
}

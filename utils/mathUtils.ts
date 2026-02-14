
export const parseEquation = (input: string) => {
  // Clean spaces and make lowercase
  const str = input.replace(/\s+/g, '').toLowerCase();
  
  // Regex for ax^2 + bx + c (=0 is now optional)
  const regex = /^([+-]?\d*)x\^2([+-]?\d*)x([+-]?\d*)(?:=0)?$/;
  const match = str.match(regex);
  
  if (!match) return null;
  
  const parseCoeff = (c: string, def: number) => {
    if (c === "" || c === "+") return 1;
    if (c === "-") return -1;
    return parseInt(c);
  };

  const a = parseCoeff(match[1], 1);
  const b = parseCoeff(match[2], 0);
  const c = parseInt(match[3] || "0");

  return { a, b, c };
};

/**
 * Normalizes a math string for comparison by removing spaces and 
 * redundant '1' coefficients before variables.
 */
export const normalizeMathString = (input: string): string => {
  let str = input.replace(/\s+/g, '').toLowerCase();
  // Remove leading +
  if (str.startsWith('+')) str = str.substring(1);
  // Replace +- with -
  str = str.replace(/\+\-/g, '-');
  // Replace -+ with -
  str = str.replace(/\-\+/g, '-');
  // Remove '1' before 'x'
  str = str.replace(/(^|[+-])1x/g, '$1x');
  
  return str;
};

/**
 * Strips the '=0' suffix if present for expression-only comparison.
 */
export const stripEquation = (input: string): string => {
  return input.replace(/=0$/, '');
};

/**
 * Formats math strings for the UI by replacing notation like ^2 
 * with actual superscript characters.
 */
export const formatMathDisplay = (text: string): string => {
  if (!text) return "";
  // Replace ^2 with superscript 2
  return text.replace(/\^2/g, '²');
};

export const solveQuadratic = (a: number, b: number, c: number) => {
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
  return Array.from(new Set([x1, x2])).sort((a, b) => a - b);
};

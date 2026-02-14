
export const calculateGcf = (a: number, b: number, c: number): number => {
  const gcd2 = (x: number, y: number): number => {
    x = Math.abs(x);
    y = Math.abs(y);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  };
  return gcd2(a, gcd2(b, c));
};

export const parseEquation = (input: string) => {
  const str = input.replace(/\s+/g, '').toLowerCase();
  const regex = /^([+-]?\d*)x\^2([+-]?\d*)x([+-]?\d*)(?:=0)?$/;
  const match = str.match(regex);
  
  if (!match) return null;
  
  const parseCoeff = (c: string) => {
    if (c === "" || c === "+") return 1;
    if (c === "-") return -1;
    return parseInt(c);
  };

  const a = parseCoeff(match[1]);
  const b = parseCoeff(match[2]);
  const c = parseInt(match[3] || "0");

  return { a, b, c };
};

/**
 * Evaluates a string that might be a fraction (1/2) or decimal (0.5) 
 * into a single float for comparison.
 */
export const evaluateNumeric = (val: string): number => {
  if (val.includes('/')) {
    const [num, den] = val.split('/').map(s => parseFloat(s.trim()));
    return num / den;
  }
  return parseFloat(val);
};

export const areEquiv = (val1: string | number, val2: string | number, tolerance = 0.0001): boolean => {
  const n1 = typeof val1 === 'string' ? evaluateNumeric(val1) : val1;
  const n2 = typeof val2 === 'string' ? evaluateNumeric(val2) : val2;
  return Math.abs(n1 - n2) < tolerance;
};

export const normalizeMathString = (input: string): string => {
  let str = input.replace(/\s+/g, '').toLowerCase();
  if (str.startsWith('+')) str = str.substring(1);
  str = str.replace(/\+\-/g, '-').replace(/\-\+/g, '-');
  str = str.replace(/(^|[+-])1x/g, '$1x');
  return str;
};

export const stripEquation = (input: string): string => input.replace(/=0$/, '');

export const formatMathDisplay = (text: string): string => {
  if (!text) return "";
  return text.replace(/\^2/g, '²');
};

export const solveQuadratic = (a: number, b: number, c: number) => {
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
  return Array.from(new Set([x1, x2])).sort((a, b) => a - b);
};

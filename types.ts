
export enum AppMode {
  FACTORING = 'factoring',
  SOLVING = 'solving'
}

export enum FactoringMethod {
  GROUPING = 'grouping',
  AREA = 'area'
}

export enum Language {
  EN = 'en',
  ES = 'es'
}

export enum Step {
  CHOOSE_LANGUAGE = 1,
  CHOOSE_MODE = 2,
  CHOOSE_METHOD = 3,
  ENTER_EXPRESSION = 4,
  FACTOR_GCF_TOTAL = 5,
  IDENTIFY_ABC = 6,
  MULTIPLY_AC = 7,
  FIND_FACTORS = 8,
  WORK_METHOD = 9, 
  FINAL_BINOMIALS = 10,
  SET_TO_ZERO = 11,
  SOLVE_LINEAR = 12,
  ENTER_ZEROS = 13,
  COMPLETE = 14
}

export interface EquationState {
  raw: string;
  totalGcf: number;
  a: number; // Reduced a
  b: number; // Reduced b
  c: number; // Reduced c
  ac: number;
  factor1: number;
  factor2: number;
  mode: AppMode;
  method: FactoringMethod;
  language: Language;
  reducedRaw?: string;
  rewritten?: string;
  grouped?: string;
  gcfFactored?: string;
  areaBox?: {
    tl: string; tr: string;
    bl: string; br: string;
    row1Gcf: string; row2Gcf: string;
    col1Gcf: string; col2Gcf: string;
  };
  finalBinomials?: string;
  zeroEquations?: string;
  solvedSteps?: string;
}

export interface ProblemStats {
  correct: number;
  total: number;
}

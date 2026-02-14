
export enum AppMode {
  FACTORING = 'factoring',
  SOLVING = 'solving'
}

export enum Step {
  CHOOSE_MODE = 1,
  ENTER_EQUATION = 2,
  IDENTIFY_ABC = 3,
  MULTIPLY_AC = 4,
  FIND_FACTORS = 5,
  REWRITE_EQUATION = 6,
  GROUP_TERMS = 7,
  FACTOR_GCF = 8,
  FINAL_BINOMIALS = 9,
  SET_TO_ZERO = 10,
  SOLVE_LINEAR = 11,
  ENTER_ZEROS = 12,
  COMPLETE = 13
}

export interface EquationState {
  raw: string;
  a: number;
  b: number;
  c: number;
  ac: number;
  factor1: number;
  factor2: number;
  mode: AppMode;
  rewritten?: string;
  grouped?: string;
  gcfFactored?: string;
  finalBinomials?: string;
  zeroEquations?: string;
  solvedSteps?: string;
}

export interface ProblemStats {
  correct: number;
  total: number;
}

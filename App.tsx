
import React, { useState, useEffect, useCallback } from 'react';
import { Step, AppMode, EquationState, ProblemStats } from './types';
import { getHint } from './services/geminiService';
import { parseEquation, solveQuadratic, normalizeMathString, formatMathDisplay, stripEquation } from './utils/mathUtils';

const App: React.FC = () => {
  // State
  const [currentStep, setCurrentStep] = useState<Step>(Step.CHOOSE_MODE);
  const [equation, setEquation] = useState<EquationState>({
    raw: '', a: 0, b: 0, c: 0, ac: 0, factor1: 0, factor2: 0, mode: AppMode.FACTORING
  });
  const [userInput, setUserInput] = useState<string>('');
  const [abcInputs, setAbcInputs] = useState({ a: '', b: '', c: '' });
  
  // Step 5 specific state
  const [testFactors, setTestFactors] = useState({ f1: '', f2: '' });
  const [finalFactors, setFinalFactors] = useState({ f1: '', f2: '' });

  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState<boolean>(false);
  const [stats, setStats] = useState<ProblemStats>({ correct: 0, total: 0 });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Helper to reset problem
  const startOver = () => {
    setCurrentStep(Step.CHOOSE_MODE);
    setEquation({ raw: '', a: 0, b: 0, c: 0, ac: 0, factor1: 0, factor2: 0, mode: AppMode.FACTORING });
    setUserInput('');
    setAbcInputs({ a: '', b: '', c: '' });
    setTestFactors({ f1: '', f2: '' });
    setFinalFactors({ f1: '', f2: '' });
    setHint(null);
    setFeedback(null);
  };

  const validateStep = async () => {
    setHint(null);
    setFeedback(null);
    let isCorrect = false;
    let expectedDesc = "";
    let currentUserValue = userInput;
    let nextStepData: Partial<EquationState> = {};

    // Normalization helper for templates
    const formatTerm = (coeff: number, variable: string, isFirst: boolean = false) => {
      if (coeff === 0) return "";
      let s = "";
      if (coeff === 1) s = isFirst ? variable : "+" + variable;
      else if (coeff === -1) s = "-" + variable;
      else s = (coeff > 0 && !isFirst ? "+" : "") + coeff + variable;
      return s;
    };

    const formatConst = (c: number) => {
      if (c === 0) return "";
      return (c > 0 ? "+" : "") + c;
    };

    // Prepare normalized user input for factoring steps (ignore =0)
    const normUserFactoring = normalizeMathString(stripEquation(userInput));

    switch (currentStep) {
      case Step.ENTER_EQUATION:
        const parsed = parseEquation(userInput);
        if (parsed) {
          // Store raw without =0 for consistency in factoring steps if user didn't provide it
          nextStepData = { ...parsed, raw: stripEquation(userInput), ac: parsed.a * parsed.c };
          isCorrect = true;
        } else {
          expectedDesc = "Enter a quadratic expression in standard form like x^2 + 5x + 6";
        }
        break;

      case Step.IDENTIFY_ABC:
        currentUserValue = `a=${abcInputs.a}, b=${abcInputs.b}, c=${abcInputs.c}`;
        if (
          parseInt(abcInputs.a) === equation.a && 
          parseInt(abcInputs.b) === equation.b && 
          parseInt(abcInputs.c) === equation.c
        ) {
          isCorrect = true;
        } else {
          expectedDesc = "Identify the coefficients a, b, and c correctly from the standard form.";
        }
        break;

      case Step.MULTIPLY_AC:
        if (parseInt(userInput) === equation.ac) {
          isCorrect = true;
        } else {
          expectedDesc = `Calculate a * c (which is ${equation.a} * ${equation.c}).`;
        }
        break;

      case Step.FIND_FACTORS:
        const f1 = parseInt(finalFactors.f1);
        const f2 = parseInt(finalFactors.f2);
        currentUserValue = `factors=${f1},${f2}`;
        if (!isNaN(f1) && !isNaN(f2) && 
            f1 * f2 === equation.ac && 
            f1 + f2 === equation.b) {
          nextStepData = { factor1: f1, factor2: f2 };
          isCorrect = true;
        } else {
          expectedDesc = `Find two numbers that multiply to ${equation.ac} and add up to ${equation.b}.`;
        }
        break;

      case Step.REWRITE_EQUATION:
        const fact1 = equation.factor1;
        const fact2 = equation.factor2;
        
        // Expected strings without =0
        const expected1 = normalizeMathString(`${formatTerm(equation.a, "x^2", true)}${formatTerm(fact1, "x")}${formatTerm(fact2, "x")}${formatConst(equation.c)}`);
        const expected2 = normalizeMathString(`${formatTerm(equation.a, "x^2", true)}${formatTerm(fact2, "x")}${formatTerm(fact1, "x")}${formatConst(equation.c)}`);
        
        if (normUserFactoring === expected1 || normUserFactoring === expected2) {
          nextStepData = { rewritten: stripEquation(userInput) };
          isCorrect = true;
        } else {
          expectedDesc = "Rewrite the expression splitting the middle term using the factors found.";
        }
        break;

      case Step.GROUP_TERMS:
        if (normUserFactoring.includes('(') && normUserFactoring.includes(')') && normUserFactoring.includes('+')) {
          nextStepData = { grouped: stripEquation(userInput) };
          isCorrect = true;
        } else {
          expectedDesc = "Group the terms into two binomials: (first two) + (last two).";
        }
        break;

      case Step.FACTOR_GCF:
        if (normUserFactoring.toLowerCase().includes('(')) {
          nextStepData = { gcfFactored: stripEquation(userInput) };
          isCorrect = true;
        } else {
          expectedDesc = "Factor out the Greatest Common Factor from each group.";
        }
        break;

      case Step.FINAL_BINOMIALS:
        if (normUserFactoring.includes(')(')) {
          nextStepData = { finalBinomials: stripEquation(userInput) };
          isCorrect = true;
        } else {
          expectedDesc = "Write the final factored form as two binomials multiplied together.";
        }
        break;

      case Step.SET_TO_ZERO:
        // Now we explicitly require =0
        if (userInput.includes('=0')) {
          nextStepData = { zeroEquations: userInput };
          isCorrect = true;
        } else {
          expectedDesc = "Set each binomial from the previous step equal to zero (e.g., x+2=0, x+3=0).";
        }
        break;

      case Step.SOLVE_LINEAR:
        nextStepData = { solvedSteps: userInput };
        isCorrect = true;
        break;

      case Step.ENTER_ZEROS:
        const roots = userInput.split(',').map(s => parseFloat(s.trim())).sort((a,b) => a-b);
        const actualRoots = solveQuadratic(equation.a, equation.b, equation.c);
        if (JSON.stringify(roots) === JSON.stringify(actualRoots)) {
          isCorrect = true;
        } else {
          expectedDesc = "Enter the final values for x, separated by a comma.";
        }
        break;
    }

    if (isCorrect) {
      setFeedback({ type: 'success', msg: 'Great job! Moving to the next step.' });
      setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      setEquation(prev => ({ ...prev, ...nextStepData }));
      
      if (equation.mode === AppMode.FACTORING && currentStep === Step.FINAL_BINOMIALS) {
        setCurrentStep(Step.COMPLETE);
      } else if (currentStep === Step.ENTER_ZEROS) {
        setCurrentStep(Step.COMPLETE);
      } else {
        setCurrentStep(prev => prev + 1);
      }
      setUserInput('');
    } else {
      setStats(prev => ({ ...prev, total: prev.total + 1 }));
      setFeedback({ type: 'error', msg: 'Not quite right. See the hint below.' });
      setIsLoadingHint(true);
      const h = await getHint(Step[currentStep], equation.raw, currentUserValue, expectedDesc);
      setHint(h);
      setIsLoadingHint(false);
    }
  };

  const renderReference = () => {
    let content = null;
    let label = "Reference from previous step";

    switch (currentStep) {
      case Step.IDENTIFY_ABC:
        label = "Current Expression";
        content = formatMathDisplay(equation.raw);
        break;
      case Step.MULTIPLY_AC:
        label = "Identified Coefficients";
        content = `a = ${equation.a}, c = ${equation.c}`;
        break;
      case Step.FIND_FACTORS:
        label = "Goal Product & Sum";
        content = `Product (ac) = ${equation.ac}, Sum (b) = ${equation.b}`;
        break;
      case Step.REWRITE_EQUATION:
        label = "Expression & Factors Found";
        content = (
          <div className="flex flex-col gap-1">
            <span>Expression: {formatMathDisplay(equation.raw)}</span>
            <span>Factors: {equation.factor1}, {equation.factor2}</span>
          </div>
        );
        break;
      case Step.GROUP_TERMS:
        label = "Rewritten Expression";
        content = formatMathDisplay(equation.rewritten || "");
        break;
      case Step.FACTOR_GCF:
        label = "Grouped Expression";
        content = formatMathDisplay(equation.grouped || "");
        break;
      case Step.FINAL_BINOMIALS:
        label = "GCF Factored Expression";
        content = formatMathDisplay(equation.gcfFactored || "");
        break;
      case Step.SET_TO_ZERO:
        label = "Factored Form";
        content = formatMathDisplay(equation.finalBinomials || "");
        break;
      case Step.SOLVE_LINEAR:
        label = "Equations Set to Zero";
        content = formatMathDisplay(equation.zeroEquations || "");
        break;
      case Step.ENTER_ZEROS:
        label = "Solving Work";
        content = formatMathDisplay(equation.solvedSteps || "");
        break;
      default:
        return null;
    }

    return (
      <div className="mb-6 bg-slate-50 border-l-4 border-blue-400 p-4 rounded-r-xl">
        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">{label}</p>
        <div className="text-lg font-medium text-slate-700 math-font">
          {content}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case Step.CHOOSE_MODE:
        return (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800">What would you like to do?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => { setEquation({...equation, mode: AppMode.FACTORING}); setCurrentStep(Step.ENTER_EQUATION); }}
                className="p-6 border-2 border-blue-500 rounded-xl hover:bg-blue-50 transition-all text-left group"
              >
                <i className="fas fa-divide text-blue-500 text-3xl mb-3 group-hover:scale-110 transition-transform"></i>
                <h3 className="text-xl font-bold text-blue-800">Factoring Only</h3>
                <p className="text-slate-600">Break down an expression into binomials.</p>
              </button>
              <button 
                onClick={() => { setEquation({...equation, mode: AppMode.SOLVING}); setCurrentStep(Step.ENTER_EQUATION); }}
                className="p-6 border-2 border-emerald-500 rounded-xl hover:bg-emerald-50 transition-all text-left group"
              >
                <i className="fas fa-equals text-emerald-500 text-3xl mb-3 group-hover:scale-110 transition-transform"></i>
                <h3 className="text-xl font-bold text-emerald-800">Solve for X</h3>
                <p className="text-slate-600">Factor and find the zeros of the equation.</p>
              </button>
            </div>
          </div>
        );

      case Step.ENTER_EQUATION:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 2: Enter your quadratic expression</label>
            <p className="text-sm text-slate-500 italic">Format: ax² + bx + c (e.g., x² + 5x + 6)</p>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., x^2 + 5x + 6"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
            {userInput && (
              <div className="mt-2 text-slate-400 text-sm">
                Preview: <span className="math-font text-slate-600">{formatMathDisplay(userInput)}</span>
              </div>
            )}
          </div>
        );

      case Step.IDENTIFY_ABC:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 3: Identify a, b, and c</label>
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold italic math-font text-slate-700">a =</span>
                <input 
                  type="text" 
                  value={abcInputs.a} 
                  onChange={(e) => setAbcInputs({ ...abcInputs, a: e.target.value })}
                  className="w-20 p-3 border-2 border-slate-200 rounded-lg text-xl text-center focus:border-blue-500 outline-none transition-all"
                  placeholder="?"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold italic math-font text-slate-700">b =</span>
                <input 
                  type="text" 
                  value={abcInputs.b} 
                  onChange={(e) => setAbcInputs({ ...abcInputs, b: e.target.value })}
                  className="w-20 p-3 border-2 border-slate-200 rounded-lg text-xl text-center focus:border-blue-500 outline-none transition-all"
                  placeholder="?"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold italic math-font text-slate-700">c =</span>
                <input 
                  type="text" 
                  value={abcInputs.c} 
                  onChange={(e) => setAbcInputs({ ...abcInputs, c: e.target.value })}
                  className="w-20 p-3 border-2 border-slate-200 rounded-lg text-xl text-center focus:border-blue-500 outline-none transition-all"
                  placeholder="?"
                />
              </div>
            </div>
          </div>
        );

      case Step.MULTIPLY_AC:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 4: Multiply a times c</label>
            <input 
              type="number" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Result of a * c"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
          </div>
        );

      case Step.FIND_FACTORS:
        const testSum = (parseInt(testFactors.f1) || 0) + (parseInt(testFactors.f2) || 0);
        return (
          <div className="space-y-8">
            <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 space-y-4">
              <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Scratchpad (Testing)</h4>
              <div className="flex flex-wrap gap-4 items-center">
                <input 
                  type="number" 
                  value={testFactors.f1} 
                  onChange={(e) => setTestFactors({ ...testFactors, f1: e.target.value })}
                  className="w-24 p-3 border-2 border-white rounded-lg text-xl text-center shadow-sm"
                  placeholder="?"
                />
                <span className="text-2xl font-bold text-blue-300">+</span>
                <input 
                  type="number" 
                  value={testFactors.f2} 
                  onChange={(e) => setTestFactors({ ...testFactors, f2: e.target.value })}
                  className="w-24 p-3 border-2 border-white rounded-lg text-xl text-center shadow-sm"
                  placeholder="?"
                />
                <span className="text-2xl font-bold text-blue-300">=</span>
                <div className={`w-24 p-3 border-2 rounded-lg text-xl text-center font-bold shadow-inner ${
                  testSum === equation.b ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-white border-blue-100 text-blue-700'
                }`}>
                  {testSum}
                </div>
              </div>
              <p className="text-xs text-blue-400 italic">Use this area to test combinations!</p>
            </div>

            <div className="space-y-4">
              <label className="block text-lg font-bold text-slate-700">Step 5: Final Chosen Factors</label>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400 font-bold uppercase ml-1">Factor 1</span>
                  <input 
                    type="number" 
                    value={finalFactors.f1} 
                    onChange={(e) => setFinalFactors({ ...finalFactors, f1: e.target.value })}
                    className="w-32 p-4 border-2 border-slate-200 rounded-xl text-2xl text-center focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                   <span className="text-xs text-slate-400 font-bold uppercase ml-1">Factor 2</span>
                  <input 
                    type="number" 
                    value={finalFactors.f2} 
                    onChange={(e) => setFinalFactors({ ...finalFactors, f2: e.target.value })}
                    className="w-32 p-4 border-2 border-slate-200 rounded-xl text-2xl text-center focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case Step.REWRITE_EQUATION:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 6: Rewrite the whole expression</label>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., x² + 2x + 3x + 6"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
            {userInput && (
              <div className="mt-2 text-slate-400 text-sm">
                Preview: <span className="math-font text-slate-600">{formatMathDisplay(userInput)}</span>
              </div>
            )}
          </div>
        );

      case Step.GROUP_TERMS:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 7: Group the terms with parentheses</label>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., (x² + 2x) + (3x + 6)"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
            {userInput && (
              <div className="mt-2 text-slate-400 text-sm">
                Preview: <span className="math-font text-slate-600">{formatMathDisplay(userInput)}</span>
              </div>
            )}
          </div>
        );

      case Step.FACTOR_GCF:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 8: Factor the GCF from each binomial</label>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., x(x+2) + 3(x+2)"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
            {userInput && (
              <div className="mt-2 text-slate-400 text-sm">
                Preview: <span className="math-font text-slate-600">{formatMathDisplay(userInput)}</span>
              </div>
            )}
          </div>
        );

      case Step.FINAL_BINOMIALS:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 9: Factor out the common binomial</label>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., (x+3)(x+2)"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
          </div>
        );

      case Step.SET_TO_ZERO:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 10: Set each binomial equal to zero</label>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., x+3=0, x+2=0"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
          </div>
        );

      case Step.SOLVE_LINEAR:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 11: Solve each simple equation</label>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Show your steps"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
          </div>
        );

      case Step.ENTER_ZEROS:
        return (
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-700">Step 12: Enter the final zeros (x-intercepts)</label>
            <input 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., -3, -2"
              className="w-full p-4 border-2 border-slate-200 rounded-lg text-xl focus:border-blue-500 outline-none transition-all"
            />
          </div>
        );

      case Step.COMPLETE:
        const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;
        return (
          <div className="text-center space-y-6 py-10 animate-bounceIn">
            <div className="text-6xl text-emerald-500 mb-4">
               <i className="fas fa-check-circle"></i>
            </div>
            <h2 className="text-3xl font-bold text-slate-800">Problem Complete!</h2>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 inline-block">
               <p className="text-xl text-slate-600">Problem Accuracy</p>
               <p className="text-5xl font-black text-blue-600">{accuracy}%</p>
               <p className="text-slate-500 mt-2">{stats.correct} out of {stats.total} steps correct on first try.</p>
            </div>
            <div>
              <button 
                onClick={startOver}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
              >
                Solve Another Equation
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isInputEmpty = () => {
    if (currentStep === Step.IDENTIFY_ABC) {
      return (abcInputs.a.trim() === '' || abcInputs.b.trim() === '' || abcInputs.c.trim() === '');
    }
    if (currentStep === Step.FIND_FACTORS) {
      return (finalFactors.f1.trim() === '' || finalFactors.f2.trim() === '');
    }
    return userInput.trim() === '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 bg-slate-50">
      <header className="w-full max-w-4xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-3 rounded-xl shadow-md">
            <i className="fas fa-superscript text-2xl"></i>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">QuadraMaster</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Accuracy</p>
            <p className="text-lg font-bold text-slate-700">
               {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%
            </p>
          </div>
          <button 
            onClick={startOver}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <i className="fas fa-undo-alt text-xl"></i>
          </button>
        </div>
      </header>

      <main className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {currentStep !== Step.CHOOSE_MODE && currentStep !== Step.COMPLETE && (
          <div className="h-2 bg-slate-100 w-full">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / 12) * 100}%` }}
            ></div>
          </div>
        )}

        <div className="p-8 md:p-12">
          {renderReference()}
          {renderStepContent()}

          {currentStep !== Step.CHOOSE_MODE && currentStep !== Step.COMPLETE && (
            <div className="mt-8 flex flex-col gap-4">
              <button 
                onClick={validateStep}
                disabled={isInputEmpty() || isLoadingHint}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-md ${
                  isInputEmpty() || isLoadingHint
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                }`}
              >
                {isLoadingHint ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="fas fa-circle-notch animate-spin"></i> Checking...
                  </span>
                ) : 'Check Step'}
              </button>
            </div>
          )}

          {(feedback || hint) && (
            <div className={`mt-6 p-6 rounded-2xl animate-slideUp border ${
              feedback?.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-orange-50 border-orange-100 text-orange-800'
            }`}>
              {feedback && (
                <div className="flex items-start gap-3">
                  <i className={`fas ${feedback.type === 'success' ? 'fa-check-circle' : 'fa-lightbulb'} mt-1`}></i>
                  <div>
                    <p className="font-bold">{feedback.msg}</p>
                    {hint && <p className="mt-2 text-orange-700 italic">{hint}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-center text-slate-400 max-w-lg">
        <p className="text-sm">
          QuadraMaster helps you master the grouping method for factoring. 
          Enter your values clearly, and let the AI guide you through the logic!
        </p>
        <div className="mt-4 flex justify-center gap-4 grayscale opacity-50">
           <i className="fab fa-react text-2xl"></i>
           <i className="fas fa-robot text-2xl"></i>
           <i className="fas fa-brain text-2xl"></i>
        </div>
      </footer>
    </div>
  );
};

export default App;

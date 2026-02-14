
import React, { useState } from 'react';
import { Step, AppMode, FactoringMethod, EquationState, ProblemStats, Language } from './types';
import { getHint } from './services/geminiService';
import { 
  parseEquation, 
  solveQuadratic, 
  normalizeMathString, 
  formatMathDisplay, 
  stripEquation, 
  calculateGcf,
  areEquiv,
  evaluateNumeric
} from './utils/mathUtils';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.CHOOSE_LANGUAGE);
  const [equation, setEquation] = useState<EquationState>({
    raw: '', totalGcf: 1, a: 0, b: 0, c: 0, ac: 0, factor1: 0, factor2: 0, 
    mode: AppMode.FACTORING, method: FactoringMethod.GROUPING, language: Language.EN
  });
  
  const [userInput, setUserInput] = useState<string>('');
  const [abcInputs, setAbcInputs] = useState({ a: '', b: '', c: '' });
  const [testFactors, setTestFactors] = useState({ f1: '', f2: '' });
  const [finalFactors, setFinalFactors] = useState({ f1: '', f2: '' });
  
  const [areaInputs, setAreaInputs] = useState({
    tl: '', tr: '', bl: '', br: '',
    row1: '', row2: '', col1: '', col2: ''
  });
  const [areaFinalBinomial, setAreaFinalBinomial] = useState('');

  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState<boolean>(false);
  const [stats, setStats] = useState<ProblemStats>({ correct: 0, total: 0 });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const t = (en: string, es: string) => equation.language === Language.ES ? es : en;

  const startOver = () => {
    setCurrentStep(Step.CHOOSE_MODE);
    setEquation(prev => ({ 
      ...prev,
      raw: '', totalGcf: 1, a: 0, b: 0, c: 0, ac: 0, factor1: 0, factor2: 0, 
      reducedRaw: undefined, rewritten: undefined, grouped: undefined, areaBox: undefined,
      finalBinomials: undefined, zeroEquations: undefined, solvedSteps: undefined
    }));
    resetInputs();
    setHint(null);
    setFeedback(null);
  };

  const resetInputs = () => {
    setUserInput('');
    setAbcInputs({ a: '', b: '', c: '' });
    setTestFactors({ f1: '', f2: '' });
    setFinalFactors({ f1: '', f2: '' });
    setAreaInputs({ tl: '', tr: '', bl: '', br: '', row1: '', row2: '', col1: '', col2: '' });
    setAreaFinalBinomial('');
  };

  const validateStep = async () => {
    setHint(null);
    setFeedback(null);
    let isCorrect = false;
    let expectedDesc = "";
    let nextStepData: Partial<EquationState> = {};
    let currentUserValue = userInput;

    const norm = (s: string) => normalizeMathString(stripEquation(s));

    switch (currentStep) {
      case Step.ENTER_EXPRESSION:
        const parsed = parseEquation(userInput);
        if (parsed) {
          const gcf = calculateGcf(parsed.a, parsed.b, parsed.c);
          nextStepData = { ...parsed, raw: stripEquation(userInput), totalGcf: gcf };
          isCorrect = true;
        } else expectedDesc = t("Enter expression in standard form", "Ingrese la expresión en forma estándar");
        break;

      case Step.FACTOR_GCF_TOTAL:
        const gcf = equation.totalGcf;
        const ra = equation.a / gcf;
        const rb = equation.b / gcf;
        const rc = equation.c / gcf;
        const expected = gcf > 1 
          ? `${gcf}(${ra === 1 ? '' : (ra === -1 ? '-' : ra)}x^2${rb >= 0 ? '+' : ''}${rb}x${rc >= 0 ? '+' : ''}${rc})`
          : `${ra === 1 ? '' : (ra === -1 ? '-' : ra)}x^2${rb >= 0 ? '+' : ''}${rb}x${rc >= 0 ? '+' : ''}${rc}`;
        
        if (norm(userInput) === norm(expected) || (gcf === 1 && norm(userInput) === norm(equation.raw))) {
          nextStepData = { reducedRaw: userInput, a: ra, b: rb, c: rc, ac: ra * rc };
          isCorrect = true;
        } else expectedDesc = t(`Factor out the GCF of ${gcf}`, `Factorice el MCD de ${gcf}`);
        break;

      case Step.IDENTIFY_ABC:
        if (areEquiv(abcInputs.a, equation.a) && areEquiv(abcInputs.b, equation.b) && areEquiv(abcInputs.c, equation.c)) {
          isCorrect = true;
        } else expectedDesc = t("Identify a, b, c from simplified expression", "Identifique a, b, c de la expresión simplificada");
        break;

      case Step.MULTIPLY_AC:
        if (areEquiv(userInput, equation.ac)) isCorrect = true;
        else expectedDesc = t("Multiply a by c", "Multiplique a por c");
        break;

      case Step.FIND_FACTORS:
        if (equation.method === FactoringMethod.AREA) {
          const f1Val = parseInt(finalFactors.f1), f2Val = parseInt(finalFactors.f2);
          const factorsValid = (f1Val * f2Val === equation.ac && f1Val + f2Val === equation.b);
          
          const boxValid = 
            norm(areaInputs.tl) === norm(`${equation.a}x^2`) &&
            norm(areaInputs.br) === norm(`${equation.c}`) &&
            ((norm(areaInputs.tr) === norm(`${f1Val}x`) && norm(areaInputs.bl) === norm(`${f2Val}x`)) ||
             (norm(areaInputs.tr) === norm(`${f2Val}x`) && norm(areaInputs.bl) === norm(`${f1Val}x`)));
          
          const gcfValid = areaInputs.row1 && areaInputs.row2 && areaInputs.col1 && areaInputs.col2;
          
          // New merged requirement: Binomial factoring in same step
          const hasCorrectBinomials = areaFinalBinomial.includes(')(');
          const hasCorrectGcfInFinal = equation.totalGcf > 1 ? areaFinalBinomial.trim().startsWith(equation.totalGcf.toString()) : true;

          if (factorsValid && boxValid && gcfValid && hasCorrectBinomials && hasCorrectGcfInFinal) {
             nextStepData = { factor1: f1Val, factor2: f2Val, areaBox: { ...areaInputs }, finalBinomials: areaFinalBinomial };
             isCorrect = true;
          } else {
             expectedDesc = t("Identify factors, fill the box, calculate GCFs, and write the final factored form (including the initial GCF).", "Identifique factores, llene la caja, calcule los MCD y escriba la forma factorizada final (incluyendo el MCD inicial).");
             currentUserValue = `Factors: ${finalFactors.f1}, ${finalFactors.f2} | Box: ${areaInputs.tl},${areaInputs.tr} | Factored: ${areaFinalBinomial}`;
          }
        } else {
          const f1 = parseInt(finalFactors.f1), f2 = parseInt(finalFactors.f2);
          if (f1 * f2 === equation.ac && f1 + f2 === equation.b) {
            nextStepData = { factor1: f1, factor2: f2 };
            isCorrect = true;
          } else expectedDesc = t(`Find factors of ${equation.ac} that sum to ${equation.b}`, `Encuentre factores de ${equation.ac} que sumen ${equation.b}`);
        }
        break;

      case Step.WORK_METHOD:
        if (userInput.includes('(')) {
          nextStepData = { rewritten: userInput };
          isCorrect = true;
        } else expectedDesc = t("Rewrite splitting the middle term and show grouping", "Reescriba dividiendo el término medio y muestre la agrupación");
        break;

      case Step.FINAL_BINOMIALS:
        const hasCorrectBinomials = userInput.includes(')(');
        const hasCorrectGcfInFinal = equation.totalGcf > 1 ? userInput.trim().startsWith(equation.totalGcf.toString()) : true;

        if (hasCorrectBinomials && hasCorrectGcfInFinal) {
          nextStepData = { finalBinomials: userInput };
          isCorrect = true;
        } else {
          expectedDesc = equation.totalGcf > 1 
            ? t(`Write factors including the starting GCF of ${equation.totalGcf}`, `Escriba los factores incluyendo el MCD inicial de ${equation.totalGcf}`)
            : t("Write final binomial factors", "Escriba los factores binomiales finales");
        }
        break;

      case Step.SET_TO_ZERO:
        const factorsCount = (userInput.match(/=/g) || []).length;
        const expectedCount = equation.totalGcf > 1 ? 3 : 2;
        if (userInput.includes('=0') && factorsCount >= expectedCount) {
          nextStepData = { zeroEquations: userInput };
          isCorrect = true;
        } else expectedDesc = equation.totalGcf > 1 
          ? t(`Set all parts to zero, including the GCF: ${equation.totalGcf}=0`, `Establezca todas las partes en cero, incluido el MCD: ${equation.totalGcf}=0`)
          : t("Set each binomial factor to zero", "Establezca cada factor binomial en cero");
        break;

      case Step.SOLVE_LINEAR:
        const hasFalseString = userInput.toLowerCase().includes('false');
        if (equation.totalGcf > 1 && !hasFalseString) {
           expectedDesc = t(`Include the GCF solution check: ${equation.totalGcf}=0 is false.`, `Incluya la verificación de la solución del MCD: ${equation.totalGcf}=0 es falso (false).`);
        } else {
           nextStepData = { solvedSteps: userInput };
           isCorrect = true;
        }
        break;

      case Step.ENTER_ZEROS:
        const rootsArr = userInput.split(',').map(s => evaluateNumeric(s.trim())).sort((a,b) => a-b);
        const actualRoots = solveQuadratic(equation.a * equation.totalGcf, equation.b * equation.totalGcf, equation.c * equation.totalGcf);
        if (rootsArr.length === actualRoots.length && rootsArr.every((v, i) => areEquiv(v, actualRoots[i]))) isCorrect = true;
        else expectedDesc = t("Find the real x values only (ignore false ones)", "Encuentre solo los valores reales de x (ignore los falsos)");
        break;
    }

    if (isCorrect) {
      setFeedback({ type: 'success', msg: t('Correct!', '¡Correcto!') });
      setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      setEquation(prev => ({ ...prev, ...nextStepData }));
      
      // Handle the skipping for the merged Area method step
      if (currentStep === Step.FIND_FACTORS && equation.method === FactoringMethod.AREA) {
        setCurrentStep(Step.SET_TO_ZERO);
      } else if (equation.mode === AppMode.FACTORING && currentStep === Step.FINAL_BINOMIALS) {
        setCurrentStep(Step.COMPLETE);
      } else if (currentStep === Step.ENTER_ZEROS) {
        setCurrentStep(Step.COMPLETE);
      } else {
        setCurrentStep(prev => prev + 1);
      }
      resetInputs();
    } else {
      setStats(prev => ({ ...prev, total: prev.total + 1 }));
      setFeedback({ type: 'error', msg: t('Try again.', 'Inténtalo de nuevo.') });
      setIsLoadingHint(true);
      const h = await getHint(Step[currentStep], equation.raw, currentUserValue, expectedDesc);
      setHint(h);
      setIsLoadingHint(false);
    }
  };

  const renderReference = () => {
    let content: React.ReactNode = null;
    let label = t("Reference Work", "Trabajo de referencia");

    switch (currentStep) {
      case Step.FACTOR_GCF_TOTAL:
        label = t("Original Expression", "Expresión original");
        content = formatMathDisplay(equation.raw);
        break;
      case Step.IDENTIFY_ABC:
        label = t("Current Form", "Forma actual");
        content = formatMathDisplay(equation.reducedRaw || equation.raw);
        break;
      case Step.MULTIPLY_AC:
        label = t("Working Coefficients", "Coeficientes de trabajo");
        content = formatMathDisplay(equation.reducedRaw || equation.raw);
        break;
      case Step.FIND_FACTORS:
        label = t("Working Equation", "Ecuación de trabajo");
        content = (
          <div className="flex flex-col gap-1">
             <div className="text-emerald-600 font-bold">{formatMathDisplay(equation.reducedRaw || equation.raw)}</div>
             <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ac = {equation.ac}, b = {equation.b}</div>
          </div>
        );
        break;
      case Step.WORK_METHOD:
        label = t("Target Factors", "Factores objetivo");
        content = `${equation.factor1}, ${equation.factor2}`;
        break;
      case Step.FINAL_BINOMIALS:
        label = t("Grouped Expressions", "Expresiones agrupadas");
        content = formatMathDisplay(equation.rewritten || "");
        break;
      case Step.SET_TO_ZERO:
        label = t("Factored Form", "Forma factorizada");
        content = formatMathDisplay(equation.finalBinomials || "");
        break;
      case Step.SOLVE_LINEAR:
        label = t("Equations to Solve", "Ecuaciones a resolver");
        content = formatMathDisplay(equation.zeroEquations || "");
        break;
      case Step.ENTER_ZEROS:
        label = t("Linear Solutions", "Soluciones lineales");
        content = formatMathDisplay(equation.solvedSteps || "");
        break;
      default: return null;
    }

    if (!content) return null;

    return (
      <div className="mb-8 bg-white border-2 border-blue-50 p-6 rounded-[2.5rem] shadow-sm animate-fadeIn relative overflow-hidden">
        <div className="absolute top-0 right-8 -translate-y-1/2 bg-blue-600 text-white text-[8px] font-black px-4 py-1 rounded-full uppercase tracking-widest">{label}</div>
        <div className="text-xl font-medium text-slate-700 math-font leading-relaxed">{content}</div>
      </div>
    );
  };

  const renderAreaModelInputs = () => (
    <div className="space-y-10 animate-fadeIn mt-8 pt-8 border-t-2 border-slate-50">
       <div className="bg-indigo-50/80 p-6 rounded-[2rem] border border-indigo-100 text-indigo-900 text-xs leading-relaxed font-medium shadow-inner">
          <p className="font-black mb-2 flex items-center gap-2 text-indigo-600 text-[10px] uppercase tracking-widest">
            <i className="fas fa-magic"></i> {t("BOX METHOD GUIDE:", "GUÍA DEL MÉTODO DE LA CAJA:")}
          </p>
          <ul className="space-y-1 list-disc list-inside opacity-80">
            <li>{t(`Place ${equation.a}x² (TL) and ${equation.c} (BR).`, `Coloque ${equation.a}x² (TL) y ${equation.c} (BR).`)}</li>
            <li>{t(`Place factors ${finalFactors.f1 || '?'}x and ${finalFactors.f2 || '?'}x in TR/BL.`, `Coloque los factores ${finalFactors.f1 || '?'}x y ${finalFactors.f2 || '?'}x en TR/BL.`)}</li>
            <li>{t(`Find GCFs and write the final binomials below.`, `Encuentre los MCD y escriba los binomios finales a continuación.`)}</li>
          </ul>
       </div>

      <div className="grid grid-cols-[110px_1fr_1fr] gap-4 items-center max-w-lg mx-auto">
        <div />
        <input 
          placeholder={t("Col 1 GCF", "MCD Col 1")} 
          className="p-4 border-2 border-slate-100 rounded-2xl text-center text-xs focus:border-blue-500 outline-none transition-all shadow-sm font-bold bg-white"
          value={areaInputs.col1} onChange={e => setAreaInputs({...areaInputs, col1: e.target.value})}
        />
        <input 
          placeholder={t("Col 2 GCF", "MCD Col 2")} 
          className="p-4 border-2 border-slate-100 rounded-2xl text-center text-xs focus:border-blue-500 outline-none transition-all shadow-sm font-bold bg-white"
          value={areaInputs.col2} onChange={e => setAreaInputs({...areaInputs, col2: e.target.value})}
        />

        <input 
          placeholder={t("Row 1 GCF", "MCD Fila 1")} 
          className="p-4 border-2 border-slate-100 rounded-2xl text-center text-xs focus:border-blue-500 outline-none transition-all shadow-sm font-bold bg-white"
          value={areaInputs.row1} onChange={e => setAreaInputs({...areaInputs, row1: e.target.value})}
        />
        <div className="bg-blue-50 border-2 border-blue-100 h-28 rounded-3xl flex flex-col items-center justify-center p-1 relative shadow-inner">
           <span className="absolute top-2 left-3 text-[8px] font-black text-blue-300">TL</span>
           <input placeholder="..." className="w-full bg-transparent text-center font-black text-blue-700 outline-none text-2xl"
            value={areaInputs.tl} onChange={e => setAreaInputs({...areaInputs, tl: e.target.value})}/>
        </div>
        <div className="bg-white border-2 border-slate-100 h-28 rounded-3xl flex flex-col items-center justify-center p-1 relative shadow-inner">
           <span className="absolute top-2 left-3 text-[8px] font-black text-slate-300">TR</span>
           <input placeholder="..." className="w-full bg-transparent text-center outline-none text-2xl font-medium"
            value={areaInputs.tr} onChange={e => setAreaInputs({...areaInputs, tr: e.target.value})}/>
        </div>

        <input 
          placeholder={t("Row 2 GCF", "MCD Fila 2")} 
          className="p-4 border-2 border-slate-100 rounded-2xl text-center text-xs focus:border-blue-500 outline-none transition-all shadow-sm font-bold bg-white"
          value={areaInputs.row2} onChange={e => setAreaInputs({...areaInputs, row2: e.target.value})}
        />
        <div className="bg-white border-2 border-slate-100 h-28 rounded-3xl flex flex-col items-center justify-center p-1 relative shadow-inner">
           <span className="absolute top-2 left-3 text-[8px] font-black text-slate-300">BL</span>
           <input placeholder="..." className="w-full bg-transparent text-center outline-none text-2xl font-medium"
            value={areaInputs.bl} onChange={e => setAreaInputs({...areaInputs, bl: e.target.value})}/>
        </div>
        <div className="bg-blue-50 border-2 border-blue-100 h-28 rounded-3xl flex flex-col items-center justify-center p-1 relative shadow-inner">
           <span className="absolute top-2 left-3 text-[8px] font-black text-blue-300">BR</span>
           <input placeholder="..." className="w-full bg-transparent text-center font-black text-blue-700 outline-none text-2xl"
            value={areaInputs.br} onChange={e => setAreaInputs({...areaInputs, br: e.target.value})}/>
        </div>
      </div>

      <div className="space-y-4 pt-10 border-t-2 border-slate-50">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center mb-2">{t("Final Factored Result", "Resultado Factorizado Final")}</label>
        <input 
          type="text" 
          value={areaFinalBinomial} 
          onChange={e => setAreaFinalBinomial(e.target.value)} 
          placeholder={equation.totalGcf > 1 ? `${equation.totalGcf}(x+...)(x+...)` : "(x+...)(x+...)"} 
          className="w-full p-8 border-4 border-slate-100 rounded-[3rem] text-4xl text-center focus:border-blue-600 outline-none shadow-xl font-black text-blue-900 transition-all placeholder:opacity-30" 
        />
        <p className="text-[10px] text-slate-400 text-center italic">{t("Include the original GCF if you factored one out earlier!", "¡Incluya el MCD original si factorizó uno anteriormente!")}</p>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case Step.CHOOSE_LANGUAGE:
        return (
          <div className="flex flex-col gap-10 text-center py-10 animate-fadeIn">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">Select Your Language<br/><span className="text-2xl text-slate-400">Seleccione su idioma</span></h2>
            <div className="flex justify-center gap-8">
              <button 
                onClick={() => { setEquation(prev => ({...prev, language: Language.EN})); setCurrentStep(Step.CHOOSE_MODE); }}
                className="flex-1 max-w-[220px] p-12 bg-white border-2 border-blue-500 rounded-[3rem] hover:bg-blue-50 transition-all font-black text-blue-600 shadow-xl hover:shadow-2xl active:scale-95"
              >
                English
              </button>
              <button 
                onClick={() => { setEquation(prev => ({...prev, language: Language.ES})); setCurrentStep(Step.CHOOSE_MODE); }}
                className="flex-1 max-w-[220px] p-12 bg-white border-2 border-orange-500 rounded-[3rem] hover:bg-orange-50 transition-all font-black text-orange-600 shadow-xl hover:shadow-2xl active:scale-95"
              >
                Español
              </button>
            </div>
          </div>
        );

      case Step.CHOOSE_MODE:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn py-6">
            <button onClick={() => { setEquation(prev => ({...prev, mode: AppMode.FACTORING})); setCurrentStep(Step.CHOOSE_METHOD); }} className="p-14 border-2 border-blue-500 rounded-[3.5rem] hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl group text-center bg-white">
              <i className="fas fa-shapes text-5xl text-blue-500 mb-8 group-hover:scale-110 transition-transform"></i>
              <h3 className="text-3xl font-black text-blue-700">{t("Factoring", "Factorización")}</h3>
            </button>
            <button onClick={() => { setEquation(prev => ({...prev, mode: AppMode.SOLVING})); setCurrentStep(Step.CHOOSE_METHOD); }} className="p-14 border-2 border-emerald-500 rounded-[3.5rem] hover:bg-emerald-50 transition-all shadow-xl hover:shadow-2xl group text-center bg-white">
              <i className="fas fa-key text-5xl text-emerald-500 mb-8 group-hover:scale-110 transition-transform"></i>
              <h3 className="text-3xl font-black text-emerald-700">{t("Solving", "Resolución")}</h3>
            </button>
          </div>
        );

      case Step.CHOOSE_METHOD:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn py-6">
            <button onClick={() => { setEquation(prev => ({...prev, method: FactoringMethod.GROUPING})); setCurrentStep(Step.ENTER_EXPRESSION); }} className="p-12 border-2 border-indigo-500 rounded-[3.5rem] hover:bg-indigo-50 transition-all shadow-xl hover:shadow-2xl group text-center bg-white">
              <i className="fas fa-layer-group text-4xl text-indigo-500 mb-6 group-hover:scale-110 transition-transform"></i>
              <h3 className="text-2xl font-black text-indigo-700">{t("Grouping", "Agrupación")}</h3>
            </button>
            <button onClick={() => { setEquation(prev => ({...prev, method: FactoringMethod.AREA})); setCurrentStep(Step.ENTER_EXPRESSION); }} className="p-12 border-2 border-orange-500 rounded-[3.5rem] hover:bg-orange-50 transition-all shadow-xl hover:shadow-2xl group text-center bg-white">
              <i className="fas fa-table-cells text-4xl text-orange-500 mb-6 group-hover:scale-110 transition-transform"></i>
              <h3 className="text-2xl font-black text-orange-700">{t("Area Model", "Modelo de Área")}</h3>
            </button>
          </div>
        );

      case Step.ENTER_EXPRESSION:
        return (
          <div className="space-y-8 py-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">{t("Enter your quadratic expression", "Ingrese su expresión cuadrática")}</p>
            <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="e.g. 2x^2 + 10x + 12" className="w-full p-8 border-4 border-slate-100 rounded-[3rem] text-4xl font-mono focus:border-blue-500 outline-none shadow-2xl transition-all text-center bg-white" />
          </div>
        );

      case Step.FACTOR_GCF_TOTAL:
        return (
          <div className="space-y-8 py-4">
            <p className="text-sm font-black text-slate-600 text-center leading-relaxed">{t(`Step 1: Divide by GCF if possible (Found GCF: ${equation.totalGcf})`, `Paso 1: Divida por el MCD si es posible (MCD hallado: ${equation.totalGcf})`)}</p>
            <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder={t("e.g. 2(x^2 + 5x + 6)", "ej. 2(x^2 + 5x + 6)")} className="w-full p-8 border-4 border-slate-100 rounded-[3rem] text-3xl font-mono focus:border-blue-500 outline-none shadow-2xl text-center bg-white" />
          </div>
        );

      case Step.IDENTIFY_ABC:
        return (
          <div className="space-y-10 py-4">
            <p className="text-sm font-bold text-slate-500 text-center">{t("Identify a, b, and c inside the GCF parentheses.", "Identifica a, b y c dentro de los paréntesis del MCD.")}</p>
            <div className="flex gap-6 max-w-md mx-auto">
               {['a', 'b', 'c'].map(key => (
                 <div key={key} className="flex-1">
                   <label className="block text-[10px] uppercase font-black text-slate-400 text-center mb-3 tracking-widest">{key}</label>
                   <input className="w-full p-6 border-4 border-slate-100 rounded-[2rem] text-center font-black text-3xl focus:border-blue-500 outline-none shadow-xl bg-white" value={(abcInputs as any)[key]} onChange={e => setAbcInputs({...abcInputs, [key]: e.target.value})} />
                 </div>
               ))}
            </div>
          </div>
        );

      case Step.MULTIPLY_AC:
        return (
          <div className="space-y-8 py-4 text-center">
            <p className="text-sm font-bold text-slate-500">{t("Calculate product a * c.", "Calcula el producto a * c.")}</p>
            <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="a * c" className="w-full max-w-sm p-8 border-4 border-slate-100 rounded-[3rem] text-4xl text-center focus:border-blue-500 outline-none shadow-2xl bg-white mx-auto font-black" />
          </div>
        );

      case Step.FIND_FACTORS:
        const testSum = (parseInt(testFactors.f1) || 0) + (parseInt(testFactors.f2) || 0);
        const testProduct = (parseInt(testFactors.f1) || 0) * (parseInt(testFactors.f2) || 0);
        return (
          <div className="space-y-12">
            <div className="bg-white p-10 rounded-[3.5rem] border-4 border-indigo-50 shadow-2xl relative">
               <h4 className="font-black text-indigo-800 mb-8 flex items-center justify-center gap-4 text-xl">
                 <i className="fas fa-brain"></i> {t("Factor Finder Tool", "Herramienta de Factores")}
               </h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                 <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-4">
                      <input className="w-24 p-5 border-4 border-slate-50 rounded-2xl text-center focus:border-indigo-400 outline-none shadow-sm font-black text-xl" value={testFactors.f1} onChange={e => setTestFactors({...testFactors, f1: e.target.value})} />
                      <span className="text-indigo-300 font-black text-2xl">&times;</span>
                      <input className="w-24 p-5 border-4 border-slate-50 rounded-2xl text-center focus:border-indigo-400 outline-none shadow-sm font-black text-xl" value={testFactors.f2} onChange={e => setTestFactors({...testFactors, f2: e.target.value})} />
                    </div>
                    <div className={`text-[10px] font-black py-2 px-5 rounded-full transition-all tracking-widest uppercase ${testProduct === equation.ac ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>Product: {testProduct} ({equation.ac})</div>
                 </div>
                 <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-4">
                      <span className="w-24 text-center font-black text-indigo-600 text-3xl">{testFactors.f1 || '?'}</span>
                      <span className="text-indigo-300 font-black text-2xl">+</span>
                      <span className="w-24 text-center font-black text-indigo-600 text-3xl">{testFactors.f2 || '?'}</span>
                    </div>
                    <div className={`text-[10px] font-black py-2 px-5 rounded-full transition-all tracking-widest uppercase ${testSum === equation.b ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>Sum: {testSum} ({equation.b})</div>
                 </div>
               </div>
            </div>

            <div className="pt-10 border-t-4 border-slate-50">
              <div className="flex gap-8 mb-12">
                <div className="flex-1">
                  <span className="block text-center text-[10px] font-black text-slate-400 mb-3 tracking-widest uppercase">Factor 1</span>
                  <input placeholder="..." className="w-full p-6 border-4 border-slate-100 rounded-[2rem] text-center text-3xl focus:border-emerald-500 outline-none shadow-xl font-black bg-white" value={finalFactors.f1} onChange={e => setFinalFactors({...finalFactors, f1: e.target.value})} />
                </div>
                <div className="flex-1">
                  <span className="block text-center text-[10px] font-black text-slate-400 mb-3 tracking-widest uppercase">Factor 2</span>
                  <input placeholder="..." className="w-full p-6 border-4 border-slate-100 rounded-[2rem] text-center text-3xl focus:border-emerald-500 outline-none shadow-xl font-black bg-white" value={finalFactors.f2} onChange={e => setFinalFactors({...finalFactors, f2: e.target.value})} />
                </div>
              </div>

              {equation.method === FactoringMethod.AREA && renderAreaModelInputs()}
            </div>
          </div>
        );

      case Step.WORK_METHOD:
        return (
          <div className="space-y-8 animate-fadeIn">
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest text-center">{t("Group & Factor (Show splitting bx)", "Agrupar y factorizar (Mostrar división de bx)")}</p>
            <textarea value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="e.g. (x^2 + 2x) + (3x + 6) = x(x+2) + 3(x+2)" className="w-full h-56 p-8 border-4 border-slate-100 rounded-[3rem] font-mono focus:border-blue-500 outline-none shadow-inner text-xl bg-white leading-relaxed" />
          </div>
        );

      case Step.FINAL_BINOMIALS:
        return (
          <div className="space-y-8">
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest text-center">{t("Final Factored Result", "Resultado Factorizado Final")}</p>
            <div className="bg-amber-50 p-6 rounded-[2.5rem] mb-6 text-amber-800 text-sm border-2 border-amber-100 leading-relaxed shadow-sm">
               <i className="fas fa-exclamation-circle mr-2 text-amber-500"></i>
               {equation.totalGcf > 1 
                 ? t(`Wait! Don't forget your GCF of ${equation.totalGcf}: ${equation.totalGcf}(...)(...)`, `¡Espera! No olvides tu MCD de ${equation.totalGcf}: ${equation.totalGcf}(...)(...)`)
                 : t("Combine your results into the final binomial factors.", "Combine sus resultados en los factores binomiales finales.")}
            </div>
            <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder={equation.totalGcf > 1 ? `${equation.totalGcf}(x+3)(x+2)` : "(x+3)(x+2)"} className="w-full p-8 border-4 border-slate-100 rounded-[3rem] text-4xl text-center focus:border-blue-500 outline-none shadow-2xl font-black text-blue-900 bg-white" />
          </div>
        );

      case Step.SET_TO_ZERO:
        return (
          <div className="space-y-8">
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest text-center">{t("Zero Product Property", "Propiedad del Producto Cero")}</p>
            <div className="bg-slate-50 p-6 rounded-[2.5rem] mb-6 text-slate-600 text-xs border border-slate-100 leading-relaxed text-center font-medium">
               {equation.totalGcf > 1 
                 ? t(`Important: Set all 3 parts to zero: ${equation.totalGcf}=0, (binomial 1)=0, (binomial 2)=0.`, `Importante: Establezca las 3 partes en cero: ${equation.totalGcf}=0, (binomio 1)=0, (binomio 2)=0.`)
                 : t("Set each binomial factor to zero.", "Establezca cada factor binomial en cero.")}
            </div>
            <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder={equation.totalGcf > 1 ? `${equation.totalGcf}=0, x+3=0, x+2=0` : "x+3=0, x+2=0"} className="w-full p-8 border-4 border-slate-100 rounded-[3rem] text-2xl text-center focus:border-blue-500 outline-none shadow-2xl font-black bg-white" />
          </div>
        );

      case Step.SOLVE_LINEAR:
        return (
          <div className="space-y-8">
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest text-center">{t("Solve the Equations", "Resuelva las ecuaciones")}</p>
            <div className="bg-rose-50 p-6 rounded-[2.5rem] mb-6 text-rose-800 text-xs border-2 border-rose-100 leading-relaxed font-bold shadow-sm">
               <i className="fas fa-triangle-exclamation mr-2"></i>
               {t(`If an answer like ${equation.totalGcf}=0 is impossible, type "false" next to it (e.g., ${equation.totalGcf}=0 false).`, `Si una respuesta como ${equation.totalGcf}=0 es imposible, escriba "false" al lado (ej., ${equation.totalGcf}=0 false).`)}
            </div>
            <textarea value={userInput} onChange={e => setUserInput(e.target.value)} placeholder={t("e.g. 2=0 false, x=-3, x=-2", "ej. 2=0 false, x=-3, x=-2")} className="w-full h-40 p-8 border-4 border-slate-100 rounded-[3rem] text-2xl text-center focus:border-blue-500 outline-none shadow-inner font-mono bg-white" />
          </div>
        );

      case Step.ENTER_ZEROS:
        return (
          <div className="space-y-10 text-center">
            <p className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">{t("Final Solution Set (X values)", "Conjunto de Solución Final (Valores de X)")}</p>
            <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="-3, -2" className="w-full p-10 border-8 border-slate-100 rounded-[4rem] text-6xl text-center font-black focus:border-emerald-500 outline-none shadow-2xl transition-all bg-white text-emerald-600" />
            <p className="text-xs text-slate-400 italic">{t("Only include valid solutions (not false ones).", "Incluya solo soluciones válidas (no las falsas).")}</p>
          </div>
        );

      case Step.COMPLETE:
        return (
          <div className="text-center py-10 animate-bounceIn">
            <div className="w-40 h-40 bg-emerald-500 text-white rounded-[4.5rem] flex items-center justify-center mx-auto mb-12 text-7xl shadow-[0_25px_50px_rgba(16,185,129,0.4)] rotate-3">
              <i className="fas fa-star"></i>
            </div>
            <h2 className="text-6xl font-black text-slate-800 mb-6 tracking-tight">{t("Perfect Score!", "¡Puntuación Perfecta!")}</h2>
            <p className="text-slate-500 mb-14 text-2xl font-medium">{t("You have mastered this quadratic equation.", "Has dominado esta ecuación cuadrática.")}</p>
            <button onClick={startOver} className="bg-slate-900 text-white px-20 py-8 rounded-[3.5rem] font-black text-3xl shadow-2xl hover:bg-black active:scale-95 transition-all hover:-translate-y-1">
              {t("New Problem", "Nuevo Problema")}
            </button>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-3xl mb-12 flex justify-between items-center bg-white p-6 rounded-[3rem] shadow-xl border border-slate-100">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl rotate-6 transition-transform hover:rotate-0">
            <i className="fas fa-brain text-2xl"></i>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">QuadraMaster<span className="text-blue-600">.</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="bg-slate-50 px-6 py-3 rounded-3xl border border-slate-100 flex items-center shadow-inner">
             <span className="text-[10px] font-black text-slate-400 mr-3 tracking-widest uppercase">Mastery</span>
             <span className="text-lg font-black text-blue-600">{(stats.correct / (stats.total || 1) * 100).toFixed(0)}%</span>
          </div>
          <button onClick={() => setCurrentStep(Step.CHOOSE_LANGUAGE)} className="w-12 h-12 rounded-[1.5rem] bg-slate-50 border border-slate-100 text-slate-400 hover:text-blue-600 transition-all hover:shadow-lg active:scale-90">
            <i className="fas fa-language text-xl"></i>
          </button>
        </div>
      </header>

      {equation.raw && currentStep < Step.COMPLETE && (
        <div className="w-full max-w-3xl bg-slate-900 text-white p-10 rounded-[4rem] mb-12 shadow-[0_30px_60px_rgba(15,23,42,0.3)] flex flex-col items-center animate-slideDown relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-emerald-500 to-purple-600"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-4 opacity-50">{t("CURRENT CHALLENGE", "DESAFÍO ACTUAL")}</span>
          <div className="text-5xl math-font font-medium tracking-[0.1em] drop-shadow-xl select-none">
            {formatMathDisplay(equation.raw)} {equation.mode === AppMode.SOLVING ? "= 0" : ""}
          </div>
        </div>
      )}

      <main className="w-full max-w-3xl bg-white rounded-[5rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] overflow-hidden border border-slate-50 transition-all duration-700">
        <div className="h-3 bg-slate-50">
          <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_25px_rgba(37,99,235,0.4)]" style={{width: `${(currentStep / 14) * 100}%`}} />
        </div>
        
        <div className="p-10 md:p-20">
          {renderReference()}
          
          <div className="min-h-[350px]">
            {renderStepContent()}
          </div>

          {currentStep >= Step.ENTER_EXPRESSION && currentStep < Step.COMPLETE && (
            <button 
              onClick={validateStep} 
              disabled={isLoadingHint}
              className="w-full mt-16 bg-slate-900 text-white py-9 rounded-[3rem] font-black text-3xl hover:bg-black transition-all active:scale-[0.98] shadow-2xl disabled:opacity-50 relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {isLoadingHint ? (
                <span className="flex items-center justify-center gap-6">
                  <i className="fas fa-spinner animate-spin"></i> {t("Verifying...", "Verificando...")}
                </span>
              ) : t("Validate My Math", "Validar mi resultado")}
            </button>
          )}

          {feedback && (
            <div className={`mt-14 p-10 rounded-[3.5rem] border-4 animate-bounceIn shadow-2xl ${
              feedback.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border-rose-100 text-rose-800 shadow-[inset_0_2px_10px_rgba(225,29,72,0.05)]'
            }`}>
              <div className="flex gap-8">
                <div className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center shrink-0 border-4 shadow-sm ${feedback.type === 'success' ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-rose-100 border-rose-200 text-rose-600'}`}>
                  <i className={`fas ${feedback.type === 'success' ? 'fa-check-double' : 'fa-lightbulb'} text-3xl`}></i>
                </div>
                <div>
                  <p className="font-black text-3xl mb-2 tracking-tight">{feedback.msg}</p>
                  {hint && <p className="text-lg font-medium opacity-80 leading-relaxed italic mt-2 border-t border-current/10 pt-4">{hint}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-20 text-center text-slate-300 text-[10px] uppercase font-black tracking-[0.5em] select-none">
        <p>QuadraMaster AI &bull; Deep Learning Mathematics &bull; Est. 2025</p>
      </footer>
    </div>
  );
};

export default App;

import { createContext, useContext, useState, useCallback } from 'react';
import type {
  AssessmentWizardState,
  StepBasicInput,
  StepFinancialInput,
  LifeEventInput,
  ToleranceAnswer,
  AssessmentResult,
} from '../types/assessment';

const initialBasicInput: StepBasicInput = {
  age: 40,
  retireAge: 60,
};

const initialFinancialInput: StepFinancialInput = {
  currentAssets: 1000,
  annualSavings: 200,
  monthlyExpenses: 25,
  emergencyMonths: 6,
  incomeType: 'stable',
};

const initialLifeEventInput: LifeEventInput = {
  hasChildren: false,
  children: [],
  hasCaregiving: false,
  caregivingYears: 0,
  hasHousingLoan: false,
  housingLoanRemaining: 0,
  otherEvents: [],
};

const initialState: AssessmentWizardState = {
  currentStep: 0,
  hasConsented: false,
  basicInput: initialBasicInput,
  financialInput: initialFinancialInput,
  lifeEventInput: initialLifeEventInput,
  toleranceAnswers: [],
  result: null,
};

interface AssessmentContextType {
  state: AssessmentWizardState;
  setStep: (step: number) => void;
  setConsented: (value: boolean) => void;
  updateBasicInput: (input: Partial<StepBasicInput>) => void;
  updateFinancialInput: (input: Partial<StepFinancialInput>) => void;
  updateLifeEventInput: (input: Partial<LifeEventInput>) => void;
  setToleranceAnswers: (answers: ToleranceAnswer[]) => void;
  setResult: (result: AssessmentResult) => void;
  reset: () => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AssessmentWizardState>(initialState);

  const setStep = useCallback((step: number) => {
    setState((s) => ({ ...s, currentStep: step }));
  }, []);

  const setConsented = useCallback((value: boolean) => {
    setState((s) => ({ ...s, hasConsented: value }));
  }, []);

  const updateBasicInput = useCallback((input: Partial<StepBasicInput>) => {
    setState((s) => ({ ...s, basicInput: { ...s.basicInput, ...input } }));
  }, []);

  const updateFinancialInput = useCallback((input: Partial<StepFinancialInput>) => {
    setState((s) => ({ ...s, financialInput: { ...s.financialInput, ...input } }));
  }, []);

  const updateLifeEventInput = useCallback((input: Partial<LifeEventInput>) => {
    setState((s) => ({ ...s, lifeEventInput: { ...s.lifeEventInput, ...input } }));
  }, []);

  const setToleranceAnswers = useCallback((answers: ToleranceAnswer[]) => {
    setState((s) => ({ ...s, toleranceAnswers: answers }));
  }, []);

  const setResult = useCallback((result: AssessmentResult) => {
    setState((s) => ({ ...s, result }));
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({
      ...initialState,
      hasConsented: s.hasConsented, // keep consent
      currentStep: 1, // skip disclaimer if already consented
    }));
  }, []);

  return (
    <AssessmentContext.Provider
      value={{
        state,
        setStep,
        setConsented,
        updateBasicInput,
        updateFinancialInput,
        updateLifeEventInput,
        setToleranceAnswers,
        setResult,
        reset,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
}

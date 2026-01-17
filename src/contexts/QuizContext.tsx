import { createContext, useContext, useState, ReactNode } from 'react';

export interface QuizAnswer {
  questionId: string;
  value: string | string[];
}

export interface QuizState {
  currentStep: number;
  totalSteps: number;
  answers: QuizAnswer[];
  isComplete: boolean;
}

interface QuizContextType {
  state: QuizState;
  setAnswer: (questionId: string, value: string | string[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  complete: () => void;
  reset: () => void;
  getAnswer: (questionId: string) => string | string[] | undefined;
}

const initialState: QuizState = {
  currentStep: 0,
  totalSteps: 5,
  answers: [],
  isComplete: false,
};

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuizState>(initialState);

  const setAnswer = (questionId: string, value: string | string[]) => {
    setState(prev => {
      const existingIndex = prev.answers.findIndex(a => a.questionId === questionId);
      const newAnswers = [...prev.answers];
      
      if (existingIndex >= 0) {
        newAnswers[existingIndex] = { questionId, value };
      } else {
        newAnswers.push({ questionId, value });
      }
      
      return { ...prev, answers: newAnswers };
    });
  };

  const nextStep = () => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.totalSteps - 1),
    }));
  };

  const prevStep = () => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  };

  const goToStep = (step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(0, Math.min(step, prev.totalSteps - 1)),
    }));
  };

  const complete = () => {
    setState(prev => ({ ...prev, isComplete: true }));
  };

  const reset = () => {
    setState(initialState);
  };

  const getAnswer = (questionId: string) => {
    return state.answers.find(a => a.questionId === questionId)?.value;
  };

  return (
    <QuizContext.Provider
      value={{
        state,
        setAnswer,
        nextStep,
        prevStep,
        goToStep,
        complete,
        reset,
        getAnswer,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}

export default QuizContext;

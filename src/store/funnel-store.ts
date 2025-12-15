import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
type Answer = string | string[];
interface FunnelState {
  currentStep: number;
  answers: Record<string, Answer>;
  language: string;
  setLanguage: (lang: string) => void;
  setAnswer: (questionId: string, answer: Answer) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}
export const useFunnelStore = create<FunnelState>()(
  persist(
    (set) => ({
      currentStep: 0,
      answers: {},
      language: 'de',
      setLanguage: (lang) => set({ language: lang }),
      setAnswer: (questionId, answer) =>
        set((state) => ({
          answers: { ...state.answers, [questionId]: answer },
        })),
      nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
      prevStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),
      reset: () => set({ currentStep: 0, answers: {} }),
    }),
    {
      name: 'security-check-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
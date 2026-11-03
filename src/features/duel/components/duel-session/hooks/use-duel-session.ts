"use client";

import { useState, useTransition } from "react";
import type { PlayableQuestion } from "@/engine/questions";
import { answerQuestion } from "../../../actions";
import type { AnswerFeedback } from "../../../types";

export interface UseDuelSessionReturn {
  index: number;
  question: PlayableQuestion | null;
  chosen: string[];
  feedback: AnswerFeedback | null;
  error: string | null;
  isPending: boolean;
  score: number;
  answered: number;
  finished: boolean;
  canSubmit: boolean;
  toggle: (optionId: string) => void;
  submit: () => void;
  next: () => void;
}

export function useDuelSession(
  packSlug: string,
  questions: PlayableQuestion[],
): UseDuelSessionReturn {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [isPending, startTransition] = useTransition();

  const question = questions[index] ?? null;
  const finished = index >= questions.length;

  const toggle = (optionId: string): void => {
    if (!question || feedback) return;
    if (question.select === 1) setChosen([optionId]);
    else
      setChosen((c) =>
        c.includes(optionId)
          ? c.filter((x) => x !== optionId)
          : [...c, optionId],
      );
  };

  const submit = (): void => {
    if (!question || feedback || chosen.length !== question.select) return;
    startTransition(async () => {
      const result = await answerQuestion(packSlug, question.id, chosen);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setFeedback(result.feedback);
      setAnswered((n) => n + 1);
      if (result.feedback.correct) setScore((n) => n + 1);
    });
  };

  const next = (): void => {
    setIndex((i) => i + 1);
    setChosen([]);
    setFeedback(null);
    setError(null);
  };

  return {
    index,
    question,
    chosen,
    feedback,
    error,
    isPending,
    score,
    answered,
    finished,
    canSubmit:
      Boolean(question) &&
      chosen.length === question?.select &&
      !feedback &&
      !isPending,
    toggle,
    submit,
    next,
  };
}

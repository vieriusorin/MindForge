export interface JoinCardProps {
  joinAction: () => Promise<void>;
  invalid: boolean;
}

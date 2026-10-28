import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const fieldBase =
  'w-full rounded-[var(--radius-control)] border border-rule-strong bg-surface text-ink placeholder:text-ink-faint aria-[invalid=true]:border-danger disabled:bg-paper';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-12 px-3.5 text-base', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(fieldBase, 'min-h-32 px-3.5 py-3 text-base leading-relaxed', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

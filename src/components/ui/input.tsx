import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'flex h-10 w-full rounded-lg border border-[#E1E7EF] bg-white px-3 py-2 text-[13px] text-[#172033] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors',
                    'placeholder:text-[#98A2B3]',
                    'hover:border-[#CBD5E1]',
                    'focus-visible:outline-none focus-visible:border-[#1e3a5f] focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/15',
                    'disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-60',
                    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                    className,
                )}
                ref={ref}
                {...props}
            />
        );
    },
);
Input.displayName = 'Input';

export { Input };

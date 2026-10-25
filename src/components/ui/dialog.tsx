'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'fixed inset-0 z-120 bg-slate-950/50 backdrop-blur-[2px]',
            className,
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
        showClose?: boolean;
    }
>(({ className, children, showClose = true, ...props }, ref) => (
    <DialogPortal>
        {/* Plain div so the backdrop also renders when the dialog is non-modal (Radix's Overlay renders nothing then). */}
        <div className="fixed inset-0 z-120 bg-slate-950/50 backdrop-blur-[2px]" aria-hidden />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed left-1/2 top-1/2 z-121 flex w-[min(780px,calc(100%-2rem))] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_28px_64px_rgba(15,23,42,0.28)]',
                className,
            )}
            {...props}
        >
            {children}
            {showClose ? (
                <DialogPrimitive.Close
                    className="absolute right-4 top-4 rounded-md p-1.5 text-[#98A2B3] transition-colors hover:bg-[#F1F5F9] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/25"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" strokeWidth={1.8} />
                </DialogPrimitive.Close>
            ) : null}
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('flex flex-col gap-1 border-b border-[#EDF1F6] px-6 py-5 pr-12', className)}
            {...props}
        />
    );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'flex shrink-0 items-center justify-end gap-2.5 border-t border-[#E8EEF5] bg-[#F8FAFC] px-6 py-4',
                className,
            )}
            {...props}
        />
    );
}

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('grid flex-1 gap-4 overflow-y-auto px-6 py-5', className)}
            {...props}
        />
    );
}

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-[15px] font-bold tracking-tight text-[#101828]', className)}
        {...props}
    />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-[12.5px] text-[#667085]', className)}
        {...props}
    />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogBody,
    DialogTitle,
    DialogDescription,
};

/* eslint-disable react/prop-types */
import React from 'react';
import { cn } from '../utils/cn';
import { Loader2, ChevronDown, X } from 'lucide-react';

// --- Button ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    const variants = {
      primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-500/30 border border-transparent",
      secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
      danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
      ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-transparent",
      outline: "border border-primary-600 text-primary-600 hover:bg-primary-50"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2.5 text-sm",
      lg: "px-6 py-3 text-base"
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-95",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// --- Card ---
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm p-4", className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

// --- Badge ---
export const Badge = ({ children, className, variant = 'neutral' }: { children: React.ReactNode, className?: string, variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }) => {
  const variants = {
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
    success: "bg-emerald-100 text-emerald-700 border-emerald-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    danger: "bg-red-100 text-red-700 border-red-200",
    primary: "bg-primary-100 text-primary-700 border-primary-200"
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border tracking-wide", variants[variant], className)}>
      {children}
    </span>
  );
};

// --- Input ---
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
);
Input.displayName = 'Input';

// --- Label ---
export const Label = ({ children, className, required }: { children: React.ReactNode, className?: string, required?: boolean }) => (
  <label className={cn("text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block", className)}>
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

// --- Select ---
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all pr-8",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  )
);
Select.displayName = 'Select';

// --- Modal ---
export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Loading State ---
export const PageLoader = () => (
  <div className="h-full flex items-center justify-center bg-slate-50">
    <Loader2 className="animate-spin text-primary-600 w-8 h-8" />
  </div>
);

// --- Empty State ---
export const EmptyState = ({ icon: Icon, message }: { icon: React.ElementType, message: string }) => (
  <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
    <Icon className="w-10 h-10 mb-3 opacity-20" />
    <p className="text-sm">{message}</p>
  </div>
);
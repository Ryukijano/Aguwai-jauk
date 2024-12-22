import React from 'react';
import { clsx } from 'clsx';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly string[];
  placeholder?: string;
}

export function Select({ 
  options, 
  placeholder, 
  className, 
  ...props 
}: SelectProps) {
  return (
    <select
      className={clsx(
        "block w-full rounded-md border-gray-300 shadow-sm",
        "focus:border-indigo-500 focus:ring-indigo-500",
        "text-gray-700",
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
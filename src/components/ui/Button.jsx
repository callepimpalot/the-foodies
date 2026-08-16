import React from 'react';

const VARIANT_CLASS = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    destructive: 'btn-destructive',
};

export function Button({ variant = 'primary', className = '', children, ...props }) {
    const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
    return (
        <button className={`${variantClass} ${className}`.trim()} {...props}>
            {children}
        </button>
    );
}

export function StampButton({ className = '', children, ...props }) {
    return (
        <button className={`btn-stamp ${className}`.trim()} {...props}>
            {children}
        </button>
    );
}

export function IconButton({ className = '', children, ...props }) {
    return (
        <button className={`icon-btn ${className}`.trim()} {...props}>
            {children}
        </button>
    );
}

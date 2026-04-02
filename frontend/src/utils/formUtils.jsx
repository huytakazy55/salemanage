import { useState, useEffect, useRef } from 'react';

/**
 * CurrencyInput — auto-format số tiền VND với dấu phân cách nghìn
 * value: số nguyên (number | string)
 * onChange(rawNumber): callback với số thô (number hoặc '')
 */
export function CurrencyInput({ value, onChange, className = 'form-control', placeholder = '0', style = {}, disabled, id, name, ref: _ref, ...rest }) {
    const [focused, setFocused] = useState(false);
    const [display, setDisplay] = useState('');
    const inputRef = useRef();

    // Khi value thay đổi từ ngoài và input không đang focus
    useEffect(() => {
        if (!focused) {
            if (value === '' || value === null || value === undefined) {
                setDisplay('');
            } else {
                const n = Number(String(value).replace(/\./g, '').replace(/,/g, '').replace(/[^\d]/g, ''));
                setDisplay(isNaN(n) || n === 0 ? (String(value) === '0' ? '0' : '') : n.toLocaleString('vi-VN'));
            }
        }
    }, [value, focused]);

    const handleFocus = () => {
        setFocused(true);
        // Show raw digits for easy editing
        const raw = String(value || '').replace(/[^\d]/g, '');
        setDisplay(raw === '0' ? '' : raw);
    };

    const handleChange = (e) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        setDisplay(raw);
        onChange(raw === '' ? '' : parseInt(raw, 10));
    };

    const handleBlur = () => {
        setFocused(false);
        const raw = display.replace(/[^\d]/g, '');
        if (!raw) {
            setDisplay('');
            onChange('');
        } else {
            const n = parseInt(raw, 10);
            setDisplay(n.toLocaleString('vi-VN'));
            onChange(n);
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className={className}
            style={style}
            value={display}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            id={id}
            name={name}
            {...rest}
        />
    );
}

/** Dấu * bắt buộc màu đỏ */
export function Req() {
    return <span className="req-star">*</span>;
}

/**
 * useFormValidate — validate required fields
 * rules: { fieldName: { value, message? } }
 * Returns { errors, validate(rules), clearError(field) }
 */
export function useFormValidate() {
    const [errors, setErrors] = useState({});

    const validate = (rules) => {
        const newErrors = {};
        Object.entries(rules).forEach(([field, { value, message }]) => {
            const isEmpty = value === '' || value === null || value === undefined;
            if (isEmpty) newErrors[field] = message || 'Trường này là bắt buộc';
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const clearError = (field) => setErrors(e => {
        const n = { ...e };
        delete n[field];
        return n;
    });

    return { errors, validate, clearError };
}

/** Render error message dưới field */
export function FieldError({ error }) {
    if (!error) return null;
    return <div className="form-error">⚠ {error}</div>;
}

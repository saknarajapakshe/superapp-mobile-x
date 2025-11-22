import { useState, KeyboardEvent, CSSProperties } from 'react';
import { X, Plus } from 'lucide-react';
import { AutocompleteInput } from './AutocompleteInput';
import { Group } from '../types';

interface MultiEmailInputProps {
    emails: string[];
    onChange: (emails: string[]) => void;
    suggestions: string[];
    groups?: Group[];
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MultiEmailInput = ({
    emails,
    onChange,
    suggestions,
    groups = [],
    disabled,
    placeholder = "Add recipients...",
    className,
}: MultiEmailInputProps) => {
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState('');

    const validateEmail = (email: string) => EMAIL_REGEX.test(email.trim());

    const addEmail = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;

        // Check if value matches a group name
        const matchedGroup = groups.find(g => g.name.toLowerCase() === trimmed.toLowerCase());
        if (matchedGroup) {
            const newEmails = [...emails];
            let addedCount = 0;

            matchedGroup.recipients.forEach(email => {
                if (!newEmails.includes(email.toLowerCase())) {
                    newEmails.push(email.toLowerCase());
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                onChange(newEmails);
                setInputValue('');
                setError('');
            } else {
                setError('All members already added');
            }
            return;
        }

        // If not a group, validate as email
        const email = trimmed.toLowerCase();
        if (!validateEmail(email)) return setError('Invalid email format');
        if (emails.includes(email)) return setError('Email already added');
        onChange([...emails, email]);
        setInputValue('');
        setError('');
    };

    const removeEmail = (emailToRemove: string) => {
        onChange(emails.filter(e => e !== emailToRemove));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addEmail(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && emails.length) {
            removeEmail(emails[emails.length - 1]);
        }
    };

    const handleAutocompleteChange = (value: string) => {
        setInputValue(value);
        setError('');

        // Check if value matches a group name
        const matchedGroup = groups.find(g => g.name.toLowerCase() === value.toLowerCase());
        if (matchedGroup) {
            // Add all recipients from the group
            const newEmails = [...emails];
            let addedCount = 0;

            matchedGroup.recipients.forEach(email => {
                if (!newEmails.includes(email.toLowerCase())) {
                    newEmails.push(email.toLowerCase());
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                onChange(newEmails);
                setInputValue('');
            } else {
                setError('All members already added');
            }
            return;
        }

        if (suggestions.some(s => s.toLowerCase() === value.toLowerCase())) {
            addEmail(value);
        }
    };

    // Combine suggestions with group names
    const allSuggestions = [
        ...groups.map(g => g.name),
        ...suggestions
    ];

    // Inline style objects (vanilla CSS)
    const containerStyle: CSSProperties = {
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: '#f0f9ff', // light blue
        borderRadius: '8px',
        border: '1px solid #cce5ff',
    };

    const chipStyle: CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: '#2563eb', // primary-600
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        marginRight: '6px',
        marginBottom: '6px',
    };

    const removeBtnStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        cursor: 'pointer',
    };

    return (
        <div className={className}>
            {emails.length > 0 && (
                <div style={containerStyle}>
                    {emails.map(email => (
                        <div key={email} style={chipStyle}>
                            <span>{email}</span>
                            {!disabled && (
                                <div
                                    style={removeBtnStyle}
                                    onClick={() => removeEmail(email)}
                                >
                                    <X size={12} color="#fff" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ marginBottom: '8px' }}>
                <AutocompleteInput
                    value={inputValue}
                    onChange={handleAutocompleteChange}
                    suggestions={allSuggestions.filter(s => !emails.includes(s.toLowerCase()))}
                    placeholder={emails.length ? 'Add another...' : placeholder}
                    disabled={disabled}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    onKeyDown={handleKeyDown}
                />
            </div>

            {inputValue && !disabled && (
                <div className="mt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() => addEmail(inputValue)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                    >
                        <Plus size={16} />
                        <span className="text-sm font-semibold">Add</span>
                    </button>
                </div>
            )}

            {error && (
                <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>
            )}
        </div>
    );
};

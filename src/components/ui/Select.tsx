import React, { useEffect, useRef, useState } from 'react';

interface Option<T extends string | number> { value: T; label: string }
interface Props<T extends string | number> {
	value: T;
	options: Option<T>[];
	onChange: (v: T) => void;
	ariaLabel?: string;
}

export function Select<T extends string | number>({ value, options, onChange, ariaLabel }: Props<T>) {
	const [open, setOpen] = useState(false);
	const btnRef = useRef<HTMLButtonElement | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (!listRef.current || !btnRef.current) return;
			if (!listRef.current.contains(e.target as Node) && !btnRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, []);

	const selected = options.find(o => o.value === value);

	return (
		<div className="relative">
			<button 
				ref={btnRef} 
				type="button" 
				aria-haspopup="listbox" 
				aria-expanded={open} 
				aria-label={ariaLabel} 
				onClick={() => setOpen(v => !v)} 
				className="inline-flex items-center gap-2 px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[7rem] whitespace-nowrap"
			>
				<span>{selected?.label ?? ''}</span>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			</button>
			{open && (
				<div ref={listRef} role="listbox" className="absolute z-50 mt-2 min-w-[8rem] border rounded-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-lg">
					{options.map(opt => (
						<button 
							key={String(opt.value)} 
							role="option" 
							aria-selected={opt.value === value} 
							className={`block w-full text-left px-3 py-2 text-sm font-mono transition-colors ${
								opt.value === value 
									? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100' 
									: 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
							}`} 
							onClick={() => { onChange(opt.value); setOpen(false); }}
						>
							{opt.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
} 
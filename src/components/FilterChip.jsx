import React from 'react';
import { Chip } from './ui/Chip';

export function FilterChip({ label, active, onClick }) {
    return <Chip variant="filter" label={label} active={active} onClick={onClick} />;
}

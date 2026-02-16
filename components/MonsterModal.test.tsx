import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import MonsterModal from './MonsterModal';
import { Monster } from '../types';

const mockMonster: Monster = {
    id: '456',
    name: 'Plasma Wolf',
    originalObject: 'Stapler',
    types: ['Electric', 'Steel'],
    lore: 'Forged from office supplies.',
    moves: [
        { name: 'Staple Storm', power: 75, description: 'Launches a barrage of staples.' },
        { name: 'Paper Cut', power: 40, description: 'A precise slicing attack.' },
    ],
    imageUrl: 'https://example.com/wolf.png',
    capturedAt: Date.now()
};

describe('MonsterModal Component', () => {
    it('renders monster name and lore', () => {
        render(<MonsterModal monster={mockMonster} onClose={() => { }} />);

        expect(screen.getByText('Plasma Wolf')).toBeTruthy();
        expect(screen.getByText(/Forged from office supplies/i)).toBeTruthy();
    });

    it('has correct ARIA dialog attributes', () => {
        render(<MonsterModal monster={mockMonster} onClose={() => { }} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeTruthy();
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-labelledby')).toBe('modal-title');
    });

    it('displays all moves with power bars', () => {
        render(<MonsterModal monster={mockMonster} onClose={() => { }} />);

        expect(screen.getByText('Staple Storm')).toBeTruthy();
        expect(screen.getByText('Paper Cut')).toBeTruthy();
        expect(screen.getByText('PWR 75')).toBeTruthy();
        expect(screen.getByText('PWR 40')).toBeTruthy();
    });

    it('triggers onClose when backdrop is clicked', () => {
        const handleClose = vi.fn();
        render(<MonsterModal monster={mockMonster} onClose={handleClose} />);

        const dialog = screen.getByRole('dialog');
        fireEvent.click(dialog);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('triggers onClose when close button is clicked', () => {
        const handleClose = vi.fn();
        render(<MonsterModal monster={mockMonster} onClose={handleClose} />);

        const closeBtn = screen.getByLabelText('Close Neural Log');
        fireEvent.click(closeBtn);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('displays type badges', () => {
        render(<MonsterModal monster={mockMonster} onClose={() => { }} />);

        expect(screen.getByText('Electric')).toBeTruthy();
        expect(screen.getByText('Steel')).toBeTruthy();
    });
});

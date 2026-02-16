import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TutorialOverlay from './TutorialOverlay';

describe('TutorialOverlay Component', () => {
    it('renders tutorial steps', () => {
        render(<TutorialOverlay onDismiss={() => { }} />);

        expect(screen.getByText('OPTICS LINK')).toBeTruthy();
        expect(screen.getByText('NEURAL FIXATION')).toBeTruthy();
        expect(screen.getByText('VERTEX SYNTHESIS')).toBeTruthy();
        expect(screen.getByText('DATA RECOVERY')).toBeTruthy();
    });

    it('renders step numbers', () => {
        render(<TutorialOverlay onDismiss={() => { }} />);

        expect(screen.getByText('01')).toBeTruthy();
        expect(screen.getByText('02')).toBeTruthy();
        expect(screen.getByText('03')).toBeTruthy();
        expect(screen.getByText('04')).toBeTruthy();
    });

    it('triggers onDismiss when initialize button is clicked', () => {
        const handleDismiss = vi.fn();
        render(<TutorialOverlay onDismiss={handleDismiss} />);

        const button = screen.getByText('System Initialize');
        fireEvent.click(button);

        expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('displays operation title', () => {
        render(<TutorialOverlay onDismiss={() => { }} />);

        expect(screen.getByText('OPERATION LEXICON')).toBeTruthy();
    });
});

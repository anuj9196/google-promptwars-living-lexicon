import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ScannerOverlay from './ScannerOverlay';

describe('ScannerOverlay Component', () => {
    it('renders in idle state with standby text', () => {
        render(<ScannerOverlay />);

        expect(screen.getByText(/Link_Awaiting_Hold/)).toBeTruthy();
        expect(screen.getByText(/Target_Locked: \[False\]/)).toBeTruthy();
    });

    it('renders in fixating state with sync text', () => {
        render(<ScannerOverlay isFixating={true} progress={45} />);

        expect(screen.getByText(/Target_Locked: \[True\]/)).toBeTruthy();
        expect(screen.getByText(/Syncing_45.0%/)).toBeTruthy();
    });

    it('shows correct status for fixating mode', () => {
        render(<ScannerOverlay isFixating={true} progress={0} />);

        expect(screen.getByText(/Status: \[Syncing...\]/)).toBeTruthy();
    });

    it('shows standby status when not fixating', () => {
        render(<ScannerOverlay isFixating={false} />);

        expect(screen.getByText(/Status: \[Standby\]/)).toBeTruthy();
    });
});

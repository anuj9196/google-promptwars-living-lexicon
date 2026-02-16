
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import MonsterCard from './MonsterCard';
import { Monster } from '../types';

const mockMonster: Monster = {
  id: '123',
  name: 'Neon Drake',
  originalObject: 'Lamp',
  types: ['Light', 'Dragon'],
  lore: 'Born from LED rays.',
  moves: [],
  imageUrl: 'https://example.com/img.png',
  capturedAt: Date.now()
};

describe('MonsterCard Component', () => {
  it('renders monster details correctly', () => {
    render(<MonsterCard monster={mockMonster} onClick={() => {}} />);
    
    expect(screen.getByText('Neon Drake')).toBeTruthy();
    expect(screen.getByText(/Lamp/i)).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dragon')).toBeTruthy();
  });

  it('has correct ARIA attributes for accessibility', () => {
    render(<MonsterCard monster={mockMonster} onClick={() => {}} />);
    const card = screen.getByRole('button');
    
    expect(card.getAttribute('aria-label')).toContain('Neon Drake');
    expect(card.getAttribute('aria-label')).toContain('Lamp');
  });

  it('triggers onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<MonsterCard monster={mockMonster} onClick={handleClick} />);
    
    const card = screen.getByRole('button');
    fireEvent.click(card);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick when Enter key is pressed', () => {
    const handleClick = vi.fn();
    render(<MonsterCard monster={mockMonster} onClick={handleClick} />);
    
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

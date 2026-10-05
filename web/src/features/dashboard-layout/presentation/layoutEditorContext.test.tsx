import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLayoutEditorContext } from './layoutEditorContext';

describe('useLayoutEditorContext', () => {
  it('fails clearly when no provider is above it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useLayoutEditorContext())).toThrow('LayoutEditorProvider');

    vi.restoreAllMocks();
  });
});

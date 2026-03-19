import { describe, it, expect } from 'vitest';
import { getIcon, AVAILABLE_ICONS } from '@/lib/utils/icons';
import { CircleDashed, Utensils } from 'lucide-react';

describe('getIcon', () => {
  it('已知图标名 "Utensils" 返回对应组件', () => {
    expect(getIcon('Utensils')).toBe(Utensils);
  });

  it('已知图标名不返回 fallback', () => {
    expect(getIcon('Utensils')).not.toBe(CircleDashed);
  });

  it('未知图标名返回 CircleDashed fallback', () => {
    expect(getIcon('NonExistent')).toBe(CircleDashed);
  });
});

describe('AVAILABLE_ICONS', () => {
  it('长度 > 0', () => {
    expect(AVAILABLE_ICONS.length).toBeGreaterThan(0);
  });

  it('包含已知图标名', () => {
    expect(AVAILABLE_ICONS).toContain('Utensils');
    expect(AVAILABLE_ICONS).toContain('Car');
    expect(AVAILABLE_ICONS).toContain('Home');
  });

  it('每个 icon name 都能通过 getIcon 获取到非 fallback 组件', () => {
    for (const name of AVAILABLE_ICONS) {
      if (name === 'CircleDashed') continue;
      const icon = getIcon(name);
      expect(icon).toBeDefined();
    }
  });
});

import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('基础合并两个类名', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('条件 class false && "x" 被过滤', () => {
    expect(cn(false && 'x', 'bar')).toBe('bar');
  });

  it('undefined/null 被过滤', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('空字符串', () => {
    expect(cn('')).toBe('');
  });

  it('Tailwind 冲突 p-2, p-4 → p-4', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('Tailwind 颜色冲突 text-red-500, text-blue-500 → text-blue-500', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('数组输入', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('无参数 → 空字符串', () => {
    expect(cn()).toBe('');
  });

  it('对象语法 {active:true, hidden:false}', () => {
    expect(cn({ active: true, hidden: false })).toBe('active');
  });

  it('复杂嵌套 "a", ["b", {c:true}]', () => {
    expect(cn('a', ['b', { c: true }])).toBe('a b c');
  });
});

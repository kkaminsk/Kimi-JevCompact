import { describe, expect, it } from 'vitest';

describe('toolchain smoke', () => {
  it('resolves the fast-jev-compaction library', async () => {
    const lib = await import('fast-jev-compaction');
    expect(lib.compact).toBeTypeOf('function');
  });

  it('exposes the Jev transport helpers', async () => {
    const lib = await import('fast-jev-compaction');
    expect(lib.buildJevRequest).toBeTypeOf('function');
    expect(lib.parseJevResponse).toBeTypeOf('function');
  });
});

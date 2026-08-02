import { CredentialHolder, CredentialsClearedError } from './credential-holder';

describe('CredentialHolder', () => {
  it('hands the fields to consume() while not cleared', () => {
    const holder = new CredentialHolder({ rut: 'ZZSENTINELRUTZZ', password: 'ZZSENTINELPASSZZ' });
    const seen = holder.consume((fields) => ({ ...fields }));
    expect(seen).toEqual({ rut: 'ZZSENTINELRUTZZ', password: 'ZZSENTINELPASSZZ' });
    expect(holder.isCleared()).toBe(false);
  });

  it('throws CredentialsClearedError from consume() after clear()', () => {
    const holder = new CredentialHolder({ rut: 'r', password: 'p' });
    holder.clear();
    expect(holder.isCleared()).toBe(true);
    expect(() => holder.consume((fields) => fields)).toThrow(CredentialsClearedError);
  });

  it('clear() is idempotent', () => {
    const holder = new CredentialHolder({ rut: 'r', password: 'p' });
    holder.clear();
    expect(() => holder.clear()).not.toThrow();
    expect(holder.isCleared()).toBe(true);
  });

  it('does not expose the fields via Object.keys or a spread on the holder itself', () => {
    const holder = new CredentialHolder({ rut: 'r', password: 'p' });
    expect(Object.keys(holder)).toEqual([]);
    expect({ ...holder }).toEqual({});
  });

  it('constructor copies the input object rather than holding the caller reference', () => {
    const input = { rut: 'r', password: 'p' };
    const holder = new CredentialHolder(input);
    input.rut = 'mutated';
    holder.consume((fields) => {
      expect(fields.rut).toBe('r');
    });
  });

  it('passes a frozen copy to consume(), not the internal object itself (CodeRabbit finding #31)', () => {
    const holder = new CredentialHolder({ rut: 'r', password: 'p' });
    let capturedReference: Readonly<Record<string, string>> | null = null;
    holder.consume((fields) => {
      capturedReference = fields;
      expect(Object.isFrozen(fields)).toBe(true);
      expect(() => {
        (fields as Record<string, string>).rut = 'tampered';
      }).toThrow();
    });
    // A second call must not observe any mutation attempted (and thrown) during the first —
    // proves the frozen copy is not a shared, mutable reference held across calls.
    holder.consume((fields) => {
      expect(fields.rut).toBe('r');
      expect(fields).not.toBe(capturedReference);
    });
  });
});

/**
 * Tests for library entry point re-exports.
 */
import { describe, expect, test } from 'bun:test';
import * as tmesh from '../index';

describe('library entry point', () => {
  test('exports type constructors', () => {
    expect(typeof tmesh.SessionName).toBe('function');
    expect(typeof tmesh.Identity).toBe('function');
  });

  test('exports Result helpers', () => {
    expect(typeof tmesh.Ok).toBe('function');
    expect(typeof tmesh.Err).toBe('function');
  });

  test('exports discovery functions', () => {
    expect(typeof tmesh.discover).toBe('function');
    expect(typeof tmesh.parseTmuxSessions).toBe('function');
    expect(typeof tmesh.parseTmuxPanes).toBe('function');
    expect(typeof tmesh.discoverNodes).toBe('function');
  });

  test('exports identity functions', () => {
    expect(typeof tmesh.readIdentity).toBe('function');
    expect(typeof tmesh.writeIdentity).toBe('function');
    expect(typeof tmesh.identify).toBe('function');
    expect(typeof tmesh.ensureHome).toBe('function');
    expect(typeof tmesh.resolveSessionIdentity).toBe('function');
  });

  test('exports signal functions', () => {
    expect(typeof tmesh.generateUlid).toBe('function');
    expect(typeof tmesh.isValidUlid).toBe('function');
    expect(typeof tmesh.createSignal).toBe('function');
  });

  test('exports resolveHome', () => {
    expect(typeof tmesh.resolveHome).toBe('function');
  });
});

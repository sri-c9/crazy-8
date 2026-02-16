import { test, expect } from '@playwright/test';

/**
 * Security tests - Bug 3 (Path Traversal Protection)
 *
 * Verifies that the server only serves files from the public/ directory
 * and blocks path traversal attempts.
 */

test.describe('Security - Path Traversal Protection', () => {
  test('should block path traversal attempts to parent directory', async ({ request }) => {
    // Attempt to access server.ts via path traversal
    const response = await request.get('/../server.ts');

    // Server should return non-200 status (404 or error)
    expect(response.status()).not.toBe(200);
  });

  test('should serve valid files from public directory', async ({ request }) => {
    // Request the root page
    const response = await request.get('/');

    // Should return 200 OK
    expect(response.status()).toBe(200);

    // Should contain expected content
    const body = await response.text();
    expect(body).toContain('Insane Crazy 8');
  });

  test('should return 404 for non-existent files', async ({ request }) => {
    // Request a file that doesn't exist
    const response = await request.get('/nonexistent.html');

    // Should return 404
    expect(response.status()).toBe(404);
  });

  test('should block attempts to access TypeScript source files', async ({ request }) => {
    // Even without path traversal, TS files shouldn't be served
    const response = await request.get('/server.ts');

    // Should return non-200 (404 since it's not in public/)
    expect(response.status()).toBe(404);
  });
});

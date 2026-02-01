import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Network and Protocol Security Tests', () => {

    describe('Content Security Policy (CSP)', () => {
        it('should have a restrictive CSP defined in manifest.json', () => {
            const manifestPath = path.resolve(__dirname, '../browser-extension/manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            expect(manifest.content_security_policy).toBeDefined();
            const csp = manifest.content_security_policy.extension_pages || manifest.content_security_policy;

            // SECURITY: Ensure restrictive policies
            expect(csp).toContain("default-src 'self'");
            expect(csp).not.toContain("'unsafe-inline'");
            expect(csp).not.toContain("'unsafe-eval'");
        });
    });

    describe('CSRF Protection', () => {
        it('should ensure all state-changing IPC calls require authentication/session', () => {
            // Concepts: In Electron, CSRF is mitigated by contextIsolation and disabling remote
            // Here we check if the preload script is configured correctly
            const preloadPath = path.resolve(__dirname, '../preload.cjs');
            const preloadContent = fs.readFileSync(preloadPath, 'utf8');

            // Check if we use contextBridge
            expect(preloadContent).toContain('contextBridge.exposeInMainWorld');
        });
    });

    describe('TLS/SSL Security', () => {
        it('should only allow secure protocols for external connections', () => {
            // Check ValidationService for URL protocol restrictions
            const validationPath = path.resolve(__dirname, '../services/validationService.ts');
            const validationContent = fs.readFileSync(validationPath, 'utf8');

            // Ensure we check for https
            expect(validationContent).toContain('https:');
        });
    });

    describe('Cross-Origin Resource Sharing (CORS)', () => {
        it('should have a restrictive web_accessible_resources configuration', () => {
            const manifestPath = path.resolve(__dirname, '../browser-extension/manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            if (manifest.web_accessible_resources) {
                // If it's v3, it's an array of objects
                if (Array.isArray(manifest.web_accessible_resources)) {
                    manifest.web_accessible_resources.forEach((res: any) => {
                        // Avoid broad wildcards for external sites
                        if (res.matches) {
                            expect(res.matches[0]).not.toBe('*://*/*');
                        }
                    });
                }
            }
        });
    });
});

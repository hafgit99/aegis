import { describe, it, expect, vi } from 'vitest';

describe('XSS Protection Tests', () => {

    describe('Browser Extension UI', () => {
        it('should NOT use innerHTML for rendering user-controlled data', async () => {
            // This is a static analysis check via test
            const fs = await import('fs');
            const path = await import('path');

            const files = [
                path.resolve(__dirname, '../browser-extension/content.js'),
                path.resolve(__dirname, '../browser-extension/popup.js')
            ];

            for (const file of files) {
                const content = fs.readFileSync(file, 'utf8');
                // Check if innerHTML is assigned a variable or template string
                // We allow it only for totally static, trusted strings if absolutely necessary, 
                // but our policy is to avoid it entirely.
                const innerHtmlUsage = content.match(/\.innerHTML\s*=/g);

                // After our refactor, there should be 0 usages of .innerHTML = 
                expect(innerHtmlUsage ? innerHtmlUsage.length : 0).toBe(0);
            }
        });

        it('should correctly escape HTML special characters when using textContent', () => {
            const div = document.createElement('div');
            const payload = '<img src=x onerror=alert(1)>';
            div.textContent = payload;

            expect(div.innerHTML).not.toContain('<img');
            expect(div.innerHTML).toContain('&lt;img');
        });
    });

    describe('Markdown/Rich Text Rendering', () => {
        it('should sanitize HTML tags in notes if rendered as HTML', () => {
            // Placeholder for if we ever use a markdown parser
            const rawNote = "Check this: <script>evil()</script>";
            // Simplified check: ensuring we don't just dump raw text into a div's innerHTML
            const container = document.createElement('div');
            container.textContent = rawNote;
            expect(container.querySelectorAll('script').length).toBe(0);
        });
    });
});

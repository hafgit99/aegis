import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmergencyService, EmergencyContact } from '../services/emergencyService';

describe('Emergency Access Workflow Tests', () => {

    beforeEach(() => {
        localStorage.clear();
    });

    it('should add an emergency contact and initiate access request', () => {
        const contact: EmergencyContact = {
            id: 'c1',
            email: 'trusted@example.com',
            publicKey: 'abc...',
            waitPeriodHours: 24,
            status: 'active',
            addedAt: Date.now()
        };

        EmergencyService.addContact(contact);
        const contacts = EmergencyService.getContacts();
        expect(contacts).toHaveLength(1);
        expect(contacts[0].email).toBe('trusted@example.com');

        const request = EmergencyService.initiateAccessRequest('c1');
        expect(request.contactId).toBe('c1');

        const status = EmergencyService.checkAccessStatus();
        expect(status?.isReady).toBe(false);
        expect(status?.remainingSeconds).toBeGreaterThan(0);
    });

    it('should grant access after wait period', () => {
        const contact: EmergencyContact = {
            id: 'c2',
            email: 'helper@example.com',
            publicKey: 'xyz...',
            waitPeriodHours: 1,
            addedAt: Date.now(),
            status: 'active'
        };
        EmergencyService.addContact(contact);

        // Simulate request made 2 hours ago
        const pastRequest = {
            contactId: 'c2',
            requestedAt: Date.now() - (2 * 60 * 60 * 1000),
            isGranted: false,
            expiresAt: Date.now() - (1 * 60 * 60 * 1000)
        };
        localStorage.setItem('aegis_emergency_requests', JSON.stringify(pastRequest));

        const status = EmergencyService.checkAccessStatus();
        expect(status?.isReady).toBe(true);
    });

    it('should revoke access request', () => {
        localStorage.setItem('aegis_emergency_requests', '{}');
        EmergencyService.revokeAccess();
        expect(EmergencyService.checkAccessStatus()).toBeNull();
    });
});

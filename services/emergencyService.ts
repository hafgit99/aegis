import { db } from '../db';
import { CryptoService } from './cryptoService';

export interface EmergencyContact {
    id: string;
    email: string;
    publicKey: string; // Base64 encoded public key for sharing vault key
    waitPeriodHours: number;
    status: 'active' | 'pending' | 'revoked';
    addedAt: number;
}

export interface EmergencyRequest {
    contactId: string;
    requestedAt: number;
    isGranted: boolean;
    expiresAt: number;
}

export class EmergencyService {
    private static STORAGE_KEY = 'aegis_emergency_contacts';
    private static REQUEST_KEY = 'aegis_emergency_requests';

    static getContacts(): EmergencyContact[] {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    static addContact(contact: EmergencyContact): void {
        const contacts = this.getContacts();
        contacts.push(contact);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contacts));
    }

    static initiateAccessRequest(contactId: string): EmergencyRequest {
        const contacts = this.getContacts();
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) throw new Error("Contact not found");

        const request: EmergencyRequest = {
            contactId,
            requestedAt: Date.now(),
            isGranted: false,
            expiresAt: Date.now() + (contact.waitPeriodHours * 60 * 60 * 1000)
        };

        localStorage.setItem(this.REQUEST_KEY, JSON.stringify(request));
        return request;
    }

    static checkAccessStatus(): { isReady: boolean; remainingSeconds: number } | null {
        const requestData = localStorage.getItem(this.REQUEST_KEY);
        if (!requestData) return null;

        const request: EmergencyRequest = JSON.parse(requestData);
        const now = Date.now();

        if (now >= request.expiresAt) {
            return { isReady: true, remainingSeconds: 0 };
        }

        return {
            isReady: false,
            remainingSeconds: Math.ceil((request.expiresAt - now) / 1000)
        };
    }

    static revokeAccess(): void {
        localStorage.removeItem(this.REQUEST_KEY);
    }
}

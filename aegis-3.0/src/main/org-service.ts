import * as crypto from 'crypto';

export interface Organization {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    ownerId: string;
    teams: Team[];
    members: Member[];
    sharedCollections: SharedCollection[];
}

export interface Team {
    id: string;
    name: string;
    description?: string;
    memberIds: string[];
}

export interface Member {
    id: string;
    userId: string;
    email?: string;
    role: 'owner' | 'admin' | 'manager' | 'member';
    joinedAt: number;
}

export interface SharedCollection {
    id: string;
    name: string;
    teamId?: string;
    entryIds: string[]; // IDs of vault entries
}

export class OrganizationService {
    private static instance: OrganizationService;
    private native: any;

    private constructor(native: any) {
        this.native = native;
    }

    public static getInstance(native: any): OrganizationService {
        if (!OrganizationService.instance) {
            OrganizationService.instance = new OrganizationService(native);
        }
        return OrganizationService.instance;
    }


    public async createOrganization(name: string, description: string, ownerId: string): Promise<Organization> {
        const org: Organization = {
            id: crypto.randomUUID(),
            name,
            description,
            createdAt: Date.now(),
            ownerId,
            teams: [],
            members: [{
                id: crypto.randomUUID(),
                userId: ownerId,
                role: 'owner',
                joinedAt: Date.now()
            }],
            sharedCollections: []
        };

        this.saveOrgInternal(org);
        return org;
    }

    public async getOrganizations(): Promise<Organization[]> {
        if (!this.native) return [];
        const entries = this.native.dbGetAll();
        return entries
            .filter((e: any) => e.category === '__SYSTEM_ORG__')
            .map((e: any) => {
                try {
                    const data = JSON.parse(Buffer.from(e.data, 'hex').toString());
                    return {
                        ...data,
                        id: e.id,
                        name: e.title,
                        teams: data.teams || [],
                        members: data.members || [],
                        sharedCollections: data.sharedCollections || []
                    };
                } catch (err) {
                    console.error('Failed to parse org data:', err);
                    return {
                        id: e.id,
                        name: e.title,
                        teams: [],
                        members: [],
                        sharedCollections: []
                    };
                }
            });
    }

    private saveOrgInternal(org: Organization) {
        if (!this.native) return;
        const dataHex = Buffer.from(JSON.stringify(org)).toString('hex');
        this.native.dbSave(
            org.id,
            org.name,
            '__ORG_SYSTEM__',
            dataHex,
            'org_management',
            '__SYSTEM_ORG__'
        );
    }

    public async updateOrganization(org: Organization): Promise<void> {
        this.saveOrgInternal(org);
    }

    public async deleteOrganization(orgId: string): Promise<void> {
        if (!this.native) return;
        this.native.dbDelete(orgId);
    }

    // Team Operations
    public async addTeam(orgId: string, name: string, description: string): Promise<Team> {
        const orgs = await this.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (!org) throw new Error('Organization not found');

        const team: Team = {
            id: crypto.randomUUID(),
            name,
            description,
            memberIds: []
        };
        org.teams.push(team);
        this.saveOrgInternal(org);
        return team;
    }

    // Member Operations
    public async inviteMember(orgId: string, email: string, role: Member['role']): Promise<Member> {
        const orgs = await this.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (!org) throw new Error('Organization not found');

        const member: Member = {
            id: crypto.randomUUID(),
            userId: crypto.randomUUID(), // In a real system, this would be linked to a registered user
            email,
            role,
            joinedAt: Date.now()
        };
        org.members.push(member);
        this.saveOrgInternal(org);
        return member;
    }

    // Shared Collection Operations
    public async addCollection(orgId: string, name: string, teamId?: string): Promise<SharedCollection> {
        const orgs = await this.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (!org) throw new Error('Organization not found');

        const collection: SharedCollection = {
            id: crypto.randomUUID(),
            name,
            teamId,
            entryIds: []
        };
        org.sharedCollections.push(collection);
        this.saveOrgInternal(org);
        return collection;
    }

    public async addEntryToCollection(orgId: string, collectionId: string, entryId: string): Promise<void> {
        const orgs = await this.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (!org) throw new Error('Organization not found');

        const collection = org.sharedCollections.find(c => c.id === collectionId);
        if (!collection) throw new Error('Collection not found');

        if (!collection.entryIds.includes(entryId)) {
            collection.entryIds.push(entryId);
            this.saveOrgInternal(org);
        }
    }

    public async removeEntryFromCollection(orgId: string, collectionId: string, entryId: string): Promise<void> {
        const orgs = await this.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (!org) throw new Error('Organization not found');

        const collection = org.sharedCollections.find(c => c.id === collectionId);
        if (!collection) throw new Error('Collection not found');

        collection.entryIds = collection.entryIds.filter(id => id !== entryId);
        this.saveOrgInternal(org);
    }

    public async updateMemberRole(orgId: string, memberId: string, role: Member['role']): Promise<void> {
        const orgs = await this.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (!org) throw new Error('Organization not found');

        const member = org.members.find(m => m.id === memberId);
        if (!member) throw new Error('Member not found');

        member.role = role;
        this.saveOrgInternal(org);
    }

    public async removeMember(orgId: string, memberId: string): Promise<void> {
        const orgs = await this.getOrganizations();
        const org = orgs.find(o => o.id === orgId);
        if (!org) throw new Error('Organization not found');

        org.members = org.members.filter(m => m.id !== memberId);
        this.saveOrgInternal(org);
    }
}

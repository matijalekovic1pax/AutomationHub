import Dexie, { Table } from 'dexie';
import { User, AutomationRequest, UserRole, Priority, RequestStatus } from './types';

export class RevitHubDB extends Dexie {
  users!: Table<User>;
  requests!: Table<AutomationRequest>;

  constructor() {
    super('RevitHubDB');
    
    // Define schema
    // We only index fields we intend to query by
    // Cast 'this' to any to avoid TypeScript error about 'version' not existing on the subclass
    (this as any).version(1).stores({
      users: 'id, email',
      requests: 'id, requesterId, status, priority, projectName, createdAt'
    });
  }
}

export const db = new RevitHubDB();

// Initial Seed Function to populate DB if empty
export const seedDatabase = async () => {
    const userCount = await db.users.count();
    if (userCount === 0) {
        await db.users.bulkAdd([
            {
                id: 'user_arch',
                name: 'Alice Architect',
                email: 'arch@design.com',
                role: UserRole.ARCHITECT,
                avatar: 'https://ui-avatars.com/api/?name=Alice+Architect&background=6366f1&color=fff'
            },
            {
                id: 'user_dev',
                name: 'Dave Developer',
                email: 'dev@code.com',
                role: UserRole.DEVELOPER,
                avatar: 'https://ui-avatars.com/api/?name=Dave+Developer&background=10b981&color=fff'
            }
        ]);
    }

    const reqCount = await db.requests.count();
    if (reqCount === 0) {
        await db.requests.bulkAdd([
            {
                id: 'req_1',
                title: 'Auto-Dimension Walls in View',
                requesterName: 'Alice Architect',
                requesterId: 'user_arch',
                projectName: 'Tower A - Schematic',
                revitVersion: '2024',
                dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
                description: 'I need a script that places aligned dimensions on all wall faces in the active view. It should prioritize core faces.',
                priority: Priority.HIGH,
                status: RequestStatus.PENDING,
                createdAt: Date.now() - 86400000 * 2,
                updatedAt: Date.now() - 86400000 * 2,
                attachments: []
            },
            {
                id: 'req_2',
                title: 'Export Sheets to PDF',
                requesterName: 'Alice Architect',
                requesterId: 'user_arch',
                projectName: 'Hospital Block B',
                revitVersion: '2023',
                description: 'Automate the export of all sheets containing "Fire" in the name to PDF. Naming convention: Sheet Number - Sheet Name.',
                priority: Priority.MEDIUM,
                status: RequestStatus.IN_PROGRESS,
                createdAt: Date.now() - 86400000,
                updatedAt: Date.now(),
                attachments: []
            },
            {
                id: 'req_3',
                title: 'Bulk Rename Families',
                requesterName: 'Bob Builder',
                requesterId: 'user_bob', 
                projectName: 'City Center Mall',
                revitVersion: '2025',
                description: 'We need to add a prefix "ACM_" to all generic models in the project.',
                priority: Priority.LOW,
                status: RequestStatus.COMPLETED,
                createdAt: Date.now() - 86400000 * 10,
                updatedAt: Date.now() - 86400000 * 5,
                resultScript: "import clr\n# Script content...",
                attachments: []
            }
        ]);
    }
};